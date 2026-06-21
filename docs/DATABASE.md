# CINELOG — Database Reference

> Complete reference for CINELOG's **Supabase** (PostgreSQL + PostgREST) backend — every table,
> every column, types, meaning, relationships, auth/RLS, the JSONB streaming shape, indexes, the
> catalog's real inclusion bar, and known limitations. Detailed enough to rebuild the schema.
>
> Sources: the live database (queried via the public anon key), `pipeline/GATE.md` (the frozen
> column contract + inclusion gate), `pipeline/migrations/*.sql`, `pipeline/ingest.mjs`,
> `pipeline/refresh.mjs`, and the data layer in `v2.html`.

**Project:** `https://fmhmvvsbxofoqriekfyj.supabase.co` · ref `fmhmvvsbxofoqriekfyj`
**REST base:** `https://fmhmvvsbxofoqriekfyj.supabase.co/rest/v1/` (PostgREST)

---

## 1. Overview

CINELOG has **two tables**:

| Table | Rows (2026-06-17) | Access | Purpose |
|---|---|---|---|
| **`movies`** | **4,734** | Public read (anon key) | The curated film catalog — metadata, ratings, streaming. |
| **`user_movies`** | per-user | RLS to `auth.uid()` | Per-user lists: Seen, Like (favorite), Watchlist, Hidden (not_interested). |

The catalog is shared and identical across both front-ends (`index.html` and `v2.html`). Only the
personal lists are user-scoped.

---

## 2. Supabase setup & access

- **Anon (public) key** is baked into the app (`BAKED_SB_KEY` in `v2.html`). It is **safe to
  expose** because Row Level Security is enabled — the catalog is public-read and personal data is
  RLS-gated. Two ways the app talks to Supabase:
  - **Raw PostgREST `fetch`** with `apikey` + `Authorization: Bearer <anon>` headers
    (`sbHeaders()`) — used for catalog reads (`getRecs`, `getRandom`, Trending, `fetchMoviesByIds`).
  - **`@supabase/supabase-js` client** (`sbAuth`) carrying the signed-in user's JWT — used for all
    `user_movies` reads/writes so RLS sees `auth.uid()`.
- **Auth:** Google OAuth via Supabase Auth (`detectSessionInUrl`, `persistSession`,
  `autoRefreshToken`). The GitHub Pages URL must be registered in Supabase → Auth → redirect URLs.
- **Pipeline writes** use the `SUPABASE_SERVICE_ROLE_KEY` (a GitHub Actions secret, never committed),
  which bypasses RLS to insert/update `movies`.

Quick read (public, no login):
```bash
curl 'https://fmhmvvsbxofoqriekfyj.supabase.co/rest/v1/movies?select=*&limit=1' \
  -H 'apikey: <ANON_KEY>' -H 'Authorization: Bearer <ANON_KEY>'
```

---

## 3. Table: `movies`

The catalog. The app **reads** these columns; the pipeline **writes** them. Below, columns are
grouped by role. The **frozen column contract** (GATE.md — never rename/drop, the app reads them)
is marked **[frozen]**.

### 3.1 Identity & core metadata

| Column | Type | Meaning |
|---|---|---|
| `id` | bigint (PK, identity) | Surrogate primary key (Supabase default). Not used by the app's logic. |
| `imdb_id` **[frozen]** | text | IMDb id, e.g. `tt0111161`. The **logical key** — every `user_movies` row, dedup, and exposure map is keyed on it. Unique. |
| `tmdb_id` | bigint | Cached TMDB id, so the streaming refresh need not re-resolve `imdb_id → tmdb_id` each run. Added in migration 002. |
| `title` **[frozen]** | text | Film title. |
| `year` **[frozen]** | integer | Release year. Drives era filters & recency. Catalog range **1915–2026**. Nullable. |
| `runtime_minutes` **[frozen]** | integer | Runtime in minutes. Drives length filters & `fitScore`. Nullable (null always passes length filter). |
| `genre` **[frozen]** | text | Comma-separated, **primary genre first** (OMDb order), e.g. `"Action, Crime, Drama"`. Position matters for `genreScore`. |
| `director` **[frozen]** | text | Director(s). |
| `actors` **[frozen]** | text | Top-billed cast, comma-separated. |
| `plot` | text | Short synopsis (OMDb). Shown in the movie-detail modal. Not in the frozen contract but present live. |
| `original_language` **[frozen]** | text | ISO code, e.g. `en`. Drives the English-only filter (`passesLang`). ~9.7% non-English. |
| `mpaa_rating` **[frozen]** | text | MPAA/TV rating, e.g. `R`, `PG-13`. Drives the **Content Rating** filter (G / PG / PG-13 / R, with legacy values bucketed) in Advanced Filters. May be `N/A`/`Not Rated`/`Unrated`. (The old Kid-Friendly genre pill + `passesKid` were retired; the kid code is kept inert.) |
| `country` | text | Production country code (e.g. `US`, `GB`). Live column; not engine-critical. |
| `type` | text | Media type, `movie`. Live column; reserved for future TV support. |
| `franchise` **[frozen]** | text | Franchise/series name, e.g. `Dark Knight`. Powers the franchise penalty. Sparse (~148 rows). Null = standalone. |

### 3.2 Ratings (drive `qualityScore`)

| Column | Type | Meaning |
|---|---|---|
| `imdb_rating` **[frozen]** | numeric | IMDb 0–10 (rescaled ×10 to 0–100 in scoring). Present on ~100% of rows. |
| `rotten_tomatoes_score` **[frozen]** | integer | RT Tomatometer 0–100. ~96% present; not required. |
| `metascore` **[frozen]** | integer | Metacritic 0–100. ~94% present; not required. |
| `vote_count` | integer | IMDb vote count. **The popularity signal** (fame, adventurous slider, franchise/confidence penalties). Catalog min ≈ 991. |

### 3.3 Streaming & presentation

| Column | Type | Meaning |
|---|---|---|
| `streaming` **[frozen]** | jsonb | Provider → tier map. See §6. Now populated on ~all rows. |
| `poster_url` **[frozen]** | text | Poster image URL. **All migrated to TMDB** (`https://image.tmdb.org/t/p/w500/...`). |
| `popularity` | double precision | TMDB popularity at last refresh. Migration 001. Currently sparse/unused by the engine. |
| `release_date` | date | Theatrical release date (TMDB). Migration 001. Sparse. |

### 3.4 Pipeline bookkeeping (migration 001)

| Column | Type | Meaning |
|---|---|---|
| `added_at` | timestamptz (default `now()`) | When the pipeline inserted the row. |
| `ratings_updated_at` | timestamptz | Last OMDb ratings refresh. **Drives the rotating-refresh order** (`nulls first`, oldest first). |
| `streaming_updated_at` | timestamptz | Last TMDB watch/providers refresh. Drives the streaming-sweep order. |
| `streaming_updated` | timestamptz | **Legacy** column (no `_at` suffix) from before standardization. Migration 001 deliberately does **not** touch it; reconcile once the pipeline is fully live. |
| `source` | text | Provenance: `ingest-theatrical` \| `ingest-mature` \| `original` (legacy rows may be null). |

> **Note:** the GATE "frozen contract" lists the 16 app-read columns. The live table additionally
> carries `id`, `tmdb_id`, `plot`, `type`, `country`, `popularity`, `release_date`, `added_at`,
> `ratings_updated_at`, `streaming_updated_at`, `streaming_updated` (legacy), and `source`. All
> additive — the pipeline may ADD columns but never renames/drops a frozen one.

---

## 4. Table: `user_movies`

Per-user lists. One row per (user, film) pair, written lazily the first time a user flags a film.

| Column | Type | Meaning |
|---|---|---|
| `user_id` | uuid | Supabase auth user id (`auth.uid()`). Part of the composite PK. |
| `imdb_id` | text | The film (FK-by-convention to `movies.imdb_id`). Part of the composite PK. |
| `seen` | boolean | User has seen this film. Feeds `seenSet` → seen/unseen split & rewatch section. |
| `favorite` | boolean | User "Liked" it (UI label **"Like"**). Feeds `favSet` → taste profile → `favoriteBonus` + Trending taste bonus. |
| `watchlist` | boolean | On the user's watchlist. Display/management only — does not affect ranking. |
| `not_interested` | boolean | "Hidden." Feeds `niSet` → **excluded** from recs & Trending. |
| `updated_at` | timestamptz | Last write time (set on every upsert). |

**Primary key:** composite `(user_id, imdb_id)`. All writes are upserts with
`onConflict: 'user_id, imdb_id'`, so toggling any flag never creates duplicate rows.

The four flags are independent booleans on the **same** row — e.g. a film can be both `seen` and
`favorite`. `restoreFilm()` clears `not_interested` and `seen` together in one write.

---

## 5. Relationships, auth & RLS

- **`user_movies.imdb_id` → `movies.imdb_id`** is a logical relationship (the app joins them in JS
  via the in-memory sets `seenSet/favSet/watchSet/niSet`); whether a DB-level FK exists is not
  required by the app.
- **`movies`**: public read via the anon key. RLS policy permits `SELECT` for everyone; writes are
  restricted to the service-role key (pipeline).
- **`user_movies`**: RLS scopes every row to the signed-in user — reads/writes are filtered to
  `user_id = auth.uid()`. Signed-out users get empty sets, so the engine degrades to the
  no-personalization baseline.
- **Auth:** Google OAuth via Supabase. The `sbAuth` client carries the JWT so RLS sees the user.

---

## 6. The `streaming` JSONB

A flat object mapping a **lowercased provider name** → its **best (free-est) tier** for that film:

```json
{
  "netflix": "flatrate",
  "hulu": "flatrate",
  "amazon video": "rent",
  "apple tv store": "rent",
  "youtube": "rent"
}
```

- **Tier values** come from TMDB, written by `refresh.mjs` in `TIER_ORDER = buy, rent, ads, free,
  flatrate` (processed cheapest-last, so each provider ends tagged with its **best** tier).
- **"Free to me" tiers** (`FREE_TIERS` in `v2.html`): `flatrate, free, sub, ads, subscription`.
  `rent` / `buy` are **not** free.
- `movieAvailability(m)` parses this (accepting a JSON string too) and keeps only providers the app
  recognizes via `SVC_BY_ALIAS`. Aliases are deliberately precise to avoid traps —
  `"amazon video"` (rent store) ≠ `"amazon prime video"` (subscription); `"apple tv store"` (rent)
  ≠ `"apple tv+"` (subscription); `"youtube"` (rent) ≠ `"youtube tv"`.

### The 8 toggle (subscription) services — filterable
`netflix` (Netflix), `hbo` (Max), `disney` (Disney+), `prime` (Prime Video), `hulu` (Hulu),
`paramount` (Paramount+), `apple` (Apple TV+), `peacock` (Peacock). Only these become filter
buttons and count toward "Free to me" and Trending's `trendStreamable`.

### Rent/buy storefronts — badge-only (never filters)
`appletv_store` (Apple TV), `amazon_video` (Amazon), `google` (Google Play), `youtube_store`
(YouTube). Shown as availability badges; never filterable. (The `streaming` JSONB may still contain
`fandango at home`, but **Fandango is intentionally not in the app's `SERVICES` config**, so
`movieAvailability` skips it and it is never shown — its links resolved poorly and it sees little use.)

---

## 7. Indexes

| Index | Column | Migration | Purpose |
|---|---|---|---|
| `movies_ratings_updated_at_idx` | `ratings_updated_at` (`nulls first`) | 001 | Rotating ratings refresh: process the stalest (and never-refreshed) rows first. |
| `movies_streaming_updated_at_idx` | `streaming_updated_at` (`nulls first`) | 002 | Streaming sweep: refresh the stalest providers first. |

(Plus the implicit PK indexes: `movies.id`, `user_movies (user_id, imdb_id)`.)

---

## 8. The catalog's real inclusion bar

A film enters `movies` only via the **addition gate** (`pipeline/GATE.md`, LOCKED; cap < 500
additions ever):

1. **Mature path** — `vote_count >= 12,000` **AND** `imdb_rating` not null. (`source = 'ingest-mature'`.)
2. **Early path (new theatrical)** — currently/recently in theaters AND **blockbuster** (high TMDB
   revenue/popularity) **OR acclaimed** (RT ≥ 80 or Metascore ≥ 70). Bypasses the vote floor;
   rotating refresh fills votes over time. (`source = 'ingest-theatrical'`.)

In practice the catalog (~4,734 films) reflects:
- **`vote_count` ≥ ~12,000** is THE gate (only a couple of pre-gate rows sit just below it; live
  min ≈ 991, an early-path / legacy exception).
- **`imdb_rating` present** on ~100% of rows (no value floor — films down to ~2.1 are included).
- RT present ~96%, Metascore ~94% — common but **not** required.
- **year:** no cutoff (1915–2026). **original_language:** ~9.7% non-English (foreign films allowed).
- **streaming / franchise:** optional, never gated.

Enrichment (RT/Meta presence, language, year, streaming, franchise) is **never** a gate.

---

## 9. Pipeline (how the catalog stays fresh)

Runs in GitHub Actions (never in the browser). Keys are GitHub secrets.

- **`catalog-refresh.yml` → `pipeline/ingest.mjs`** — adds new theatrical standouts (acclaim-gated).
- **`catalog-maintenance.yml` → `pipeline/refresh.mjs`** — nightly: refresh streaming availability
  (TMDB), rotate ratings (OMDb, oldest `ratings_updated_at` first), and **migrate posters to TMDB**
  (one TMDB detail call returns both `watch/providers` and `poster_path`).
- **API split:** TMDB = discovery + streaming (cheap, high limit); OMDb = ratings only (scarce,
  ~1000 req/day; hard stop 900/day). OMDb is spent only on titles that already passed the cheap
  TMDB gate.

Full spec: **[../pipeline/GATE.md](../pipeline/GATE.md)**.

---

## 10. Expected future tables / columns

- **Per-device → per-user exposure**: the recs "exposure" rotation map currently lives in
  `localStorage['cinelog_exposure']`, not the DB. A future `user_exposure` table would make rotation
  cross-device.
- **TV / series support**: the `type` column already exists (`movie`) — a future expansion could
  store series.
- **Ratings/watch history beyond booleans**: a user star-rating or watch-date column on
  `user_movies` (currently only `seen/favorite/watchlist/not_interested` flags + `updated_at`).
- **Reconcile the legacy `streaming_updated`** column into `streaming_updated_at` once the pipeline
  is fully live.

---

## 11. Known limitations

- **Streaming coverage was partial** at GATE-profiling time (~1,838 films lacked streaming, ~61%
  populated); a full TMDB sweep has since populated ~all rows, but availability drifts as titles
  leave services (the refresh **overwrites** the provider map each run).
- **Posters migrated to TMDB** — original posters were often dead Amazon (`m.media-amazon`) URLs;
  the refresh replaces them with `image.tmdb.org` posters. A film with no TMDB poster keeps a
  placeholder.
- **`vote_count` is the only popularity signal** the engine trusts; `popularity` (TMDB) is stored
  but not yet used in scoring or Trending.
- **Exposure rotation is per-device** (`localStorage`), so it's lost on cache-clear and not shared
  across devices.
- **No DB-enforced FK** between `user_movies.imdb_id` and `movies.imdb_id` is required by the app;
  orphan rows are possible if a film were ever removed from the catalog.
- The **frozen column contract** must be honored: never rename/drop `imdb_id, title, year,
  runtime_minutes, genre, director, actors, imdb_rating, rotten_tomatoes_score, metascore,
  poster_url, vote_count, original_language, mpaa_rating, franchise, streaming` — the app reads
  them directly.

---

## 12. Quick column cheat-sheet

```
movies:
  id, imdb_id*, tmdb_id, title*, year*, runtime_minutes*, genre*, director*, actors*,
  plot, original_language*, mpaa_rating*, country, type, franchise*,
  imdb_rating*, rotten_tomatoes_score*, metascore*, vote_count,
  streaming*(jsonb), poster_url*, popularity, release_date,
  added_at, ratings_updated_at, streaming_updated_at, streaming_updated(legacy), source
        (* = frozen, app-read contract)

user_movies:
  user_id, imdb_id, seen, favorite, watchlist, not_interested, updated_at
        PRIMARY KEY (user_id, imdb_id)
```
