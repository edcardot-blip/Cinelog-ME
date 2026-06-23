# CINELOG — AI Context (read this first)

> **For future Claude Code sessions.** This is the fast-start brief: everything you need to know
> before editing CINELOG. The authoritative constitution is **[../CLAUDE.md](../CLAUDE.md)** — read
> it too. Cross-references: **[ROADMAP.md](./ROADMAP.md)** (status), **[TODO.md](./TODO.md)**
> (actionable checklist), **[CODING_GUIDELINES.md](./CODING_GUIDELINES.md)** (conventions),
> **[../SCORING.md](../SCORING.md)** (protected engine), **[../pipeline/GATE.md](../pipeline/GATE.md)**
> (catalog pipeline).

---

## What this project is

CINELOG answers one question — **"What should I watch tonight?"** — and gets a user from opening
the app to a great, personalized movie recommendation in **under 10 seconds**. It is a luxury,
cinematic experience (think Apple TV / A24 / Four Seasons), **not** a settings page or a generic
streaming grid. It is **premium · cinematic · minimal · fast · mobile-first · poster-first**.

What makes it different: a real, tuned recommendation engine (not a "trending feed"), a
quality-gated curated catalog, and a poster-first premium mobile UI. Recommendations are
*generated for you*, not just listed.

---

## Current architecture

- **Single-file, vanilla HTML/CSS/JS. No framework. No build step.** Each app is one `.html` file
  (one `<style>`, the markup, two inline `<script>` blocks).
- **`index.html`** — the **live app** (the premium redesign, promoted to root). When the user says
  "the app," they mean this. **All current work happens here.**
- **`v2.html`** — a **byte-identical alias** of `index.html`, kept only for old `/v2.html`
  bookmarks/PWAs. Don't edit it. **`v1.html`** — the **archived classic** app (reference only).
- All share the same Supabase backend, so data is identical between them.
- **Scope:** movies-only for now (TV shipped but parked); the app stays free / non-commercial.
- **Live URLs (GitHub Pages):** app `https://edcardot-blip.github.io/Cinelog-ME/`,
  archived classic `…/v1.html`. Repo: `edcardot-blip/Cinelog-ME` (public — free Pages requires it).
- **Deploy:** edit `index.html` → push to `main` → Pages rebuilds (~1–2 min) → test on a real iPhone.

**Backend — Supabase** (`https://fmhmvvsbxofoqriekfyj.supabase.co`):
- `movies` — the catalog. Public read via the baked **anon key** (safe to expose; RLS is on).
  Posters are TMDB URLs (`image.tmdb.org`).
- `user_movies` — per-user lists: `seen`, `favorite` (shown as **"Like"** in the UI), `watchlist`,
  `not_interested` (Hidden). RLS-scoped to the signed-in user.
- **Auth** = Google OAuth via Supabase. The Pages URL must be in Supabase → Auth → redirect URLs.

**Catalog pipeline** (GitHub Actions crons; never runs in the browser):
- `catalog-refresh.yml` → `pipeline/ingest.mjs` — acclaim-gated theatrical additions.
- `catalog-maintenance.yml` → `pipeline/refresh.mjs` — nightly: refresh streaming availability,
  rotate ratings, migrate posters to TMDB.
- TMDB = discovery + streaming; OMDb = ratings (≤900 calls/day budget). Keys are **GitHub secrets**
  (`TMDB_API_KEY`, `OMDB_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — never commit them.
- Full spec: **[../pipeline/GATE.md](../pipeline/GATE.md)**.

---

## Current UI philosophy

- Black + gold theme (gold `--accent` `#e8b04b`, `--accent2`; darks `--bg`/`--bg2`/`--bg3`).
  Fraunces headings (`--serif`), Inter body (`--sans`). Use CSS variables — never hardcode.
- Poster-first, minimal text, rounded cards, soft borders, premium animations.
- Icons are **gold stroke SVGs** (viewBox 0 0 24 24, `stroke=currentColor`, ~1.7 width) — not emoji.
- Homepage is a **one-screen wizard:** Title → Quick Filters → Recommendation Mode → Find My Movie.
  Do not redesign this hierarchy into a dashboard.
- Reuse components: `openMovieDetail(m)`, the poster grid (`.rg-grid`/`.rg-tile`), the modal system,
  the collection pages.

---

## Recommendation philosophy (the engine is PROTECTED)

The engine is the heart of the app. Recommendations should feel **personalized, high-quality,
varied, human-curated, never repetitive.**

- The engine lives in **`getRecs()`** (with `getRandom()`, the adventurous-slider handler,
  `setRatingMode`, `setMode`) and is documented in **[../SCORING.md](../SCORING.md)**.
- It blends quality (IMDb/RT/Meta), runtime/era fit, an adventurous-slider popularity curve, genre
  scoring, penalties, a favorites taste-nudge, recency, and output diversity over a large candidate
  pool (`CANDIDATE_LIMIT = 500`, plus a discovery sub-pool).
- **Do not change ranking/scoring math unless explicitly instructed.** When told to: change **one
  lever at a time**, capture before/after behavior, get owner sign-off, and keep `SCORING.md` in
  sync.
- Discovery features (Trending) are **separate and read-only** — they must never alter the engine.

---

## Database structure (brief)

- `movies`: frozen column contract the app reads — `imdb_id, title, year, runtime_minutes, genre,
  director, actors, imdb_rating, rotten_tomatoes_score, metascore, poster_url, vote_count,
  original_language, mpaa_rating, franchise, streaming`. The pipeline may ADD columns and WRITE
  values, but **never rename/drop** these.
- `user_movies`: `seen`, `favorite` (UI "Like"), `watchlist`, `not_interested` (Hidden); RLS per
  user. Mirrored client-side by the Sets below.
- Details: see `pipeline/GATE.md` (column contract) and any `DATABASE.md` if present.

---

## Coding conventions (summary — full version in CODING_GUIDELINES.md)

- Single file, single `<style>`, CSS variables, BEM-ish kebab-case class names.
- Render functions return HTML strings (`renderGalleryTile`, `renderCollectionGrid`,
  `renderRefineChips`, `renderTrendingPage`, …).
- **State** = top-level `let` vars + `Set`s holding `imdb_id`s: `seenSet`, `favSet` (Like),
  `watchSet`, `niSet` (Hidden), plus `selGroups` (filters) and `selServices` (streaming). Update
  the Set and persist to Supabase together.
- **Modals**: one reusable flex-centered system; `.sheet` pickers + `.modal-host` full-screen
  framework; modals are direct children of `<body>`; scroll lock via `lockScroll`/`unlockScroll`.
- **Animations**: ~200–250ms, scale + fade, GPU transforms, honor `prefers-reduced-motion`.

---

## Design principles (never violate)

- Premium · cinematic · minimal · fast · mobile-first · poster-first · elegant over flashy.
- No bright colors except gold (the existing "Seen" teal is the only other accent, where it already
  exists). No generic dashboard. No clutter.

---

## ⛔ Things that should NEVER change (unless explicitly requested)

- The visual identity: black + gold, Fraunces/Inter, poster-first.
- The homepage hierarchy (the one-screen wizard: Title → Quick Filters → Recommendation Mode →
  Find My Movie).
- The recommendation philosophy / scoring engine (`getRecs`, `SCORING.md`).
- The premium animations.
- Poster-first browsing.
- The frozen `movies` column contract.
- Engine ids/handlers (`#go-btn`, `#output`, `#genre-pills`, `#adv-slider`, `setMode`,
  `setRatingMode`, `setLangFilter`, `setFreeOnly`, `onSeenClick`, `onFavClick`, …).

---

## 🛠 The redesign (now the live app)

The redesign is **shipped and live** as `index.html`: one-screen wizard, full-screen results
gallery, movie detail modal, poster-grid collections (Watchlist/Likes/Seen/Hidden), the cinematic
projector loading, the Trending refactor, the Advanced Filters "Refine Results" redesign, and the
gold icon system. **Final mobile polish is the remaining ongoing work.** See **[ROADMAP.md](./ROADMAP.md)**.

---

## 🐛 Known bugs / pitfalls (do NOT re-break these)

- **Flex-drift (`[hidden]` vs `display:flex`):** a CSS `display` rule overrides the UA `[hidden]`
  rule, so hidden flex siblings keep holding space — this drifted the Genre/Era/Length picker
  off-center. Hidden siblings in a flex container must be truly removed (`[hidden]{display:none}`).
- **`position:fixed` under transformed ancestors:** a fixed element resolves against the nearest
  **transformed ancestor**, not the viewport. Full-screen modals/overlays must be **direct children
  of `<body>`** (hosts are relocated to body on load for exactly this reason).
- **Scroll lock:** reference-counted via `lockScroll`/`unlockScroll`; restore the page scroll
  position on close. Modals must sit above the bottom nav (z-index). Do not toggle a body class
  directly.
- **iOS safe-area / 100vh:** desktop browsers don't reproduce iOS safe-area, toolbar, or touch
  behavior — always test on a real iPhone (Safari + installed PWA).
- **PWA caching:** the installed PWA can serve stale assets; account for cache behavior when
  verifying a deploy.
- **Wrap, don't modify, engine setters:** add UI by wrapping setters on `window` (call original,
  then update UI) — never edit `getRecs`/scoring to add presentation.
- **Preserve engine ids/handlers** (listed above) — renaming any breaks the engine.

---

## Current priorities

Mobile polish · recommendation experience · movie detail overlay · results poster grid · loading
animations · Watchlist/Likes redesign · Trending improvements · auth polish. The **`v2.html` →
`index.html` swap is done** (the redesign is now the live app; classic archived at `v1.html`).
Remaining: confirm the Supabase Auth redirect URLs and eventually sunset the `v2.html` alias.
See **[TODO.md](./TODO.md)** for the actionable list.

---

## Verify before deploy (do this every time)

1. Extract each inline `<script>` and syntax-check it — both must parse with zero errors.
2. If you touched anything near `getRecs`, confirm the `raw = base + popMod + …` formula and the
   scorers are intact (cross-check `SCORING.md`).
3. Push to `main`, let Pages rebuild (~1–2 min), and **test on a real iPhone** (Safari + PWA).

> A brand-new Claude session should be able to read this file plus `CLAUDE.md` and immediately build
> features that fit the vision. When you ship a major feature, update these docs to match.
