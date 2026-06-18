// Cinelog catalog backfill — STREAMING-SERVICE ORIGINALS (CURATED seed lists).
//
// TMDB has no reliable "is original" flag, and company-based discovery produced a skewed,
// incomplete set (missed the famous originals, surfaced obscure/old TV-movies). So this uses
// HAND-PICKED title+year seed lists per service — the originals genuinely worth recommending.
// Each title is resolved to the correct film via TMDB search (no hand-typed IMDb IDs to get
// wrong), enriched with ratings (OMDb) + metadata + a poster, force-tagged to its service so it
// shows under that subscription filter, and deduped against the live catalog.
//
// DRY_RUN defaults ON: prints the grouped add-list + per-service counts + total + dedupe
// confirmation + any unresolved titles, and writes nothing. Runs on Node 20 (global fetch).
//
// Env: TMDB_API_KEY, OMDB_API_KEY (required); SUPABASE_SERVICE_ROLE_KEY (live);
//      SUPABASE_ANON_KEY (optional); DRY_RUN ('0'=write); SERVICES (comma list; blank=all).

const TMDB_KEY = need('TMDB_API_KEY');
const OMDB_KEY = need('OMDB_API_KEY');
const SUPABASE_URL = 'https://fmhmvvsbxofoqriekfyj.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaG12dnNieG9mb3FyaWVrZnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MzQxODMsImV4cCI6MjA5NTUxMDE4M30.py2dCqGmEzHhwAUk2mIPas_cKBk7LpYfNL4BpCUmKrk';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DRY = process.env.DRY_RUN !== '0';
const REGION = 'US';
const TIER_ORDER = [['buy','buy'],['rent','rent'],['ads','ads'],['free','free'],['flatrate','flatrate']];

// Curated originals per service. `providerKey` is the lowercase streaming key the app recognizes
// (so the title shows under that subscription toggle). Lists favor quality over completeness.
const SEEDS = {
  apple: { label:'Apple TV+', providerKey:'apple tv plus', titles:[
    ['CODA',2021],['Killers of the Flower Moon',2023],['Napoleon',2023],['Greyhound',2020],
    ['Wolfwalkers',2020],['The Tragedy of Macbeth',2021],['Palmer',2021],['Finch',2021],
    ['The Banker',2020],['Emancipation',2022],['Tetris',2023],['Ghosted',2023],['Spirited',2022],
    ['Causeway',2022],['Sharper',2023],['The Family Plan',2023],['Argylle',2024],
    ['Fly Me to the Moon',2024],['Wolfs',2024],['Blitz',2024],['The Instigators',2024],
    ['Swan Song',2021],['Luck',2022],['On the Rocks',2020],['Cherry',2021],['Echo Valley',2025],
    ['The Gorge',2025],['Fountain of Youth',2025],['The Lost Bus',2025] ] },
  netflix: { label:'Netflix', providerKey:'netflix', titles:[
    ['The Irishman',2019],['Roma',2018],['Marriage Story',2019],['The Power of the Dog',2021],
    ['Glass Onion',2022],['All Quiet on the Western Front',2022],["Don't Look Up",2021],
    ['The Trial of the Chicago 7',2020],['Mank',2020],['The Two Popes',2019],['Okja',2017],
    ['The Ballad of Buster Scruggs',2018],['Da 5 Bloods',2020],['Hustle',2022],['The Gray Man',2022],
    ['Extraction',2020],['Extraction 2',2023],['Bird Box',2018],['Red Notice',2021],
    ['The Adam Project',2022],['Enola Holmes',2020],['Enola Holmes 2',2022],['The Old Guard',2020],
    ['Rebel Ridge',2024],['Leave the World Behind',2023],['The Killer',2023],['Athena',2022],
    ["I'm Thinking of Ending Things",2020],['His House',2020],['The Mitchells vs the Machines',2021],
    ['Klaus',2019],['Over the Moon',2020],['The Sea Beast',2022],['Nimona',2023],
    ['Society of the Snow',2023],['The Platform',2019],['Always Be My Maybe',2019],['The Half of It',2020],
    ['To All the Boys I Loved Before',2018],['Murder Mystery',2019],['Triple Frontier',2019],
    ['6 Underground',2019],['Army of the Dead',2021],['Damsel',2024],['The Wonder',2022],
    ['Maestro',2023],['May December',2023],['Carry-On',2024],['Spenser Confidential',2020],
    ['Beasts of No Nation',2015],['The Lost Daughter',2021],['Pieces of a Woman',2020],
    ['News of the World',2020],['tick, tick... BOOM!',2021],['The White Tiger',2021],
    ['Guillermo del Toro\'s Pinocchio',2022],['The Harder They Fall',2021],['I Care a Lot',2020],
    ['The Dig',2021],['Passing',2021],['El Camino: A Breaking Bad Movie',2019],['Hit Man',2023],
    ['They Cloned Tyrone',2023],['Project Power',2020],['The Wandering Earth',2019],
    ['Apollo 10½: A Space Age Childhood',2022],['Slumberland',2022],['Atlas',2024],['Lift',2024],
    ['Purple Hearts',2022],['Do Revenge',2022],['The Kissing Booth',2018],['Bright',2017] ] },
  max: { label:'Max', providerKey:'max', titles:[
    ['Zack Snyder\'s Justice League',2021],['An American Pickle',2020],['Kimi',2022],
    ['Let Them All Talk',2020],['Charm City Kings',2020],['Unpregnant',2020],['Moonshot',2022],
    ['Locked Down',2021],['Bad Education',2019],['Behind the Candelabra',2013],['Father of the Bride',2022],
    ['House Party',2023],['8-Bit Christmas',2021] ] },
  hulu: { label:'Hulu', providerKey:'hulu', titles:[
    ['Palm Springs',2020],['Prey',2022],['Run',2020],['No One Will Save You',2023],['Fresh',2022],
    ['Vacation Friends',2021],['Vacation Friends 2',2023],['Boston Strangler',2023],
    ['Happiest Season',2020],['Hellraiser',2022],['Rosaline',2022],['Not Okay',2022],['Quasi',2023],
    ['Big Time Adolescence',2019],['Plan B',2021],['The Princess',2022] ] },
  disney: { label:'Disney+', providerKey:'disney plus', titles:[
    ['Soul',2020],['Luca',2021],['Turning Red',2022],['Togo',2019],['Hamilton',2020],
    ['Hocus Pocus 2',2022],['Disenchanted',2022],['The One and Only Ivan',2020],['Godmothered',2020],
    ['Pinocchio',2022],['Peter Pan & Wendy',2023],['Lady and the Tramp',2019],
    ['Cheaper by the Dozen',2022],['Flora & Ulysses',2021],['Better Nate Than Ever',2022] ] },
  prime: { label:'Prime Video', providerKey:'amazon prime video', titles:[
    ['Sound of Metal',2019],['The Big Sick',2017],['Manchester by the Sea',2016],
    ['One Night in Miami',2020],['The Report',2019],['Being the Ricardos',2021],['The Tender Bar',2021],
    ['The Aeronauts',2019],['Coming 2 America',2021],['Borat Subsequent Moviefilm',2020],
    ['Without Remorse',2021],['The Tomorrow War',2021],['Air',2023],['Saltburn',2023],
    ['Argentina, 1985',2022],['The Boys in the Boat',2023],['Red, White & Royal Blue',2023],
    ['The Burial',2023],['A Million Miles Away',2023],['Road House',2024],['The Idea of You',2024],
    ['My Policeman',2022],["I'm Your Woman",2020],['Last Flag Flying',2017],['Uncle Frank',2020],
    ["Brad's Status",2017],['The Map of Tiny Perfect Things',2021],['Cassandro',2023],
    ['Deep Cover',2025],['Late Night',2019],['Hotel Mumbai',2018] ] },
  paramount: { label:'Paramount+', providerKey:'paramount plus', titles:[
    ['Jerry & Marge Go Large',2022],['Infinite',2021],['Clifford the Big Red Dog',2021],
    ['PAW Patrol: The Movie',2021],['80 for Brady',2023],['On the Come Up',2022],
    ['Secret Headquarters',2022] ] },
  peacock: { label:'Peacock', providerKey:'peacock', titles:[
    ["Five Nights at Freddy's",2023],['Sick',2022],['They/Them',2022],
    ['Psych 2: Lassie Come Home',2020],['Meet Cute',2022],['The Machine',2023] ] },
};

let omdbSpent = 0, tmdbCalls = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function need(k){ const v = process.env[k]; if(!v){ console.error('Missing env ' + k); process.exit(1); } return v; }

async function tmdb(path, params = {}){
  const u = new URL('https://api.themoviedb.org/3' + path);
  u.searchParams.set('api_key', TMDB_KEY);
  for(const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  tmdbCalls++;
  const r = await fetch(u); await sleep(30);
  if(!r.ok){ console.warn('  ! TMDB ' + path + ' -> HTTP ' + r.status); return null; }
  return r.json();
}
async function omdb(imdbId){
  omdbSpent++;
  const u = new URL('https://www.omdbapi.com/');
  u.searchParams.set('apikey', OMDB_KEY); u.searchParams.set('i', imdbId);
  const r = await fetch(u); await sleep(25);
  if(!r.ok) return null;
  const j = await r.json();
  return j.Response === 'False' ? null : j;
}
function omdbRatings(j){
  let imdb=null, rt=null, meta=null, votes=null;
  if(j.imdbRating && j.imdbRating !== 'N/A') imdb = parseFloat(j.imdbRating);
  if(j.Metascore && j.Metascore !== 'N/A') meta = parseInt(j.Metascore, 10);
  (j.Ratings || []).forEach(x => { if(x.Source === 'Rotten Tomatoes') rt = parseInt(x.Value, 10); });
  if(j.imdbVotes && j.imdbVotes !== 'N/A') votes = parseInt(j.imdbVotes.replace(/,/g, ''), 10);
  return { imdb, rt, meta, votes };
}
async function searchMovie(title, year){
  let j = await tmdb('/search/movie', { query: title, year, include_adult: 'false' });
  let hit = j && j.results && j.results[0];
  if(!hit){ j = await tmdb('/search/movie', { query: title, include_adult: 'false' }); hit = j && j.results && j.results[0]; }
  return hit || null;
}
async function existsByImdb(imdbId){
  const r = await fetch(SUPABASE_URL + '/rest/v1/movies?select=imdb_id&imdb_id=eq.' + encodeURIComponent(imdbId) + '&limit=1',
    { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
  return r.ok ? (await r.json()).length > 0 : false;
}
function streamingFromProviders(wp, providerKey){
  const us = wp && wp.results && wp.results[REGION]; const streaming = {};
  if(us){ for(const [tmdbTier, tier] of TIER_ORDER){ for(const p of (us[tmdbTier] || [])) streaming[String(p.provider_name).toLowerCase()] = tier; } }
  streaming[providerKey] = 'flatrate';   // force the service tag so it appears under that subscription filter
  return streaming;
}
function usCertification(rd){
  const us = ((rd && rd.results) || []).find(x => x.iso_3166_1 === 'US');
  if(!us) return null;
  for(const rel of (us.release_dates || [])){ if(rel.certification) return rel.certification; }
  return null;
}

async function processService(key, cfg, seen){
  console.log('\n===== ' + cfg.label + ' (' + cfg.titles.length + ' curated) =====');
  const added = []; const unresolved = []; let dupes = 0;
  for(const [title, year] of cfg.titles){
    const hit = await searchMovie(title, year);
    if(!hit){ unresolved.push(title + ' (' + year + ')'); continue; }
    const det = await tmdb('/movie/' + hit.id, { append_to_response: 'external_ids,credits,release_dates,watch/providers' });
    if(!det){ unresolved.push(title + ' (' + year + ') [details fail]'); continue; }
    const imdbId = det.external_ids && det.external_ids.imdb_id;
    if(!imdbId){ unresolved.push(title + ' (' + year + ') [no imdb_id]'); continue; }
    if(seen.has(imdbId) || await existsByImdb(imdbId)){ seen.add(imdbId); dupes++; continue; }

    const o = await omdb(imdbId);
    const r = o ? omdbRatings(o) : { imdb:null, rt:null, meta:null, votes:null };
    seen.add(imdbId);
    const crew = (det.credits && det.credits.crew) || [];
    const cast = (det.credits && det.credits.cast) || [];
    added.push({
      imdb_id: imdbId, title: det.title,
      year: det.release_date ? +det.release_date.slice(0, 4) : year,
      runtime_minutes: det.runtime || null,
      genre: (det.genres || []).map(g => g.name).join(', '),
      director: crew.filter(p => p.job === 'Director').map(p => p.name).join(', ') || null,
      actors: cast.slice(0, 4).map(p => p.name).join(', ') || null,
      imdb_rating: r.imdb, rotten_tomatoes_score: r.rt, metascore: r.meta, vote_count: r.votes,
      poster_url: det.poster_path ? 'https://image.tmdb.org/t/p/w500' + det.poster_path : null,
      original_language: det.original_language || null,
      mpaa_rating: usCertification(det.release_dates) || null,
      country: (det.production_countries && det.production_countries[0] && det.production_countries[0].iso_3166_1) || null,
      popularity: det.popularity ?? null, release_date: det.release_date || null, tmdb_id: hit.id,
      streaming: streamingFromProviders(det['watch/providers'], cfg.providerKey),
      source: 'ingest-originals', _service: cfg.label
    });
  }
  console.log('  resolved+new: ' + added.length + ' | already-in-DB: ' + dupes + ' | unresolved: ' + unresolved.length);
  if(unresolved.length) console.log('  unresolved: ' + unresolved.join('; '));
  return added;
}

async function main(){
  console.log('=== Cinelog curated streaming-originals backfill ' + (DRY ? '(DRY RUN — no writes)' : '(LIVE)') + ' ===');
  if(!DRY && !SERVICE){ console.error('LIVE run needs SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const want = (process.env.SERVICES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const keys = Object.keys(SEEDS).filter(k => !want.length || want.includes(k));

  const seen = new Set(); const all = [];
  for(const k of keys){ all.push(...await processService(k, SEEDS[k], seen)); }

  console.log('\n\n========== ADD LIST (grouped by service) ==========');
  for(const k of keys){
    const list = all.filter(m => m._service === SEEDS[k].label);
    console.log('\n--- ' + SEEDS[k].label + ' (' + list.length + ') ---');
    for(const m of list) console.log('  ' + m.title + ' (' + m.year + ')  ·  IMDb ' + (m.imdb_rating ?? 'n/a') + '  ·  ' + (m.vote_count != null ? m.vote_count.toLocaleString() : 'n/a') + ' votes');
  }
  console.log('\n========== TOTALS ==========');
  for(const k of keys) console.log('  ' + SEEDS[k].label + ': ' + all.filter(m => m._service === SEEDS[k].label).length);
  console.log('  TOTAL UNIQUE TO ADD: ' + all.length);
  const ids = all.map(m => m.imdb_id);
  console.log('  Duplicate check: ' + (new Set(ids).size === ids.length ? 'PASS — no duplicate imdb_ids' : '!! FAIL'));
  console.log('  OMDb calls: ' + omdbSpent + ' · TMDB calls: ' + tmdbCalls);

  if(DRY){ console.log('\nDRY RUN — nothing written. Review above, then re-run with DRY_RUN=0.'); return; }
  if(!all.length){ console.log('Nothing to write.'); return; }
  const now = new Date().toISOString();
  const rows = all.map(({ _service, ...row }) => ({ ...row, added_at: now, ratings_updated_at: now, streaming_updated_at: now }));
  const resp = await fetch(SUPABASE_URL + '/rest/v1/movies', {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  });
  if(!resp.ok){ console.error('Write failed: HTTP ' + resp.status + ' ' + (await resp.text())); process.exit(1); }
  console.log('\nWrote ' + rows.length + ' curated original(s) to the catalog.');
}

main().catch(e => { console.error(e); process.exit(1); });
