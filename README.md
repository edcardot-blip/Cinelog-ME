# CINELOG

**A luxury, cinematic movie-recommendation web app that answers one question — _"What should I watch tonight?"_ — in under 10 seconds.**

CINELOG pairs a real, tuned recommendation engine with a curated, quality-gated catalog and a
poster-first, mobile-first interface (black + gold, Fraunces + Inter). Recommendations are
*generated for you*, not just listed — the opposite of an endless "trending" scroll.

**Live:** https://edcardot-blip.github.io/Cinelog-ME/
· **Redesign preview:** https://edcardot-blip.github.io/Cinelog-ME/v2.html

> New here? Read **[CLAUDE.md](CLAUDE.md)** (the project constitution) and
> **[docs/PROJECT.md](docs/PROJECT.md)** (the 10-minute overview) first.

---

## Features

- **One-screen recommendation wizard** — Title → Quick Filters → Refine → Mode → *Find My Movie*.
- **Quick filters** — Genre, Era, Length, each via a full-screen slide-up sheet.
- **Refine Results** — Language, Where to Watch (My Subscriptions), Ratings emphasis
  (Audience / Balanced / Critics), and a *"How Adventurous?"* slider (Hidden Gems ↔ Crowd Favorites).
- **Recommendation modes** — Smart Mix, Fresh Picks, Surprise Me.
- **Cinematic projector loading**, a **results poster gallery**, and a reusable **Movie Detail modal**.
- **Personal lists** (Google sign-in) — Watchlist, Likes, Seen, Hidden — synced per user, with
  your Likes nudging future recommendations.
- **Trending** discovery page (read-only — never alters the engine).
- **Installable PWA**, iOS-aware, optimized for iPhone Safari first.
- **Self-maintaining catalog** kept fresh by a TMDB + OMDb pipeline on GitHub Actions.

## Screenshots

<!-- screenshot: homepage -->
<!-- screenshot: quick-filters-sheet -->
<!-- screenshot: refine-results-modal -->
<!-- screenshot: projector-loading -->
<!-- screenshot: results-gallery -->
<!-- screenshot: movie-detail-modal -->
<!-- screenshot: watchlist-collection -->
<!-- screenshot: trending-page -->

## Tech Stack

- **Frontend:** single HTML file with inline CSS + JS — **vanilla, no framework, no build step**.
- **Fonts:** Fraunces (headings) + Inter (body) via Google Fonts. **Icons:** inline stroke SVG.
- **Backend:** Supabase (Postgres + Row Level Security + Google Auth), `@supabase/supabase-js@2`.
- **Catalog pipeline:** Node ESM scripts on GitHub Actions — TMDB (discovery + streaming) and
  OMDb (ratings).
- **Hosting:** GitHub Pages (`edcardot-blip/Cinelog-ME`).

## Installation

No build, no dependencies to install for the app itself — it is a single HTML file. Just clone:

```bash
git clone https://github.com/edcardot-blip/Cinelog-ME.git
cd Cinelog-ME
```

The Supabase anon key is already baked in (safe to expose because Row Level Security is on), so
the app works out of the box once served over HTTP.

## Running Locally

You **must serve over HTTP** — do not open the file with `file://`.

```bash
# from the repo root
python3 -m http.server 8000
# then open:
#   http://localhost:8000/v2.html   (active redesign — current app)
#   http://localhost:8000/index.html (classic app)
```

**Why `file://` fails:** Supabase's `fetch` calls and Google OAuth both require a real HTTP
origin. Opened from the filesystem, the catalog won't load and sign-in won't redirect back. Any
static server (`python3 -m http.server`, `npx serve`, etc.) fixes this.

> Add `?dev=1` to the URL (or `localStorage.setItem('cinelog_dev','1')`) to reveal the
> read-only scoring diagnostics panel after results. Normal users never see it.

## Supabase Setup

The app talks to a Supabase project with two tables and Google auth:

1. **`movies`** — the curated catalog. **Public read** via the anon key, protected by RLS.
   Posters are TMDB URLs. The app reads a frozen column contract (`imdb_id, title, year,
   runtime_minutes, genre, director, actors, imdb_rating, rotten_tomatoes_score, metascore,
   poster_url, vote_count, original_language, mpaa_rating, franchise, streaming`) — never
   rename or drop these. Apply `pipeline/migrations/*.sql` in the Supabase SQL editor.
2. **`user_movies`** — per-user lists (`seen`, `favorite` → "Like", `watchlist`,
   `not_interested` → "Hidden"). Enable **RLS** scoped to `auth.uid()` so each user only
   reads/writes their own rows.
3. **Google auth** — enable the Google provider, then add every served origin to
   **Auth → URL Configuration → Redirect URLs**, e.g.:
   - `https://edcardot-blip.github.io/Cinelog-ME/`
   - `https://edcardot-blip.github.io/Cinelog-ME/v2.html`
   - `http://localhost:8000/v2.html` (for local development)

   Sign-in redirects to `window.location.origin + window.location.pathname`, so each path you
   serve from needs to be allow-listed.

> **Secrets:** the pipeline's `TMDB_API_KEY`, `OMDB_API_KEY`, and
> `SUPABASE_SERVICE_ROLE_KEY` live as **GitHub Actions secrets** — never commit them.

## Deployment

Hosted on **GitHub Pages** from the `main` branch of `edcardot-blip/Cinelog-ME` (the repo is
public because free-plan Pages requires it).

- **Preview convention:** `v2.html` is deployed *alongside* `index.html` so the premium redesign
  can be previewed live at `/v2.html` before it replaces the classic app. All current work
  happens in `v2.html`.
- **Deploy loop:** edit `v2.html` → syntax-check both inline scripts → push to `main` → Pages
  rebuilds (~1–2 min) → **test on a real iPhone** (Safari and the installed PWA). Desktop
  browsers don't reproduce iOS safe-area / toolbar / touch behavior.

The catalog pipeline runs automatically via two GitHub Actions crons (manual dispatch defaults
to dry-run):

- `catalog-refresh.yml` (daily 09:00 UTC) → `pipeline/ingest.mjs` — adds new theatrical standouts.
- `catalog-maintenance.yml` (daily 10:00 UTC) → `pipeline/refresh.mjs` — refreshes streaming
  availability, rotates ratings, and migrates posters to TMDB.

## Folder Structure

```
Cinelog ME/
├── v2.html                 # Active premium redesign (current app)
├── index.html              # Classic live app
├── CLAUDE.md               # Project constitution (read first)
├── SCORING.md              # Protected recommendation-engine reference
├── README.md               # This file
├── docs/                   # Project & feature docs (PROJECT.md, README.md, ROADMAP.md)
├── pipeline/               # Catalog pipeline: GATE.md, ingest.mjs, refresh.mjs, migrations/
└── .github/workflows/      # catalog-refresh.yml, catalog-maintenance.yml (crons)
```

## Future Roadmap

Curated collections, more streaming services/regions, a richer taste profile, Trending
improvements, and first-run onboarding are all on the horizon. See **[docs/ROADMAP.md](docs/ROADMAP.md)**
for the running list (and **[docs/PROJECT.md](docs/PROJECT.md)** for the full picture).

---

*CINELOG — the perfect movie in seconds.*
</content>
