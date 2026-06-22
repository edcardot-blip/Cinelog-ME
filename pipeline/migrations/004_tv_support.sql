-- 004_tv_support.sql
-- Additive only. Safe to run on the live `movies` table (no data loss, no renames, no frozen
-- column touched). Enables TV-series rows alongside films in the SAME table, distinguished by
-- the already-existing `type` column ('movie' | 'tv'). Run in the Supabase SQL editor before
-- the TV ingestion pipeline writes for the first time. See pipeline/GATE-TV.md.
--
-- Design recap (full spec in GATE-TV.md):
--   * TV rows reuse every existing `movies` column. v1 is TMDB-ONLY: overall `imdb_rating` holds
--     TMDB's 0-10 `vote_average` and `vote_count` holds TMDB's vote count. `rotten_tomatoes_score`
--     and `metascore` stay NULL for TV in v1 (no OMDb). A TV row still scores through the
--     protected getRecs engine like a film, just on TMDB's audience scale.
--     (Future: swap in real IMDb/RT/Meta via OMDb — the schema below is source-neutral so that
--     swap is in-place; see GATE-TV.md "Deferred".)
--   * `runtime_minutes` for TV = average episode runtime (TMDB). `year` = first air year.
--   * `genre`, `plot`, `mpaa_rating`, `poster_url`, `streaming` populate as normal (TMDB).
--   * Per-season scores + the per-episode rating grid live in the new `seasons` JSONB (below).

-- `type` already exists on the table (legacy default 'movie'). Make the default explicit and
-- backfill any nulls so the Movies/TV toggle's `type=eq.movie` filter never drops a film.
alter table movies alter column type set default 'movie';
update movies set type = 'movie' where type is null;

-- TV-specific top-level columns (all nullable for film rows).
alter table movies add column if not exists total_seasons    integer;  -- TMDB/OMDb season count
alter table movies add column if not exists first_air_year    integer;  -- year of S1 premiere (mirrors `year`)
alter table movies add column if not exists last_air_year     integer;  -- year of most recent season
alter table movies add column if not exists seasons           jsonb default '[]'::jsonb; -- per-season + per-episode data (see below)
alter table movies add column if not exists episodes_updated_at timestamptz; -- last episode-grid refresh (drives TV rotation)
alter table movies add column if not exists rating_src        text;     -- provenance of TV ratings: 'tmdb' (v1) | 'imdb' (future OMDb swap)

-- Speeds up the Movies/TV toggle (candidate queries gain a `type=eq.<...>` filter).
create index if not exists movies_type_idx on movies (type);

-- Rotating TV refresh: backfill/refresh the stalest episode grids first (nulls = never filled).
create index if not exists movies_episodes_updated_at_idx on movies (episodes_updated_at nulls first);

-- ---------------------------------------------------------------------------
-- `seasons` JSONB shape (written by the TV pipeline, read by the detail modal):
--
-- [
--   {
--     "n": 1,                         -- season number
--     "year": 2008,                   -- season premiere year
--     "ep_count": 7,                  -- episodes in this season
--     "poster": "https://image.tmdb.org/t/p/w342/...",  -- season poster (TMDB), nullable
--     "score": 8.9,                   -- RT-style season score = avg of this season's episode `r` (0-10)
--     "episodes": [
--       { "e": 1, "t": "Pilot",       "r": 8.9, "air": "2008-01-20" },
--       { "e": 2, "t": "Cat's...",    "r": 8.7, "air": "2008-01-27" }
--     ]
--   }
-- ]
--
-- Notes:
--   * `r` is the per-episode rating (0-10). Source-neutral by design: v1 fills it with TMDB
--     episode `vote_average` (row-level `rating_src='tmdb'`). A future OMDb swap backfills `r`
--     with the real IMDb episode rating in place and flips `rating_src='imdb'` — the grid UI just
--     reads `r`, so nothing downstream changes.
--   * `score` is the per-season aggregate the card's season selector shows; the episode grid
--     dropdown (SeriesGraph-style) is built from `episodes[].r`.
--   * Missing/zero episode rating (TMDB vote_average 0 = unrated) -> omit `r` for that episode;
--     the grid renders it as a blank/!rated cell. Never store 0 for a missing rating.
-- ---------------------------------------------------------------------------
