# Cinelog TV Ingestion — Spec & Gate

Owner: a `tv-ingestion` agent. Runs as a GitHub Actions cron (Node script) writing to Supabase,
exactly like the film pipeline. **Never runs in the browser; never edits index.html. All app work
happens in `v2.html`.** API keys live as GitHub repo secrets, never committed.

This is the TV counterpart to **`GATE.md`** (films). TV series live in the **same `movies` table**,
distinguished by `type='tv'`, tagged `source='ingest-tv'`. Migration **`migrations/004_tv_support.sql`**
must be applied first.

---

## Goal (what the user asked for)

1. **Mostly streaming.** Only ingest shows currently available on the 8 subscription services the
   app already filters on (Netflix, Max, Disney+, Prime, Hulu, Paramount+, Apple TV+, Peacock).
2. **Overall score + per-season scores**, Rotten-Tomatoes-style (an overall number for the series,
   plus a number for each season).
3. **Per-episode IMDb grid** (a "SeriesGraph"-style dropdown on each TV card showing the IMDb
   rating of every episode).
4. Same app, same Supabase, **no second front-end and no second engine.**

---

## API split — v1 is TMDB-ONLY

v1 uses **TMDB for everything** (zero OMDb). All TV ratings — overall, per-season, and per-episode
— are TMDB's 0-10 `vote_average`. RT/Metacritic are not populated for TV yet. This keeps the first
version cheap and simple; swapping in real IMDb episode ratings (the SeriesGraph ideal) is the
**Deferred** item below, and the schema is source-neutral so that swap is in-place.

- **TMDB** (cheap, high limit) — discovery + structure + streaming + posters + ratings:
  - `/discover/tv` with `watch_region=US` + `with_watch_providers=<the 8 services>` — **the streaming
    gate is built into discovery**, so we only ever see subscription-available shows.
  - `/tv/{id}` — `vote_average` (→ overall `imdb_rating`), `vote_count`, `number_of_seasons`,
    `episode_run_time` (→ `runtime_minutes`), `first_air_date`, `last_air_date`, genres,
    `overview` (→ `plot`), `poster_path`, `external_ids.imdb_id`, `watch/providers` (→ `streaming`).
  - `/tv/{id}/season/{n}` — season `poster_path` + `episodes[]` each with `vote_average`
    (→ episode `r`), `episode_number`, `name`, `air_date`. Feeds the episode grid AND the per-season
    score (= average of that season's episode `vote_average`).
  - `/tv/{id}/content_ratings` — US TV rating (→ `mpaa_rating`), optional.

Set `rating_src='tmdb'` on every TV row so a later swap is auditable.

### Deferred (not in v1) — real IMDb episode ratings via OMDb
The SeriesGraph feature ideally shows the **IMDb** rating of every episode, which TMDB does not
have. Later, an OMDb pass can backfill in place: **1 series call** (`?i=<seriesId>`) → real overall
`imdb_rating`/`vote_count`/`rotten_tomatoes_score`/`metascore`; **1 call per season**
(`?i=<seriesId>&Season=<n>`) → each episode's `imdbRating` into `r`, then flip `rating_src='imdb'`.
Episode ratings are static, so that pass is a one-time backfill under the 900/day OMDb cap. No
schema change needed — `r`, `score`, and the grid UI are already source-neutral.

---

## Addition gate (TV)

Add a series only if it clears **all** of:

1. **Streaming-available** — `/discover/tv` returned it under `with_watch_providers` for one of the
   8 subscription services (US, `flatrate`). (Requirement #1, enforced at discovery.)
2. **Acclaim (TMDB)** — `vote_average >= 7.5` AND `vote_count >= 300` (tune after the first
   dry-run). Keeps TV quality on par with the curated film bar using TMDB's audience scale.
3. **Has resolvable `imdb_id`** (logical key + future OMDb swap) and **>= 1 season aired.**

`/discover/tv` already supports `vote_average.gte` + `vote_count.gte` + sort, so the acclaim gate
can run **inside discovery** — no per-candidate pre-gate call needed.

- Tag every TV insert `source='ingest-tv'`, `type='tv'`.
- **Growth cap:** small per-run cap (start `MAX_ADDITIONS = 10`, like films) so the catalog grows
  slowly and auditable.
- De-dupe against the live catalog by `imdb_id` (a film and a show never share one).

Enrichment, never a gate: language, exact year, franchise, season count.

---

## Column contract (additive — see migration 004)

TV reuses every existing `movies` column. Mapping:

| Column | TV meaning | Source (v1) |
|---|---|---|
| `type` | `'tv'` | pipeline |
| `imdb_rating` | **overall series** score (0-10) | TMDB `vote_average` |
| `vote_count` | overall vote count | TMDB `vote_count` |
| `rotten_tomatoes_score`, `metascore` | **NULL in v1** (no OMDb) | — |
| `rating_src` | `'tmdb'` (provenance for the future swap) | pipeline |
| `genre`, `plot` | series-level | TMDB |
| `mpaa_rating` | US TV rating | TMDB `content_ratings` |
| `runtime_minutes` | **average episode** runtime | TMDB `episode_run_time` |
| `year` | first air year (mirrors `first_air_year`) | TMDB |
| `streaming`, `poster_url`, `original_language` | same as films | TMDB |
| `total_seasons`, `first_air_year`, `last_air_year` | new TV columns | TMDB |
| `seasons` (jsonb) | per-season score + per-episode rating grid | TMDB |
| `episodes_updated_at` | last episode-grid refresh (TV rotation order) | pipeline |

`seasons` JSONB shape is documented in **`migrations/004_tv_support.sql`** (the canonical
definition). Per-season `score` = average of that season's episode `r`; missing/zero episode ratings
are omitted (never stored as 0).

**Frozen film contract is untouched** — no rename/drop. All TV additions are new nullable columns,
so films keep working unchanged.

---

## Budget rules (hard)

- **v1 spends zero OMDb** — TMDB only (high rate limit; just be polite with `sleep` between calls,
  as `refresh.mjs` does).
- TMDB cost per show ≈ 1 discovery page (shared) + 1 `/tv/{id}` + 1 `/tv/{id}/season/{n}` per season
  + 1 `content_ratings`. A show with 5 seasons ≈ 7 TMDB calls. Bounded by `MAX_ADDITIONS` per run.
- Episode-grid refresh: process stalest `episodes_updated_at` first (nulls = never filled), bounded
  per run; in steady state only re-touch in-progress (latest) seasons.
- (Deferred OMDb pass, when added: hard stop **900 OMDb calls/day**, shared with the film pipeline —
  schedule on different days or coordinate the daily counter.)

---

## App integration (Phase 3/4 — hard constraints)

- **One reusable engine.** TV rows carry engine-compatible rating columns, so `getRecs` scores them
  unchanged. The **Movies/TV toggle** simply adds a `type=eq.movie` / `type=eq.tv` filter to the
  candidate query (`buildQuery` in v2.html). **Do not change the scoring math** (engine is protected
  per CLAUDE.md / SCORING.md); movies and TV are ranked in **separate** pools, never interleaved, so
  their rating scales never need to match.
- **No added page height.** The toggle must reuse existing real estate (fold into an existing
  segmented control / the title row) and add **zero vertical height** — the homepage one-screen
  wizard (Title → Quick Filters → Recommendation Mode → Find My Movie) must still fit **without
  scrolling** on iPhone. No new row.
- **Episode grid = a dropdown on the TV card / detail modal**, not a new screen. Built from
  `seasons[].episodes[].imdb` (SeriesGraph-style: seasons as columns/rows, color-graded by rating).
  Collapsed by default; reuses the existing modal, gold/dark theme, and CSS variables. A season
  selector switches which season's grid + score is shown.
- Reuse the existing poster grid (`.rg-grid`/`.rg-tile`), the streaming filter (TV `streaming` JSONB
  is identical), and `openMovieDetail(m)` (branch on `m.type === 'tv'` for the season/episode UI).

---

## Build status

- [ ] Migration 004 (additive TV columns + indexes) — apply in Supabase SQL editor
- [ ] `pipeline/ingest-tv.mjs` — TMDB streaming+acclaim-gated `/discover/tv` → `/tv/{id}` (+seasons)
      → insert `type='tv'`, `rating_src='tmdb'` (DRY-RUN first)
- [ ] `pipeline/refresh-tv.mjs` — TMDB streaming sweep + episode-grid refresh for TV rows
      (stalest `episodes_updated_at` first)
- [ ] GitHub Actions workflow + reuse existing secrets (`TMDB_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] v2.html: Movies/TV toggle (zero added height) + `getRecs` candidate `type` filter
- [ ] v2.html: season selector + SeriesGraph-style episode-rating dropdown in `openMovieDetail`
- [ ] **Deferred:** OMDb swap for real IMDb episode + overall ratings (flip `rating_src='imdb'`)
