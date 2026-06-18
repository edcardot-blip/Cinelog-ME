# Cinelog Catalog Ingestion — Spec & Gate

Owner: `catalog-ingestion` agent. Runs as a daily GitHub Actions cron (Node script) writing to
Supabase. **Never runs in the browser; never edits index.html.** API keys live as GitHub repo
secrets, never committed.

## Existing catalog (profiled 2026-06-17, 4,731 films)
The bar that produced the current catalog is, in practice:
- **vote_count ≥ ~12,000** (hard floor — min observed 11,826, nothing below 10k). This is THE gate.
- **imdb_rating present** (99.98% of rows). No value floor — films down to 2.1 are included.
- RT present ~96%, Metascore ~94% — common but NOT required.
- year: no cutoff (1915–2026). original_language: 9.7% non-English — foreign films allowed.
- streaming: JSONB provider map, populated on ~61%. franchise: ~3%. Both optional, never gated.

## Addition gate (LOCKED)
Add a film only if it clears one path. Cap: **< 500 additions total, ever.**

1. **Mature path:** `vote_count ≥ 12,000` AND `imdb_rating` not null. (Matches existing bar.)
2. **Early path (new theatrical):** currently/recently in theaters AND
   (**blockbuster:** high TMDB revenue/popularity) OR
   (**acclaimed:** RT ≥ 80 OR Metascore ≥ 70 from OMDb).
   Bypasses the vote floor; rotating refresh fills votes over time.
   Tag `source='ingest-theatrical'`; mature-path inserts use `source='ingest-mature'`.

Enrichment, never a gate: RT/Meta presence, language, year, streaming, franchise.

### One-off backfills (scoped, outside the locked gate)
Targeted catalog gaps can be filled by a dedicated script with its OWN looser bar, tagged with a
distinct `source` so it's auditable and never confused with the daily gate.
- **Streaming-service originals** (`pipeline/streaming-originals.mjs`, workflow
  `streaming-originals.yml`, manual dispatch, dry-run by default). The subscription filters were
  near-empty for service originals. TMDB has no reliable "original" flag and company-based
  discovery proved skewed/incomplete, so this uses **hand-picked title+year seed lists per
  service** (the originals genuinely worth recommending — ~190 titles across the 8 services).
  Each is resolved to the correct film via TMDB search (no hand-typed IMDb IDs), enriched with
  OMDb ratings + metadata + poster, **force-tagged** to its service's streaming key so it shows
  under that subscription filter, and **deduped** against the live catalog by imdb_id. Tag
  `source='ingest-originals'`. Curate the seed lists by hand to add/remove titles. (~190 OMDb
  calls, well under budget.) The `services` input limits which services run.

## API split
- **TMDB** = discovery + streaming (cheap, high limit). `now_playing` (US), movie details
  (popularity/revenue/votes), `watch/providers`. Streaming "left a service" = overwrite stored
  providers with current TMDB list each run.
- **OMDb** = ratings ONLY (scarce: 1000 req/day). One call → IMDb + RT + Metacritic.

## Budget rules (hard)
- Spend OMDb ONLY on titles that already passed the cheap TMDB gate.
- Hard stop at **900 OMDb calls/day** (persistent daily counter).
- Streaming refresh is TMDB-only (zero OMDb cost) — daily full sweep is fine.
- Ratings refresh: oldest `ratings_updated_at` first; a ~1–2 week full cycle over 4,731 rows
  costs well under budget (~400–700/day).

## Frozen column contract (the app READS these — never rename/drop)
imdb_id, title, year, runtime_minutes, genre, director, actors, imdb_rating,
rotten_tomatoes_score, metascore, poster_url, vote_count, original_language, mpaa_rating,
franchise, streaming. Pipeline may ADD columns (see migration 001) and WRITE values.

## Build status
- [x] Task 1 — profile existing catalog (done; this doc)
- [x] migration 001 (additive columns) — apply in Supabase SQL editor
- [ ] Task 2 — discovery + gate + OMDb-budgeted enrichment insert (DRY-RUN first)  ← needs TMDB + OMDb keys
- [ ] Task 3 — rotating ratings refresh + daily TMDB streaming sweep + budget guard
- [ ] GitHub Actions cron + secrets
