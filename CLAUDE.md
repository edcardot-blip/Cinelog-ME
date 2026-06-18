# CLAUDE.md — CINELOG Project Constitution

This file is the permanent onboarding guide for all Claude Code sessions on CINELOG.
**Read it before making any change.** It is the source of truth for the vision, the rules,
and how the codebase actually works. When in doubt, follow this file.

---

## How this codebase works (read this first)

CINELOG is a **single-file web app** — vanilla HTML/CSS/JS, no framework, no build step.

- **`index.html`** — the current live "classic" app.
- **`v2.html`** — the **active premium redesign**. *All current work happens here.* It is
  deployed alongside `index.html` and will eventually replace it. When the user says "the app,"
  they almost always mean `v2.html`.
- Both files share the same Supabase backend, so data is identical between them.

**Live URLs (GitHub Pages):**
- App: `https://edcardot-blip.github.io/Cinelog-ME/`
- Redesign preview: `https://edcardot-blip.github.io/Cinelog-ME/v2.html`
- Repo: `edcardot-blip/Cinelog-ME` (public; free-plan Pages requires public).

**Backend — Supabase** (`https://fmhmvvsbxofoqriekfyj.supabase.co`):
- `movies` — the catalog (public read via the baked **anon key**, which is safe to expose
  because RLS is on). Posters are TMDB URLs (`image.tmdb.org`).
- `user_movies` — per-user lists: `seen`, `favorite` (shown as **"Like"** in the UI),
  `watchlist`, `not_interested` (Hidden). RLS-scoped to the signed-in user.
- **Auth** = Google OAuth via Supabase. The Pages URL must be in Supabase → Auth → redirect URLs.

**Catalog pipeline** (keeps the catalog fresh automatically; runs in GitHub Actions):
- `catalog-refresh.yml` → `pipeline/ingest.mjs` — adds new theatrical standouts (acclaim-gated).
- `catalog-maintenance.yml` → `pipeline/refresh.mjs` — nightly: refresh streaming availability +
  rotate ratings + migrate posters to TMDB.
- TMDB = discovery + streaming; OMDb = ratings (1000/day cap). Keys are **GitHub secrets**
  (`TMDB_API_KEY`, `OMDB_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — never commit them.
- Full spec: **`pipeline/GATE.md`**.

**Deploy:** edit `v2.html` → push to repo `main` → Pages rebuilds (~1–2 min). Test on a real iPhone.

---

## Project Overview

- **Purpose:** Help a user go from opening the app to a great movie recommendation in **under 10
  seconds**. It answers one question — *"What should I watch tonight?"*
- **Target audience:** Movie lovers on their phone who want a fast, beautiful, personal pick
  without scrolling endless catalogs.
- **Core vision:** A luxury, cinematic recommendation experience — Apple TV / A24 / Four Seasons,
  not a settings page or a generic streaming grid.
- **What makes it different:** A real, tuned recommendation engine (not "trending feeds"), a
  curated catalog gated for quality, and a poster-first, premium mobile interface. Recommendations
  are *generated for you*, not just listed.

---

## Core Design Philosophy

The app should always feel: **Premium · Cinematic · Minimal · Fast · Mobile-first · Apple-quality
· Poster-first · Elegant over flashy.**

- Avoid clutter. Every interaction should feel intentional.
- Posters do the visual work; text is minimal.
- Mobile (iPhone Safari + installed PWA) is the primary experience — design for it first.

---

## UI Rules

Always preserve:
- **Black + gold** theme (gold `--accent` `#e8b04b`, `--accent2`; dark `--bg/--bg2/--bg3`).
- **Fraunces** headings (`--serif`), **Inter** body (`--sans`).
- Rounded cards, soft borders, subtle shadows, smooth animations.
- Poster-first layouts, minimal text, clean spacing.

Rules:
- **Use the CSS variables** for all colors/fonts — never hardcode hex/fonts. No bright colors
  except gold. No green (the "Seen" teal accent is the only exception, and only where it already exists).
- **Never redesign the app into a generic dashboard.** Prioritize visual hierarchy and simplicity.
- Icons are **gold stroke SVGs** (viewBox 0 0 24 24, `stroke=currentColor`, ~1.7 width), not
  multi-color emoji.

---

## Recommendation Philosophy

The recommendation engine is the **heart of the app**. Recommendations should feel:
**Personalized · High quality · Varied · Human-curated · Never repetitive.**

- The engine lives in `getRecs()` and is fully documented in **`SCORING.md`** (the protected-logic
  reference). It blends quality (IMDb/RT/Meta), runtime/era fit, an adventurous-slider popularity
  curve, genre scoring, penalties, a favorites taste-nudge, recency, and output diversity.
- **The engine is PROTECTED.** Do not change ranking/scoring math unless explicitly instructed.
  When you do: change **one lever at a time**, capture before/after, and keep `SCORING.md` updated.
- Discovery features (Trending) are **separate and read-only** — they must never alter the engine.

---

## Development Philosophy

Before building new features:
- **Reuse existing components** (the modal system, the poster grid `.rg-grid`/`.rg-tile`, the
  movie-detail modal `openMovieDetail(m)`, the collection pages).
- Avoid duplicate UI. Prefer the **one reusable modal system**.
- Keep **mobile** the primary experience. Optimize performance before adding complexity.

When adding features:
- Match the existing design language; maintain consistent spacing and animations.
- Never introduce visual clutter.
- **Don't modify engine functions** to add presentation — *wrap* them on `window` (call the
  original, then your UI update), as done for the segmented-pill and refine-card chips.

---

## Current Priorities

- Mobile polish · Recommendation experience · Movie detail overlay · Results poster grid ·
  Loading animations (the cinematic projector) · Watchlist redesign · Likes redesign ·
  Trending improvements · Authentication polish.

---

## Things That Should Never Change (unless explicitly requested)

- Do not change the **visual identity** (black + gold, Fraunces/Inter, poster-first).
- Do not redesign the **homepage hierarchy** (Title → Quick Filters → Recommendation Mode →
  Find My Movie; the one-screen wizard).
- Do not replace the **recommendation philosophy / scoring engine**.
- Do not introduce unnecessary complexity.
- Do not remove the **premium animations**.
- Do not switch away from **poster-first** browsing.

---

## Code Expectations

Always:
- Keep components **reusable**; minimize duplicated logic; prefer readability.
- Optimize for **mobile performance** (GPU-friendly CSS transforms/opacity; lightweight DOM).
- Maintain accessibility where possible (aria-labels, focus, `prefers-reduced-motion`).

**Hard-won gotchas (do not re-break these):**
- A CSS `display` rule on an element **overrides the UA `[hidden]` rule** — this caused the
  Genre/Era/Length picker to drift off-center (hidden sheets kept flex space). Hidden siblings
  in a flex container must be truly removed (`[hidden]{display:none}`).
- A `position:fixed` element resolves against the **nearest transformed ancestor**, not the
  viewport. Full-screen modals/overlays should be **direct children of `<body>`** (the picker host
  is relocated to body on load for exactly this reason).
- Scroll-lock is reference-counted (`lockScroll`/`unlockScroll`); restore the page scroll position
  on close. Modals must sit **above** the bottom nav (z-index).
- Preserve every engine **id and onclick** the JS reads (`#go-btn`, `#output`, `#genre-pills`,
  `#adv-slider`, `setMode`, `setRatingMode`, `setLangFilter`, `setFreeOnly`, `onSeenClick`,
  `onFavClick`, etc.). Renaming them breaks the engine.

**Verify before deploying:**
1. Extract each inline `<script>` and syntax-check it (e.g. `vm.compileFunction`) — there are two
   inline scripts; both must parse with zero errors.
2. Confirm the recommendation-engine math is intact (e.g. the `raw = base + popMod + …` formula and
   the scorers still present) when you touched anything near `getRecs`.
3. Deploy to Pages and **test on a real iPhone** (Safari and the installed PWA) — desktop browsers
   don't reproduce iOS safe-area / toolbar / touch behavior.

---

## Documentation

- **`SCORING.md`** — the protected recommendation-engine reference. Keep it in sync whenever the
  scoring changes.
- **`pipeline/GATE.md`** — the catalog ingestion/refresh pipeline spec.
- **`/docs`** — when a **major feature** is added, add/update a doc here so future sessions stay
  synchronized. Documentation should always reflect the **current** state of the app.

---

**Treat this file as the project's constitution.** A future Claude Code session should be able to
read only this file and immediately build features that fit the existing vision.
