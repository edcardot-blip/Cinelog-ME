// Cinelog TV ingestion — ADD path (TMDB-only). Discovery is streaming+acclaim-gated, so every
// candidate is already on a subscription service AND above the quality bar; we then pull details +
// per-season episode ratings and insert as type='tv'. DRY_RUN defaults ON (prints, writes nothing).
// Design + locked gate: see pipeline/GATE-TV.md. Runs on Node 20 (global fetch). v1 spends ZERO OMDb.
//
// Env:
//   TMDB_API_KEY                 (required) discovery + details + seasons + providers
//   SUPABASE_SERVICE_ROLE_KEY    (live only) writes to `movies`
//   SUPABASE_ANON_KEY            (optional) read override; defaults to the public baked key
//   DRY_RUN                      '0' = live writes; anything else = dry (default)
//   MAX_ADDITIONS                additions this run (default 10 — keep growth slow)
//   DISCOVER_PAGES               TMDB discover pages to scan (default 3, ~20 shows/page)

const TMDB_KEY = need('TMDB_API_KEY');
const SUPABASE_URL = 'https://fmhmvvsbxofoqriekfyj.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaG12dnNieG9mb3FyaWVrZnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MzQxODMsImV4cCI6MjA5NTUxMDE4M30.py2dCqGmEzHhwAUk2mIPas_cKBk7LpYfNL4BpCUmKrk';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DRY = process.env.DRY_RUN !== '0';
const REGION = 'US';

// ---- Gate constants (tune after the first dry-run) ----
const VOTE_AVG_FLOOR = 7.5;            // TMDB 0-10 acclaim bar
const VOTE_COUNT_FLOOR = 300;          // enough votes that the average is meaningful
const MAX_ADDITIONS = +(process.env.MAX_ADDITIONS || 10);
const DISCOVER_PAGES = +(process.env.DISCOVER_PAGES || 3);

// The 8 subscription services the app filters on, matched by TMDB display name (case-insensitive,
// substring). We resolve these to live TMDB provider_ids at runtime so hardcoded ids can't drift.
const TARGET_PROVIDERS = ['netflix', 'max', 'hbo max', 'disney plus', 'amazon prime video', 'hulu',
  'paramount plus', 'apple tv plus', 'peacock'];
// TMDB watch tiers, cheapest-last so each provider ends tagged with its best (free-est) tier.
const TIER_ORDER = [['buy', 'buy'], ['rent', 'rent'], ['ads', 'ads'], ['free', 'free'], ['flatrate', 'flatrate']];

let tmdbCalls = 0;
function need(k){ const v = process.env[k]; if(!v){ console.error('Missing env ' + k); process.exit(1); } return v; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function tmdb(path, params = {}){
  const u = new URL('https://api.themoviedb.org/3' + path);
  u.searchParams.set('api_key', TMDB_KEY);
  for(const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  tmdbCalls++;
  const r = await fetch(u);
  await sleep(40);                      // be polite to TMDB
  if(!r.ok) return null;
  return r.json();
}

async function existsInCatalog(imdbId){
  const u = SUPABASE_URL + '/rest/v1/movies?select=imdb_id&imdb_id=eq.' + encodeURIComponent(imdbId) + '&limit=1';
  const r = await fetch(u, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
  if(!r.ok) return false;
  return (await r.json()).length > 0;
}

// Resolve the 8 target services to live TMDB provider_ids (for the discover with_watch_providers OR).
async function resolveProviderIds(){
  const j = await tmdb('/watch/providers/tv', { watch_region: REGION });
  const list = (j && j.results) || [];
  const ids = [];
  for(const p of list){
    const name = String(p.provider_name).toLowerCase();
    if(TARGET_PROVIDERS.some(t => name.includes(t))) ids.push(p.provider_id);
  }
  return [...new Set(ids)];
}

function buildStreaming(wp){
  const us = wp && wp.results && wp.results[REGION];
  const streaming = {};
  if(us){ for(const [tmdbTier, tier] of TIER_ORDER){ for(const p of (us[tmdbTier] || [])) streaming[String(p.provider_name).toLowerCase()] = tier; } }
  return streaming;
}

const round1 = n => Math.round(n * 10) / 10;

// Pull every (non-special) season's episode ratings; build the `seasons` JSONB + the rotation stamp.
async function fetchSeasons(tvId, seasonNums){
  const seasons = [];
  for(const n of seasonNums){
    const s = await tmdb('/tv/' + tvId + '/season/' + n);
    if(!s) continue;
    const episodes = [];
    let sum = 0, rated = 0, yr = null;
    for(const e of (s.episodes || [])){
      if(yr == null && e.air_date) yr = +e.air_date.slice(0, 4);
      const ep = { e: e.episode_number, t: e.name || null, air: e.air_date || null };
      const va = +e.vote_average || 0;       // TMDB 0 = unrated -> omit, never store 0
      if(va > 0){ ep.r = round1(va); sum += va; rated++; }
      episodes.push(ep);
    }
    seasons.push({
      n, year: yr, ep_count: episodes.length,
      poster: s.poster_path ? 'https://image.tmdb.org/t/p/w342' + s.poster_path : null,
      score: rated ? round1(sum / rated) : null,
      episodes
    });
  }
  return seasons;
}

async function main(){
  console.log('=== Cinelog TV ingestion ' + (DRY ? '(DRY RUN — no writes)' : '(LIVE)') + ' — TMDB-only ===');
  if(!DRY && !SERVICE){ console.error('LIVE run needs SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

  const providerIds = await resolveProviderIds();
  if(!providerIds.length){ console.error('Could not resolve any target TMDB provider ids — aborting.'); process.exit(1); }
  console.log('resolved ' + providerIds.length + ' subscription provider ids: ' + providerIds.join(',') + '\n');

  // 1. Discover — streaming + acclaim gate enforced INSIDE the query (requirement #1 + quality bar).
  const candidates = [];
  for(let page = 1; page <= DISCOVER_PAGES; page++){
    const d = await tmdb('/discover/tv', {
      watch_region: REGION,
      with_watch_providers: providerIds.join('|'),     // OR — on any of the 8 services
      with_watch_monetization_types: 'flatrate',       // subscription, not rent/buy
      'vote_average.gte': VOTE_AVG_FLOOR,
      'vote_count.gte': VOTE_COUNT_FLOOR,
      sort_by: 'vote_count.desc',                      // well-known acclaimed first
      page
    });
    candidates.push(...((d && d.results) || []));
  }
  console.log('discover candidates: ' + candidates.length + '\n');

  const toAdd = [];
  let dupes = 0, noImdb = 0, belowBar = 0, noSeasons = 0;

  for(const c of candidates){
    if(toAdd.length >= MAX_ADDITIONS) break;
    if((c.vote_average || 0) < VOTE_AVG_FLOOR || (c.vote_count || 0) < VOTE_COUNT_FLOOR){ belowBar++; continue; }

    const det = await tmdb('/tv/' + c.id, { append_to_response: 'external_ids,content_ratings,watch/providers' });
    if(!det){ continue; }
    const imdbId = det.external_ids && det.external_ids.imdb_id;
    if(!imdbId){ noImdb++; continue; }
    if(await existsInCatalog(imdbId)){ dupes++; continue; }

    const realSeasons = (det.seasons || []).filter(s => s.season_number > 0 && (s.episode_count || 0) > 0);
    if(!realSeasons.length){ noSeasons++; continue; }

    const usRating = ((det.content_ratings && det.content_ratings.results) || []).find(x => x.iso_3166_1 === REGION);
    const seasons = await fetchSeasons(c.id, realSeasons.map(s => s.season_number));
    const firstYear = det.first_air_date ? +det.first_air_date.slice(0, 4) : null;
    const lastYear = det.last_air_date ? +det.last_air_date.slice(0, 4) : null;

    toAdd.push({
      imdb_id: imdbId, tmdb_id: c.id, type: 'tv', title: det.name,
      year: firstYear,
      runtime_minutes: (det.episode_run_time && det.episode_run_time.length) ? Math.round(det.episode_run_time.reduce((a, b) => a + b, 0) / det.episode_run_time.length) : null,
      genre: (det.genres || []).map(g => g.name).join(', '),
      plot: det.overview || null,
      original_language: det.original_language || null,
      mpaa_rating: (usRating && usRating.rating) || null,
      imdb_rating: c.vote_average != null ? round1(c.vote_average) : null,   // TMDB 0-10 (rating_src=tmdb)
      vote_count: c.vote_count || null,
      rotten_tomatoes_score: null, metascore: null,                          // v1: no OMDb
      rating_src: 'tmdb',
      popularity: c.popularity,
      poster_url: det.poster_path ? 'https://image.tmdb.org/t/p/w500' + det.poster_path : null,
      streaming: buildStreaming(det['watch/providers']),
      total_seasons: det.number_of_seasons || realSeasons.length,
      first_air_year: firstYear, last_air_year: lastYear,
      seasons,
      source: 'ingest-tv'
    });
  }

  console.log('--- Summary ---');
  console.log('below TMDB bar      : ' + belowBar);
  console.log('no imdb_id          : ' + noImdb);
  console.log('no aired seasons    : ' + noSeasons);
  console.log('already in catalog  : ' + dupes);
  console.log('TMDB calls          : ' + tmdbCalls);
  console.log('would ADD           : ' + toAdd.length + (toAdd.length >= MAX_ADDITIONS ? ' (hit per-run cap)' : ''));
  for(const m of toAdd){
    const seasonScores = m.seasons.map(s => s.score == null ? '–' : s.score).join('/');
    console.log('  + ' + m.title + ' (' + m.first_air_year + ')  tmdb=' + m.imdb_rating + ' votes=' + m.vote_count +
      '  ' + m.total_seasons + ' seasons [' + seasonScores + ']');
  }

  if(DRY){ console.log('\nDRY RUN — nothing written.'); return; }

  // 2. LIVE write — insert via service-role key (bypasses RLS). Requires migration 004 applied.
  const now = new Date().toISOString();
  const rows = toAdd.map(r => ({ ...r, added_at: now, ratings_updated_at: now, streaming_updated_at: now, episodes_updated_at: now }));
  if(!rows.length){ console.log('Nothing to write.'); return; }
  const resp = await fetch(SUPABASE_URL + '/rest/v1/movies', {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  });
  if(!resp.ok){ console.error('Write failed: HTTP ' + resp.status + ' ' + (await resp.text())); process.exit(1); }
  console.log('Wrote ' + rows.length + ' show(s) to the catalog.');
}

main().catch(e => { console.error(e); process.exit(1); });
