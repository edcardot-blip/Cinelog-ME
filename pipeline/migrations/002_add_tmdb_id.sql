-- 002_add_tmdb_id.sql
-- Additive. Caches each film's TMDB id so the streaming refresh doesn't have to
-- resolve imdb_id -> tmdb_id on every run (resolve once, store, reuse).
-- Run in the Supabase SQL editor before the first streaming sweep.

alter table movies add column if not exists tmdb_id bigint;

-- Speeds up the "refresh the stalest first" selection used by refresh.mjs.
create index if not exists movies_streaming_updated_at_idx on movies (streaming_updated_at nulls first);
