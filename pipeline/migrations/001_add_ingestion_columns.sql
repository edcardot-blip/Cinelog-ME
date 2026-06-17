-- 001_add_ingestion_columns.sql
-- Additive only. Safe to run on the live `movies` table (no data loss, no renames).
-- Run this in the Supabase SQL editor before the ingestion pipeline writes for the first time.
--
-- NOTE: PostgREST reports an existing column `streaming_updated` (no _at suffix) on the
-- table. We do NOT touch it here. The pipeline will standardize on `streaming_updated_at`;
-- reconcile/migrate the old column separately once the pipeline is live.

alter table movies add column if not exists popularity            double precision; -- TMDB popularity at last refresh
alter table movies add column if not exists release_date          date;             -- theatrical release date (TMDB)
alter table movies add column if not exists added_at              timestamptz default now(); -- when the pipeline inserted this row
alter table movies add column if not exists ratings_updated_at    timestamptz;      -- last OMDb ratings refresh (drives rotation)
alter table movies add column if not exists streaming_updated_at  timestamptz;      -- last TMDB watch/providers refresh
alter table movies add column if not exists source                text;            -- e.g. 'ingest-theatrical' | 'ingest-mature' | 'original'

-- Helpful index for the rotating ratings refresh (oldest-first selection).
create index if not exists movies_ratings_updated_at_idx on movies (ratings_updated_at nulls first);
