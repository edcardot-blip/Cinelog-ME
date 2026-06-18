// Cinelog catalog backfill — STREAMING-SERVICE ORIGINAL MOVIES (curated, multi-service).
//
// Goal: fill genuine gaps with high-quality streaming originals people would be excited to
// discover — curated, NOT exhaustive. This is a scoped one-off backfill with its own looser
// (per-service) bar than the locked GATE.md daily gate; rows are tagged source='ingest-originals'.
//
// Per service: discover original FILMS via TMDB production companies (the best "original" signal
// TMDB offers — there is no definitive original flag), enrich ratings via OMDb, apply the
// service's gate, exclude non-movies/docs/concert/standup/shorts, then CURATE by keeping the
// best-scoring titles up to the service's target (quality over completeness).
//
// DRY_RUN defaults ON: prints the grouped add-list + per-service counts + total + dedup
// confirmation, and writes nothing. Runs on Node 20 (global fetch).
//
// Env:
//   TMDB_API_KEY               (required) discovery + details + watch providers
//   OMDB_API_KEY               (required) ratings (IMDb rating + vote count)
//   SUPABASE_SERVICE_ROLE_KEY  (live only) writes to `movies`
//   SUPABASE_ANON_KEY          (optional) read override; defaults to the public baked key
//   DRY_RUN                    '0' = live writes; anything else = dry (default)
//   SERVICES                   comma list to limit which services run (default: all).
//                              e.g. "netflix,prime" — useful to stay under the daily OMDb budget.
//   OMDB_CAP                   hard OMDb call cap this run (default 800; OMDb allows ~1000/day)

const TMDB_KEY = need('TMDB_API_KEY');
const OMDB_KEY = need('OMDB_API_KEY');
const SUPABASE_URL = 'https://fmhmvvsbxofoqriekfyj.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaG12dnNieG9mb3FyaWVrZnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MzQxODMsImV4cCI6MjA5NTUxMDE4M30.py2dCqGmEzHhwAUk2mIPas_cKBk7LpYfNL4BpCUmKrk';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DRY = process.env.DRY_RUN !== '0';
const REGION = 'US';
const OMDB_CAP = +(process.env.OMDB_CAP || 800);
const DISCOVER_PAGE_CAP = 25;                 // pages per company discovery (500 films, plenty)
const MIN_RUNTIME = 60;                        // movies only — excludes shorts / stand-up / specials
const VOTE_SANITY_FLOOR = 2000;               // ignore ultra-obscure (DTV-ish) even if rating passes
const DOC_NOTABLE_IMDB = 7.5, DOC_NOTABLE_VOTES = 100000;   // docs only if especially notable
const TIER_ORDER = [['buy','buy'],['rent','rent'],['ads','ads'],['free','free'],['flatrate','flatrate']];

// Per-service config. `companies` are name fragments matched against TMDB /search/company;
// `provider` name fragments identify the service's watch provider (used to tag streaming).
const SERVICES = {
  apple:    { label:'Apple TV+',   minImdb:5.0, minVotes:25000, target:60,
              companies:['apple studios','apple original films'], provider:['apple tv plus','apple tv+'] },
  netflix:  { label:'Netflix',     minImdb:5.5, minVotes:40000, target:150,
              companies:['netflix'], provider:['netflix'] },
  max:      { label:'Max',         minImdb:6.0, minVotes:20000, target:60,
              companies:['max originals','hbo films'], provider:['max','hbo max'] },
  hulu:     { label:'Hulu',        minImdb:5.5, minVotes:20000, target:50,
              companies:['hulu'], provider:['hulu'] },
  disney:   { label:'Disney+',     minImdb:5.5, minVotes:20000, target:40,
              companies:['disney+ ','disney plus'], provider:['disney plus','disney+'] },
  prime:    { label:'Prime Video', minImdb:5.5, minVotes:30000, target:80,
              companies:['amazon studios','amazon mgm studios'], provider:['amazon prime video'] },
  paramount:{ label:'Paramount+',  minImdb:5.5, minVotes:15000, target:30,
              companies:['paramount+','paramount plus'], provider:['paramount plus','paramount+'] },
  peacock:  { label:'Peacock',     minImdb:5.5, minVotes:15000, target:25,
              companies:['peacock'], provider:['peacock'] },
};

let omdbSpent = 0, tmdbCalls = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function need(k){ const v = process.env[k]; if(!v){ console.error('Missing env ' + k); process.exit(1); } return v; }

async function tmdb(path, params = {}){
  const u = new URL('https://api.themoviedb.org/3' + path);
  u.searchParams.set('api_key', TMDB_KEY);
  for(const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  tmdbCalls++;
  const r = await fetch(u);
  await sleep(35);
  if(!r.ok){ console.warn('  ! TMDB ' + path + ' -> HTTP ' + r.status); return null; }
  return r.json();
}
async function omdb(imdbId){
  if(omdbSpent >= OMDB_CAP) return null;
  omdbSpent++;
  const u = new URL('https://www.omdbapi.com/');
  u.searchParams.set('apikey', OMDB_KEY); u.searchParams.set('i', imdbId);
  const r = await fetch(u);
  await sleep(25);
  if(!r.ok) return null;
  const j = await r.json();
  return j.Response === 'False' ? null : j;
}
function omdbRatings(j){
  let imdb = null, rt = null, meta = null, votes = null;
  if(j.imdbRating && j.imdbRating !== 'N/A') imdb = parseFloat(j.imdbRating);
  if(j.Metascore && j.Metascore !== 'N/A') meta = parseInt(j.Metascore, 10);
  (j.Ratings || []).forEach(x => { if(x.Source === 'Rotten Tomatoes') rt = parseInt(x.Value, 10); });
  if(j.imdbVotes && j.imdbVotes !== 'N/A') votes = parseInt(j.imdbVotes.replace(/,/g, ''), 10);
  return { imdb, rt, meta, votes };
}
async function companyIdsFor(fragments){
  const ids = [];
  for(const frag of fragments){
    const j = await tmdb('/search/company', { query: frag });
    for(const c of ((j && j.results) || [])){
      if(String(c.name || '').toLowerCase().includes(frag)) ids.push(c.id);
    }
  }
  return [...new Set(ids)];
}
async function discoverByCompanies(ids){
  const out = []; let page = 1, total = 1;
  while(page <= total && page <= DISCOVER_PAGE_CAP){
    const j = await tmdb('/discover/movie', { with_companies: ids.join('|'), sort_by: 'vote_count.desc', include_adult: 'false', page });
    if(!j) break;
    out.push(...(j.results || []));
    total = j.total_pages || 1; page++;
  }
  return out;
}
async function existsByImdb(imdbId){
  const r = await fetch(SUPABASE_URL + '/rest/v1/movies?select=imdb_id&imdb_id=eq.' + encodeURIComponent(imdbId) + '&limit=1',
    { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
  return r.ok ? (await r.json()).length > 0 : false;
}
// Fallback dedupe when imdb_id is somehow absent: match by title + year.
async function existsByTitleYear(title, year){
  if(!title || !year) return false;
  const r = await fetch(SUPABASE_URL + '/rest/v1/movies?select=imdb_id&title=eq.' + encodeURIComponent(title) + '&year=eq.' + year + '&limit=1',
    { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
  return r.ok ? (await r.json()).length > 0 : false;
}
function streamingFromProviders(wp){
  const us = wp && wp.results && wp.results[REGION]; const streaming = {};
  if(us){ for(const [tmdbTier, tier] of TIER_ORDER){ for(const p of (us[tmdbTier] || [])) streaming[String(p.provider_name).toLowerCase()] = tier; } }
  return streaming;
}
function usCertification(rd){
  const us = ((rd && rd.results) || []).find(x => x.iso_3166_1 === 'US');
  if(!us) return null;
  for(const rel of (us.release_dates || [])){ if(rel.certification) return rel.certification; }
  return null;
}
const CONCERT_RE = /(concert|: live\b|\blive at\b|stand[- ]?up|comedy special|in concert|world tour)/i;
// Quality score for CURATION (keep the best N per service): rating-led, popularity as a tiebreak.
function qualityScore(imdb, votes){ return (imdb || 0) * 10 + Math.min(Math.log10((votes || 0) + 1), 6.5) * 4; }

async function processService(key, cfg, seenImdb){
  console.log('\n===== ' + cfg.label + '  (imdb>=' + cfg.minImdb + ' OR votes>=' + cfg.minVotes + ', target ~' + cfg.target + ') =====');
  const companyIds = await companyIdsFor(cfg.companies);
  console.log('  company ids: ' + (companyIds.join(', ') || '(none)'));
  if(!companyIds.length) return { added: [], skippedExisting: 0 };

  const candidates = await discoverByCompanies(companyIds);
  // De-dupe candidates by TMDB id.
  const uniq = [...new Map(candidates.map(m => [m.id, m])).values()];
  console.log('  candidate films: ' + uniq.length);

  const qualified = [];
  let skippedExisting = 0, skippedExcluded = 0, skippedGate = 0, skippedNoImdb = 0, skippedNoOmdb = 0;

  for(const c of uniq){
    if(omdbSpent >= OMDB_CAP){ console.log('  ! OMDb cap reached mid-service — re-run later for the rest'); break; }
    // Cheap TMDB pre-gate to avoid wasting OMDb on the obscure long tail.
    if((c.vote_average || 0) < (cfg.minImdb - 1) && (c.vote_count || 0) < 80) continue;

    const det = await tmdb('/movie/' + c.id, { append_to_response: 'external_ids,credits,release_dates,watch/providers' });
    if(!det) continue;
    const imdbId = det.external_ids && det.external_ids.imdb_id;

    // Exclusions: movies only (runtime), skip concert/standup by title, skip docs unless notable.
    const genres = (det.genres || []).map(g => g.name);
    const isDoc = genres.includes('Documentary');
    if((det.runtime || 0) < MIN_RUNTIME) { skippedExcluded++; continue; }
    if(CONCERT_RE.test(det.title || '')) { skippedExcluded++; continue; }

    // Dedupe BEFORE spending OMDb.
    if(imdbId && (seenImdb.has(imdbId) || await existsByImdb(imdbId))){ skippedExisting++; if(imdbId) seenImdb.add(imdbId); continue; }
    if(!imdbId && await existsByTitleYear(det.title, det.release_date ? +det.release_date.slice(0,4) : null)){ skippedExisting++; continue; }
    if(!imdbId){ skippedNoImdb++; continue; }

    const o = await omdb(imdbId);
    if(!o){ skippedNoOmdb++; continue; }
    const r = omdbRatings(o);

    // Docs only if especially notable.
    if(isDoc && !((r.imdb != null && r.imdb >= DOC_NOTABLE_IMDB) || (r.votes != null && r.votes >= DOC_NOTABLE_VOTES))){ skippedExcluded++; continue; }
    // Sanity vote floor so ultra-obscure DTV titles don't sneak in via the rating gate.
    if((r.votes || 0) < VOTE_SANITY_FLOOR){ skippedGate++; continue; }
    // Service gate.
    const qualifies = (r.imdb != null && r.imdb >= cfg.minImdb) || (r.votes != null && r.votes >= cfg.minVotes);
    if(!qualifies){ skippedGate++; continue; }

    seenImdb.add(imdbId);
    const crew = (det.credits && det.credits.crew) || [];
    const cast = (det.credits && det.credits.cast) || [];
    const streaming = streamingFromProviders(det['watch/providers']);
    qualified.push({
      imdb_id: imdbId, title: det.title,
      year: det.release_date ? +det.release_date.slice(0, 4) : null,
      runtime_minutes: det.runtime || null,
      genre: genres.join(', '),
      director: crew.filter(p => p.job === 'Director').map(p => p.name).join(', ') || null,
      actors: cast.slice(0, 4).map(p => p.name).join(', ') || null,
      imdb_rating: r.imdb, rotten_tomatoes_score: r.rt, metascore: r.meta, vote_count: r.votes,
      poster_url: det.poster_path ? 'https://image.tmdb.org/t/p/w500' + det.poster_path : null,
      original_language: det.original_language || null,
      mpaa_rating: usCertification(det.release_dates) || null,
      country: (det.production_countries && det.production_countries[0] && det.production_countries[0].iso_3166_1) || null,
      popularity: c.popularity ?? null, release_date: det.release_date || null, tmdb_id: c.id, streaming,
      source: 'ingest-originals', _service: cfg.label, _score: qualityScore(r.imdb, r.votes)
    });
  }

  // CURATE: keep the best-scoring up to the service target (quality over completeness).
  qualified.sort((a, b) => b._score - a._score);
  const added = qualified.slice(0, cfg.target);
  console.log('  qualified: ' + qualified.length + ' | kept (<=target): ' + added.length +
    ' | excluded: ' + skippedExcluded + ' | below-gate: ' + skippedGate +
    ' | already-in-DB: ' + skippedExisting + ' | no-imdb: ' + skippedNoImdb + ' | no-omdb: ' + skippedNoOmdb);
  return { added, skippedExisting };
}

async function main(){
  console.log('=== Cinelog streaming-originals backfill ' + (DRY ? '(DRY RUN — no writes)' : '(LIVE)') + ' ===');
  if(!DRY && !SERVICE){ console.error('LIVE run needs SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const want = (process.env.SERVICES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const keys = Object.keys(SERVICES).filter(k => !want.length || want.includes(k));

  const seenImdb = new Set();      // cross-service in-run dedupe (a film can be on >1 service)
  const all = [];
  let totalExisting = 0;
  for(const k of keys){
    const { added, skippedExisting } = await processService(k, SERVICES[k], seenImdb);
    all.push(...added); totalExisting += skippedExisting;
  }

  // ---- OUTPUT: grouped add-list + counts + dedupe confirmation ----
  console.log('\n\n========== ADD LIST (grouped by service) ==========');
  const perService = {};
  for(const k of keys) perService[SERVICES[k].label] = all.filter(m => m._service === SERVICES[k].label);
  for(const [label, list] of Object.entries(perService)){
    console.log('\n--- ' + label + ' (' + list.length + ') ---');
    for(const m of list) console.log('  ' + m.title + ' (' + m.year + ')  ·  IMDb ' + m.imdb_rating + '  ·  ' + (m.vote_count || 0).toLocaleString() + ' votes');
  }
  console.log('\n========== TOTALS ==========');
  for(const [label, list] of Object.entries(perService)) console.log('  ' + label + ': ' + list.length);
  console.log('  TOTAL UNIQUE TO ADD: ' + all.length);
  const ids = all.map(m => m.imdb_id);
  const dupeFree = new Set(ids).size === ids.length;
  console.log('  Duplicate check: ' + (dupeFree ? 'PASS — no duplicate imdb_ids in the add list' : '!! FAIL — duplicates present'));
  console.log('  (already-in-catalog skipped across services: ' + totalExisting + ')');
  console.log('  OMDb calls: ' + omdbSpent + '/' + OMDB_CAP + (omdbSpent >= OMDB_CAP ? '  (CAP HIT — some services may be incomplete; re-run with SERVICES=… next day)' : '') + ' · TMDB calls: ' + tmdbCalls);

  if(DRY){ console.log('\nDRY RUN — nothing written. Review the list above, then re-run with DRY_RUN=0.'); return; }
  if(!all.length){ console.log('Nothing to write.'); return; }

  const now = new Date().toISOString();
  const rows = all.map(({ _service, _score, ...row }) => ({ ...row, added_at: now, ratings_updated_at: now, streaming_updated_at: now }));
  const resp = await fetch(SUPABASE_URL + '/rest/v1/movies', {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  });
  if(!resp.ok){ console.error('Write failed: HTTP ' + resp.status + ' ' + (await resp.text())); process.exit(1); }
  console.log('\nWrote ' + rows.length + ' streaming original(s) to the catalog.');
}

main().catch(e => { console.error(e); process.exit(1); });
