// Cinelog catalog ingestion — ADD path (discovery -> gate -> OMDb-budgeted enrichment).
// DRY_RUN defaults to ON: it prints what it WOULD add and writes nothing.
// Design + locked gate: see pipeline/GATE.md.  Runs on Node 20 (global fetch).
//
// Env:
//   TMDB_API_KEY                 (required) discovery + details
//   OMDB_API_KEY                 (required) ratings (the scarce 1000/day budget)
//   SUPABASE_SERVICE_ROLE_KEY    (live only) writes to `movies`
//   SUPABASE_ANON_KEY            (optional) read override; defaults to the public baked key
//   DRY_RUN                      '0' = live writes; anything else = dry (default)

const TMDB_KEY = need('TMDB_API_KEY');
const OMDB_KEY = need('OMDB_API_KEY');
const SUPABASE_URL = 'https://fmhmvvsbxofoqriekfyj.supabase.co';
// The anon key is public (it's already in index.html) and only used here for READS.
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaG12dnNieG9mb3FyaWVrZnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MzQxODMsImV4cCI6MjA5NTUxMDE4M30.py2dCqGmEzHhwAUk2mIPas_cKBk7LpYfNL4BpCUmKrk';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DRY = process.env.DRY_RUN !== '0';
const REGION = 'US';

// ---- Gate constants (tune after the first dry-run) ----
const VOTE_FLOOR = 12000;              // mature-path qualify (matches existing catalog bar)
const ACCLAIM_RT = 80, ACCLAIM_META = 70;   // critically-acclaimed final gate (early path)
const ACCLAIM_TMDB_VOTE = 7.0, ACCLAIM_TMDB_MINVOTES = 200;  // cheap acclaim proxy
const NOTABLE_POP = 80;                // cheap-gate: popular enough to be worth an OMDb look
const OMDB_DAILY_CAP = 900;            // hard budget stop (headroom under 1000)
const MAX_ADDITIONS = 10;              // additions per run (keep growth slow)

let omdbSpent = 0;

function need(k){ const v = process.env[k]; if(!v){ console.error('Missing env '+k); process.exit(1); } return v; }

async function tmdb(path, params = {}){
  const u = new URL('https://api.themoviedb.org/3' + path);
  u.searchParams.set('api_key', TMDB_KEY);
  for(const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u);
  if(!r.ok) throw new Error('TMDB ' + path + ' -> HTTP ' + r.status);
  return r.json();
}

async function omdb(imdbId){
  if(omdbSpent >= OMDB_DAILY_CAP){ console.warn('  ! OMDb budget cap reached; skipping ' + imdbId); return null; }
  omdbSpent++;
  const u = new URL('https://www.omdbapi.com/');
  u.searchParams.set('apikey', OMDB_KEY);
  u.searchParams.set('i', imdbId);
  const r = await fetch(u);
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

async function existsInCatalog(imdbId){
  const u = SUPABASE_URL + '/rest/v1/movies?select=imdb_id&imdb_id=eq.' + encodeURIComponent(imdbId) + '&limit=1';
  const r = await fetch(u, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
  if(!r.ok) return false;
  return (await r.json()).length > 0;
}

async function main(){
  console.log('=== Cinelog ingestion ' + (DRY ? '(DRY RUN — no writes)' : '(LIVE)') + ' ===');
  if(!DRY && !SERVICE){ console.error('LIVE run needs SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

  // 1. Discover — TMDB now_playing (US), first 2 pages (~40 films).
  const candidates = [];
  for(let page = 1; page <= 2; page++){
    const np = await tmdb('/movie/now_playing', { region: REGION, page });
    candidates.push(...(np.results || []));
  }
  console.log('now_playing candidates: ' + candidates.length + '\n');

  const toAdd = [];
  let cheapRejected = 0, dupes = 0, finalRejected = 0, noImdb = 0;

  for(const c of candidates){
    if(toAdd.length >= MAX_ADDITIONS) break;
    // 2. Cheap TMDB pre-gate — its ONLY job is to avoid wasting OMDb on clearly-irrelevant
    // films; stay GENEROUS (budget is ample) and let the strict final gate decide. TMDB
    // popularity OR a decent vote_average makes a film worth one OMDb look. (Note: TMDB
    // vote_count is a different scale than IMDb votes, so it's NOT used as a mature-path proxy.)
    const acclaimedish = (c.vote_average || 0) >= ACCLAIM_TMDB_VOTE && (c.vote_count || 0) >= ACCLAIM_TMDB_MINVOTES;
    const notable = (c.popularity || 0) >= NOTABLE_POP;
    if(!acclaimedish && !notable){ cheapRejected++; continue; }

    const det = await tmdb('/movie/' + c.id, { append_to_response: 'external_ids' });
    const imdbId = det.external_ids && det.external_ids.imdb_id;
    if(!imdbId){ noImdb++; continue; }
    if(await existsInCatalog(imdbId)){ dupes++; continue; }

    // 3. OMDb enrich (budgeted) — survivors only.
    const o = await omdb(imdbId);
    const r = o ? omdbRatings(o) : { imdb: null, rt: null, meta: null, votes: null };

    // 4. Final gate (LOCKED: acclaim-required) — mature (>=12k votes) OR critically acclaimed
    // (RT>=80 or Meta>=70). The blockbuster-alone path was dropped so popular-but-mediocre
    // films don't get in. imdb_rating must be present either way.
    const matureQualify = (r.votes || 0) >= VOTE_FLOOR && r.imdb != null;
    const acclaimed = (r.rt != null && r.rt >= ACCLAIM_RT) || (r.meta != null && r.meta >= ACCLAIM_META);
    if(!((matureQualify || acclaimed) && r.imdb != null)){ finalRejected++; continue; }

    toAdd.push({
      imdb_id: imdbId, title: det.title,
      year: det.release_date ? +det.release_date.slice(0, 4) : null,
      runtime_minutes: det.runtime || null,
      genre: (det.genres || []).map(g => g.name).join(', '),
      imdb_rating: r.imdb, rotten_tomatoes_score: r.rt, metascore: r.meta, vote_count: r.votes,
      popularity: c.popularity, revenue: det.revenue, release_date: det.release_date || null,
      original_language: det.original_language || null,
      poster_url: det.poster_path ? 'https://image.tmdb.org/t/p/w500' + det.poster_path : null,
      source: matureQualify ? 'ingest-mature' : 'ingest-theatrical',
      _path: matureQualify ? 'mature' : 'early',
      _why: matureQualify ? 'votes>=12k' : 'acclaimed'
    });
  }

  console.log('--- Summary ---');
  console.log('cheap-gate rejected : ' + cheapRejected);
  console.log('no imdb_id          : ' + noImdb);
  console.log('already in catalog  : ' + dupes);
  console.log('final-gate rejected : ' + finalRejected);
  console.log('OMDb calls spent    : ' + omdbSpent + ' / cap ' + OMDB_DAILY_CAP);
  console.log('would ADD           : ' + toAdd.length + (MAX_ADDITIONS && toAdd.length >= MAX_ADDITIONS ? ' (hit per-run cap)' : ''));
  for(const m of toAdd){
    console.log('  + ' + m.title + ' (' + m.year + ')  imdb=' + m.imdb_rating +
      ' rt=' + m.rotten_tomatoes_score + ' meta=' + m.metascore + ' votes=' + m.vote_count +
      '  [' + m._path + ': ' + m._why + ']');
  }

  if(DRY){ console.log('\nDRY RUN — nothing written.'); return; }

  // 5. LIVE write — insert via service-role key (bypasses RLS). Requires migration 001 applied.
  const rows = toAdd.map(({ _path, _why, ...row }) => ({ ...row, added_at: new Date().toISOString(), ratings_updated_at: new Date().toISOString() }));
  if(!rows.length){ console.log('Nothing to write.'); return; }
  const resp = await fetch(SUPABASE_URL + '/rest/v1/movies', {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  });
  if(!resp.ok){ console.error('Write failed: HTTP ' + resp.status + ' ' + (await resp.text())); process.exit(1); }
  console.log('Wrote ' + rows.length + ' film(s) to the catalog.');
}

main().catch(e => { console.error(e); process.exit(1); });
