// Cinelog TV REFRESH (TMDB-only) — re-pulls streaming availability + the per-season episode grid
// for existing type='tv' rows, STALEST `episodes_updated_at` first so repeated runs rotate the
// whole TV catalog. DRY_RUN defaults ON. See pipeline/GATE-TV.md. v1 spends ZERO OMDb.
//
// Env:
//   TMDB_API_KEY                 (required) details + seasons + providers
//   SUPABASE_SERVICE_ROLE_KEY    (live only) writes to `movies`
//   SUPABASE_ANON_KEY            (optional) read override; defaults to the public baked key
//   DRY_RUN                      '0' = live writes; anything else = dry (default)
//   TV_BATCH                     shows to refresh this run (default 200)

const TMDB_KEY = need('TMDB_API_KEY');
const SUPABASE_URL = 'https://fmhmvvsbxofoqriekfyj.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaG12dnNieG9mb3FyaWVrZnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MzQxODMsImV4cCI6MjA5NTUxMDE4M30.py2dCqGmEzHhwAUk2mIPas_cKBk7LpYfNL4BpCUmKrk';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DRY = process.env.DRY_RUN !== '0';
const REGION = 'US';
const TV_BATCH = +(process.env.TV_BATCH || 200);
const TIER_ORDER = [['buy', 'buy'], ['rent', 'rent'], ['ads', 'ads'], ['free', 'free'], ['flatrate', 'flatrate']];

let tmdbCalls = 0;
function need(k){ const v = process.env[k]; if(!v){ console.error('Missing env ' + k); process.exit(1); } return v; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const round1 = n => Math.round(n * 10) / 10;

async function tmdb(path, params = {}){
  const u = new URL('https://api.themoviedb.org/3' + path);
  u.searchParams.set('api_key', TMDB_KEY);
  for(const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  tmdbCalls++;
  const r = await fetch(u);
  await sleep(40);
  if(!r.ok) return null;
  return r.json();
}

async function resolveTmdbId(imdbId){
  const j = await tmdb('/find/' + encodeURIComponent(imdbId), { external_source: 'imdb_id' });
  const hit = j && j.tv_results && j.tv_results[0];
  return hit ? hit.id : null;
}

function buildStreaming(wp){
  const us = wp && wp.results && wp.results[REGION];
  const streaming = {};
  if(us){ for(const [tmdbTier, tier] of TIER_ORDER){ for(const p of (us[tmdbTier] || [])) streaming[String(p.provider_name).toLowerCase()] = tier; } }
  return streaming;
}

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
      const va = +e.vote_average || 0;
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

async function supaGet(qs){
  const r = await fetch(SUPABASE_URL + '/rest/v1/movies?' + qs, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
  if(!r.ok) throw new Error('Supabase read failed: HTTP ' + r.status);
  return r.json();
}
async function supaGetPaged(baseQs, max){
  const pageSize = 1000, out = [];
  while(out.length < max){
    const lim = Math.min(pageSize, max - out.length);
    const rows = await supaGet(baseQs + '&offset=' + out.length + '&limit=' + lim);
    if(!rows.length) break;
    out.push(...rows);
    if(rows.length < lim) break;
  }
  return out;
}
async function supaPatch(imdbId, body){
  if(DRY) return true;
  const r = await fetch(SUPABASE_URL + '/rest/v1/movies?imdb_id=eq.' + encodeURIComponent(imdbId), {
    method: 'PATCH',
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body)
  });
  if(!r.ok){ console.error('  ! patch ' + imdbId + ' failed: HTTP ' + r.status + ' ' + (await r.text())); return false; }
  return true;
}

async function main(){
  console.log('=== Cinelog TV refresh ' + (DRY ? '(DRY RUN — no writes)' : '(LIVE)') + ' — TMDB-only ===');
  if(!DRY && !SERVICE){ console.error('LIVE run needs SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

  console.log('\n--- TV refresh (stalest ' + TV_BATCH + ' first) ---');
  const shows = await supaGetPaged("select=imdb_id,tmdb_id&type=eq.tv&order=episodes_updated_at.asc.nullsfirst", TV_BATCH);
  let updated = 0, unresolved = 0, sampleShown = 0;
  const now = new Date().toISOString();

  for(const f of shows){
    let tid = f.tmdb_id;
    if(!tid){
      tid = await resolveTmdbId(f.imdb_id);
      if(tid){ await supaPatch(f.imdb_id, { tmdb_id: tid }); }
      else { unresolved++; continue; }
    }
    const det = await tmdb('/tv/' + tid, { append_to_response: 'watch/providers' });
    if(!det){ unresolved++; continue; }
    const realSeasons = (det.seasons || []).filter(s => s.season_number > 0 && (s.episode_count || 0) > 0);
    const seasons = await fetchSeasons(tid, realSeasons.map(s => s.season_number));

    const patch = {
      streaming: buildStreaming(det['watch/providers']),
      streaming_updated_at: now,
      seasons,
      total_seasons: det.number_of_seasons || realSeasons.length,
      last_air_year: det.last_air_date ? +det.last_air_date.slice(0, 4) : null,
      imdb_rating: det.vote_average != null ? round1(det.vote_average) : null,   // keep TMDB overall fresh
      vote_count: det.vote_count || null,
      episodes_updated_at: now
    };
    if(det.poster_path) patch.poster_url = 'https://image.tmdb.org/t/p/w500' + det.poster_path;
    const ok = await supaPatch(f.imdb_id, patch);
    if(ok) updated++;
    if(sampleShown < 5){ console.log('  ~ ' + f.imdb_id + ' -> ' + seasons.length + ' seasons, ' + Object.keys(patch.streaming).length + ' providers'); sampleShown++; }
  }
  console.log('TV: updated ' + updated + ', unresolved ' + unresolved + ', TMDB calls ' + tmdbCalls);
  console.log('\nDone' + (DRY ? ' (DRY RUN — nothing written).' : '.'));
}

main().catch(e => { console.error(e); process.exit(1); });
