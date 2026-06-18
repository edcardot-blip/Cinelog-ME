# CINELOG — Project Overview

> The 10-minute onboarding for any developer or AI working on CINELOG. Read this, then
> read the project constitution **[../CLAUDE.md](../CLAUDE.md)** (source of truth for rules),
> **[../SCORING.md](../SCORING.md)** (the protected recommendation engine), and
> **[../pipeline/GATE.md](../pipeline/GATE.md)** (the catalog pipeline). This doc reflects the
> **current** state of the app; keep it in sync as features ship.

---

## 1. Vision

CINELOG is a **luxury, cinematic movie-recommendation web app**. It answers exactly one
question — *"What should I watch tonight?"* — and answers it beautifully and fast. The feel
should be Apple TV / A24 / Four Seasons: premium, calm, poster-first. Not a settings page,
not a generic streaming grid, not a "trending feed."

What makes it different from a streaming catalog or a "popular this week" list:

- A **real, tuned recommendation engine** (not a trending feed) generates picks *for you*.
- A **curated catalog** gated for quality (see the pipeline gate) — no long-tail noise.
- A **poster-first, premium, mobile-first** interface where posters do the visual work.

## 2. Primary Goal

**Open the app → land on a great recommendation in under 10 seconds.** Every design and
engineering decision serves that one number. The homepage is a one-screen wizard so a user
can tap a couple of filters, hit one button, and get a personal pick almost immediately.

## 3. Target Audience

Movie lovers on their phone who want a fast, beautiful, personal pick without scrolling
endless catalogs. The **primary experience is iPhone Safari and the installed PWA** — the
app is designed mobile-first and tested on a real iPhone before deploying.

## 4. The Problem It Solves

Choosing what to watch is decision fatigue: too many services, too many titles, endless
scrolling, and "trending" lists that show the same blockbusters to everyone. CINELOG
collapses that into a few intentional taps and produces a curated, personalized pick —
weighted by quality, your taste, runtime/era fit, and how adventurous you feel tonight.

## 5. Core Philosophy

**Premium · Cinematic · Minimal · Fast · Mobile-first · Apple-quality · Poster-first ·
Elegant over flashy.**

- Avoid clutter; every interaction feels intentional.
- Posters carry the visuals; text is minimal.
- The recommendation engine is the **heart of the app** — recommendations should feel
  personalized, high-quality, varied, human-curated, and never repetitive.
- Discovery surfaces (Trending) are **separate and read-only** — they never touch the engine.

## 6. Premium Design Goals

- **Theme:** black + gold. Gold accent `--accent` `#e8b04b` (and `--accent2`); dark
  `--bg`/`--bg2`/`--bg3` surfaces. No bright colors except gold; the only non-gold accent is
  the teal used for "Seen," and only where it already exists.
- **Type:** **Fraunces** for headings (`--serif`), **Inter** for body (`--sans`), loaded from
  Google Fonts. All colors and fonts come from CSS variables — never hardcoded.
- Rounded cards, soft borders, subtle shadows, smooth GPU-friendly animations
  (transform/opacity), and respect for `prefers-reduced-motion`.
- Icons are **gold-stroke SVGs** (viewBox `0 0 24 24`, `stroke=currentColor`, ~1.7 width),
  never multi-color emoji in the chrome.
- iOS-aware: safe-area insets, translucent blurred bottom nav, status-bar styling, PWA
  (`apple-mobile-web-app-capable`).

## 7. Current Feature List

- One-screen recommendation **wizard** (Title → Quick Filters → Refine → Mode → Find My Movie).
- **Quick filters:** Genre, Era, Length — each opens a full-screen slide-up sheet of pills.
- **Refine Results** (Advanced Filters) full-screen modal: Language (Subtitles OK / English
  Only), Where to Watch (Stream/Rent/Buy vs. My Subscriptions), Ratings emphasis
  (Audience / Balanced / Critics), and the **"How Adventurous?"** slider
  (Hidden Gems ↔ Balanced ↔ Crowd Favorites).
- **My Subscriptions:** pick streaming services (Netflix, Max, Disney+, Prime Video, Hulu,
  Paramount+, Apple TV+, Peacock) to filter to what's free to you; rent/buy stores show as
  badges only.
- **Recommendation modes:** Smart Mix (best overall), Fresh Picks (new movies),
  Surprise Me (random pick).
- **Cinematic projector loading** animation between request and results.
- **Results poster gallery** with a header showing the active mode and refine chips.
- **Movie detail modal** (reusable `openMovieDetail(m)`): poster, ratings, metadata, where
  to watch, and the per-film actions (Seen / Like / Watchlist / Hide).
- **User lists:** Watchlist, Likes, Seen, Hidden — each a full-screen poster-grid collection.
- **Trending** discovery page (read-only) with **Trending** and **Newer** tabs.
- **Google sign-in** (Supabase OAuth) via the top-right profile pill; lists sync per user.
- A **favorites taste-nudge**: your Likes feed an additive genre bonus in the engine.
- Live **stats** (Seen count, current Match-pool size) on the homepage.

## 8. Pages / Screens

The app is a single screen plus full-screen overlays (all overlays are direct children of
`<body>` so `position:fixed` resolves to the viewport, not a transformed ancestor).

| Screen / Overlay | Purpose | Key ids / functions |
|---|---|---|
| **Header (hero)** | "What Should I Watch?" title + profile pill | `.apphead`, `#auth-pill`, `onAuthPill()` |
| **Discover / Home** | The one-screen wizard | `#screen-discover` |
| **Quick-filter sheets** | Genre / Era / Length pickers | `#sheet-host`, `openSheet()`, `closeSheet()` |
| **Refine Results** | Advanced filters modal | `#adv-disc` → `openAdvanced()` |
| **My Subscriptions** | Streaming-service picker | `#subs-modal`, `openSubscriptions()` |
| **Projector loader** | Cinematic loading state | `#proj-loader`, `startProjectorLoading()` |
| **Results gallery** | Poster grid of recommendations | `#output`, `#rg-mode`, `.rg-grid`/`.rg-tile` |
| **Movie Detail modal** | Per-film detail + actions | `openMovieDetail(m)` |
| **Trending row** | Lazy, read-only discovery strip | `#trend-row` |
| **Trending page** | Full-screen Trending / Newer tabs | `openTrendingPage()`, `setTrendingTab()` |
| **Watchlist / Likes / Seen / Hidden** | Reusable collection page | `openCollection(type)` |
| **More / Settings** | Lists hub, subscriptions, sign-out | `openSettings()`, `closeSettings()` |

## 9. Navigation Structure

Three layers:

1. **One-screen homepage wizard** — vertical hierarchy that must never be reordered:
   **Title → Quick Filters → Refine Results → Recommendation Mode → Find My Movie**.
2. **Bottom nav** (`.bottom-nav`, fixed, translucent) — five tabs routed by `navTo(tab)`:
   - **Discover** → scrolls home, closes overlays.
   - **Watchlist / Likes / Seen** → open the reusable collection page via `openCollection`.
   - **More** → opens Settings.
   The active highlight snaps back to Discover whenever an overlay closes (MutationObserver).
3. **Full-screen overlays** — sheets, Refine, Subscriptions, Trending, collections, detail
   modal, and Settings. Scroll-lock is reference-counted (`lockScroll`/`unlockScroll`) and
   page scroll position is restored on close.

## 10. Authentication Flow

- **Google OAuth via Supabase.** The SDK client `sbAuth` is created with the baked anon key
  and `{ persistSession, autoRefreshToken, detectSessionInUrl }`.
- The top-right profile pill calls `onAuthPill()`. Sign-in uses
  `sbAuth.auth.signInWithOAuth({ provider:'google', options:{ redirectTo } })` where
  `redirectTo = window.location.origin + window.location.pathname` — so the Pages URL (and
  `/v2.html`) must be registered in **Supabase → Auth → redirect URLs**.
- On load, `getSession()` restores the session and `onAuthStateChange` keeps UI in sync via
  `applyAuthState(session)`. `signOut()` clears it.
- **Catalog is public-read** (anon key + RLS); **only personal lists require login.** When
  signed out, list actions toast "Sign in to…" and open Settings.

## 11. User Lists (`user_movies`)

Per-user lists live in the `user_movies` table, RLS-scoped to `auth.uid()`. Each is a
boolean column upserted on `(user_id, imdb_id)`:

| UI label | Column | Set / function |
|---|---|---|
| **Seen** | `seen` | `seenSet`, `onSeenClick()`, `markSeen()` |
| **Like** | `favorite` | `favSet`, `onFavClick()`, `markFavorite()` |
| **Watchlist** | `watchlist` | `watchSet`, `markWatchlist()` |
| **Hidden** | `not_interested` | `niSet`, hide handlers (`markFlag`/upsert) |

Notes: **"Like" = `favorite`** and **"Hidden" = `not_interested`** in the DB. Seen films are
excluded from Fresh Picks until marked unseen. Likes also build a **taste profile**
(`{ genres:{...}, n }`) consumed only by the additive `favoriteBonus` in `getRecs`.

## 12. Recommendation Modes

Set via `setMode(m)`; the Find My Movie button relabels to "✦ Surprise me" for random.

- **Smart Mix** (`hybrid`) — best overall; the full tuned ranking.
- **Fresh Picks** (`fresh`) — newer movies, excludes already-seen.
- **Surprise Me** (`random`) — a single random quality pick (`getRandom()`); ignores the
  Ratings emphasis.
- (A legacy **Rewatch** mode is hidden but kept as a non-null stub so `setMode` never throws.)

The **Ratings emphasis** (`setRatingMode`: audience / balanced / critics) and the
**"How Adventurous?"** slider (`#adv-slider`, 0–100) tune the same engine — not separate modes.

## 13. Recommendation Flow

1. User sets **Quick Filters** (genre/era/length) and optionally **Refine Results**
   (language, services, ratings emphasis, adventurous slider).
2. Taps **Find My Movie** (`#go-btn`).
3. **Cinematic projector loading** swaps in below the button (`startProjectorLoading()`),
   replacing the Trending row.
4. `getRecs()` fetches a large candidate pool (`CANDIDATE_LIMIT = 500`, plus a
   `DISCOVERY_LIMIT = 150` least-popular-quality merge so the adventurous slider has genuinely
   obscure picks), applies DB filters, then ranks: quality (IMDb/RT/Meta), runtime/era fit,
   the adventurous popularity curve, genre scoring, penalties, the favorites taste-nudge,
   recency, and an output-diversity reorder. **The math is PROTECTED — see SCORING.md.**
5. Results render as a **poster gallery** (`#output`, `.rg-grid`) with a mode header and
   refine chips.
6. Tapping a poster opens the **Movie Detail modal** (`openMovieDetail(m)`) with metadata,
   ratings, where-to-watch, and Seen / Like / Watchlist / Hide actions.

## 14. Database Overview (Supabase)

Project: `https://fmhmvvsbxofoqriekfyj.supabase.co`. Two tables:

- **`movies`** — the curated catalog. **Public read** via the baked anon key (safe to expose
  because RLS is on). Frozen column contract the app reads (never rename/drop):
  `imdb_id, title, year, runtime_minutes, genre, director, actors, imdb_rating,
  rotten_tomatoes_score, metascore, poster_url, vote_count, original_language, mpaa_rating,
  franchise, streaming`. Posters are TMDB URLs (`image.tmdb.org`). The pipeline may **add**
  columns (migrations 001/002) but never rename the contract.
- **`user_movies`** — per-user lists (`seen`, `favorite`, `watchlist`, `not_interested`),
  RLS-scoped to the signed-in user.
- **Auth** — Google OAuth (see §10).

## 15. Tech Stack

- **Frontend:** a single HTML file with inline CSS + JS — **vanilla, no framework, no build
  step**. (Two inline `<script>` blocks; both must parse cleanly before deploy.)
- **Fonts:** Fraunces + Inter (Google Fonts). **Icons:** inline stroke SVG.
- **Backend:** Supabase (Postgres + Row Level Security + Auth). Client = `@supabase/supabase-js@2`
  from jsDelivr.
- **Catalog pipeline:** Node ESM scripts (`.mjs`) on **GitHub Actions** crons; **TMDB**
  (discovery + streaming) and **OMDb** (ratings).
- **Hosting:** **GitHub Pages** (repo `edcardot-blip/Cinelog-ME`, public — free Pages requires
  public).

## 16. Folder Structure

```
Cinelog ME/
├── v2.html                    # ACTIVE premium redesign (current app — all work here)
├── index.html                 # Older "classic" live app
├── CLAUDE.md                  # Project constitution (read first)
├── SCORING.md                 # PROTECTED recommendation-engine reference
├── README.md                  # Public-facing project README
├── docs/
│   ├── README.md              # /docs index
│   ├── PROJECT.md             # This file
│   └── ROADMAP.md             # Future roadmap (if/when added)
├── pipeline/
│   ├── GATE.md                # Catalog ingestion/refresh spec + gate
│   ├── ingest.mjs             # Adds new theatrical standouts (acclaim-gated)
│   ├── refresh.mjs            # Nightly: streaming + ratings + poster migration
│   └── migrations/
│       ├── 001_add_ingestion_columns.sql
│       └── 002_add_tmdb_id.sql
└── .github/workflows/
    ├── catalog-refresh.yml        # Daily 09:00 UTC → ingest.mjs
    └── catalog-maintenance.yml    # Daily 10:00 UTC → refresh.mjs
```

(Numerous historical snapshots — `index1.x.html`, `cinelog_me*.html`, `1.4.html` — also live
at the root; they are archived versions, not the live app.)

## 17. Catalog Pipeline (summary)

Keeps the catalog fresh automatically; **never runs in the browser**, never edits the HTML.

- **`catalog-refresh.yml` → `ingest.mjs`** (daily 09:00 UTC): adds new theatrical standouts.
  Addition gate (locked): **mature path** `vote_count ≥ 12,000` AND `imdb_rating` present, or
  **early path** in/near theaters AND (blockbuster popularity OR RT ≥ 80 / Meta ≥ 70). Hard
  cap < 500 additions ever.
- **`catalog-maintenance.yml` → `refresh.mjs`** (daily 10:00 UTC): refresh streaming
  availability (TMDB), rotate ratings oldest-first (OMDb), migrate posters to TMDB.
- **API split:** TMDB = discovery + streaming (cheap/high limit); OMDb = ratings only
  (~1000/day cap, hard stop at 900). Keys are **GitHub secrets** (`TMDB_API_KEY`,
  `OMDB_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — never committed.
- Manual dispatch defaults to **dry-run**; scheduled runs write. Full spec:
  **[../pipeline/GATE.md](../pipeline/GATE.md)**.

## 18. Current Implementation Status

- **`v2.html`** (premium redesign) is **largely complete and live** as the preview at
  `/v2.html`. It is the active surface for all current work.
- **Pending:** the **v2 → index swap** — `v2.html` will eventually replace `index.html` as the
  primary app.
- The **catalog pipeline is live** on GitHub Actions (both crons wired with secrets).
- **Engine is stable and PROTECTED** (`getRecs`, documented in SCORING.md).

**Deploy loop:** edit `v2.html` → syntax-check both inline scripts → confirm engine math
intact → push to repo `main` → Pages rebuilds (~1–2 min) → **test on a real iPhone** (Safari +
installed PWA). Desktop browsers don't reproduce iOS safe-area / toolbar / touch behavior.

## 19. Future Expansion Ideas

Inferred from the code and the constitution (directional, not committed):

- **Curated collections / themed shelves** (the code already speaks of a reusable collection-
  page system and modal — natural home for editorial or seasonal collections).
- **More streaming services / regions** (the `SERVICES` map and free-tier logic generalize).
- **Richer taste profile** beyond Likes (the `{ genres, n }` taste profile could expand to
  directors, eras, runtime preferences feeding `favoriteBonus`).
- **Trending improvements** (more tabs beyond Trending / Newer; the page is read-only by design).
- **Smarter "Newer"/theatrical surfacing** tied to the early-path pipeline additions.
- **Watchlist / Likes polish** and history features.
- **Onboarding** that seeds taste quickly to hit the <10s goal for first-time users.

> When any of these ship as a major feature, add a `docs/<feature>.md` and update the
> `docs/README.md` index, per the constitution.
</content>
</invoke>
