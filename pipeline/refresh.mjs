// Cinelog catalog REFRESH — streaming availability (TMDB) + ratings rotation (OMDb).
// Both process the STALEST rows first, so repeated runs rotate the whole catalog.
// DRY_RUN defaults ON: prints what it WOULD change and writes nothing. See pipeline/GATE.md.
//
// Env:
//   TMDB_API_KEY                 (required) streaming providers + imdb->tmdb resolve
//   OMDB_API_KEY                 (required) ratings
//   SUPABASE_SERVICE_ROLE_KEY    (live only) writes to `movies`
//   SUPABASE_ANON_KEY            (optional) read override; defaults to the public baked key
//   DRY_RUN                      '0' = live writes; anything else = dry (default)
//   STREAMING_BATCH              films to refresh streaming for this run (default 2500)
//   RATINGS_BATCH                films to refresh ratings for this run (default 500)

const TMDB_KEY = need('TMDB_API_KEY');
const OMDB_KEY = need('OMDB_API_KEY');
const SUPABASE_URL = 'https://fmhmvvsbxofoqriekfyj.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaG12dnNieG9mb3FyaWVrZnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MzQxODMsImV4cCI6MjA5NTUxMDE4M30.py2dCqGmEzHhwAUk2mIPas_cKBk7LpYfNL4BpCUmKrk';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DRY = process.env.DRY_RUN !== '0';
const REGION = 'US';
const STREAMING_BATCH = +(process.env.STREAMING_BATCH || 2500);
const RATINGS_BATCH = +(process.env.RATINGS_BATCH || 500);
const OMDB_DAILY_CAP = 950;            // hard safety stop (RATINGS_BATCH should be well under this)
// TMDB tiers processed cheapest-last so a provider ends up tagged with its best (free-est) tier.
const TIER_ORDER = [['buy', 'buy'], ['rent', 'rent'], ['ads', 'ads'], ['free', 'free'], ['flatrate', 'flatrate']];

let omdbSpent = 0, tmdbCalls = 0;

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

async function resolveTmdbId(imdbId){
  const j = await tmdb('/find/' + encodeURIComponent(imdbId), { external_source: 'imdb_id' });
  const hit = j && j.movie_results && j.movie_results[0];
  return hit ? hit.id : null;
}

async function detailsAndStreaming(tmdbId){
  // One call returns movie details (poster_path) + watch providers, so we refresh the streaming
  // map AND migrate posters to TMDB — many original posters are dead Amazon (m.media-amazon) URLs.
  const j = await tmdb('/movie/' + tmdbId, { append_to_response: 'watch/providers' });
  if(!j) return { streaming: {}, poster: null };
  const wp = j['watch/providers'];
  const us = wp && wp.results && wp.results[REGION];
  const streaming = {};
  if(us){ for(const [tmdbTier, tier] of TIER_ORDER){ for(const p of (us[tmdbTier] || [])) streaming[String(p.provider_name).toLowerCase()] = tier; } }
  const poster = j.poster_path ? ('https://image.tmdb.org/t/p/w500' + j.poster_path) : null;
  return { streaming, poster };
}

async function omdb(imdbId){
  if(omdbSpent >= OMDB_DAILY_CAP) return null;
  omdbSpent++;
  const u = new URL('https://www.omdbapi.com/');
  u.searchParams.set('apikey', OMDB_KEY);
  u.searchParams.set('i', imdbId);
  const r = await fetch(u);
  await sleep(30);
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

async function supaGet(qs){
  const r = await fetch(SUPABASE_URL + '/rest/v1/movies?' + qs, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
  if(!r.ok) throw new Error('Supabase read failed: HTTP ' + r.status);
  return r.json();
}
// PostgREST caps each response at 1000 rows; page through with offset to gather up to `max`.
// All reads happen before any writes, so the stalest-first ordering stays stable mid-sweep.
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

async function refreshStreaming(){
  console.log('\n--- Streaming refresh (stalest ' + STREAMING_BATCH + ' first) ---');
  const films = await supaGetPaged('select=imdb_id,tmdb_id&order=streaming_updated_at.asc.nullsfirst', STREAMING_BATCH);
  let resolved = 0, unresolved = 0, updated = 0, sampleShown = 0;
  const now = new Date().toISOString();
  for(const f of films){
    let tid = f.tmdb_id;
    if(!tid){
      tid = await resolveTmdbId(f.imdb_id);
      if(tid){ resolved++; await supaPatch(f.imdb_id, { tmdb_id: tid }); }
      else { unresolved++; continue; }
    }
    const { streaming, poster } = await detailsAndStreaming(tid);
    const patch = { streaming, streaming_updated_at: now };
    if(poster) patch.poster_url = poster;   // migrate to a reliable TMDB poster
    const ok = await supaPatch(f.imdb_id, patch);
    if(ok) updated++;
    if(sampleShown < 5){ console.log('  ~ ' + f.imdb_id + ' -> ' + Object.keys(streaming).length + ' providers' + (poster ? ', poster ok' : ', no tmdb poster')); sampleShown++; }
  }
  console.log('streaming: updated ' + updated + ', newly-resolved tmdb_id ' + resolved + ', unresolved ' + unresolved + ', TMDB calls ' + tmdbCalls);
}

async function refreshRatings(){
  console.log('\n--- Ratings refresh (stalest ' + RATINGS_BATCH + ' first, OMDb cap ' + OMDB_DAILY_CAP + ') ---');
  const films = await supaGetPaged('select=imdb_id&order=ratings_updated_at.asc.nullsfirst', RATINGS_BATCH);
  let updated = 0, missed = 0, sampleShown = 0;
  const now = new Date().toISOString();
  for(const f of films){
    if(omdbSpent >= OMDB_DAILY_CAP){ console.log('  ! OMDb cap reached'); break; }
    const o = await omdb(f.imdb_id);
    if(!o){ missed++; continue; }
    const r = omdbRatings(o);
    const ok = await supaPatch(f.imdb_id, { imdb_rating: r.imdb, rotten_tomatoes_score: r.rt, metascore: r.meta, vote_count: r.votes, ratings_updated_at: now });
    if(ok) updated++;
    if(sampleShown < 5){ console.log('  ~ ' + f.imdb_id + '  imdb=' + r.imdb + ' rt=' + r.rt + ' meta=' + r.meta); sampleShown++; }
  }
  console.log('ratings: updated ' + updated + ', no-OMDb-data ' + missed + ', OMDb spent ' + omdbSpent);
}

async function main(){
  console.log('=== Cinelog refresh ' + (DRY ? '(DRY RUN — no writes)' : '(LIVE)') + ' ===');
  if(!DRY && !SERVICE){ console.error('LIVE run needs SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  await refreshStreaming();
  await refreshRatings();
  console.log('\nDone' + (DRY ? ' (DRY RUN — nothing written).' : '.'));
}

main().catch(e => { console.error(e); process.exit(1); });
