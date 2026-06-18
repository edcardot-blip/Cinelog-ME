# Prompt — Trending / Client-Side Discovery

> Paste into a fresh Claude Code session, then add your specific request at the bottom.

## Context
CINELOG is a single-file, vanilla HTML/CSS/JS app. All current work happens in **`v2.html`**.
Read **`CLAUDE.md`** first. Trending is a **discovery** feature, **completely separate from the
recommendation engine** — it is **client-side and read-only** and must **never** touch `getRecs()`
or `SCORING.md`.

## Goal
Refine **Trending** — a lightweight, client-side discovery surface. Key mechanics already in place:

- **`trendingScore(m)`** — a weighted client-side score (quality + recency-style weighting). This
  is the *only* scoring Trending uses; it has nothing to do with the engine.
- **Free on the 8 services** — a "free" toggle that surfaces titles free on one of the 8 toggleable
  subscription services (reuses the app's availability map; see `setFreeOnly` / the service pills).
- **Newer tab** — `setTrendingTab('newer')` filters to roughly the **last 3 years**.
- **Homepage strip** — the homepage Trending row **shuffles and shows 3** picks for variety.

## Hard boundary (do not cross)
- Trending **never** alters, calls into, or feeds back into the engine. Keep `trendingScore`
  separate from `getRecs`. No engine ids/handlers change for Trending work.
- Don't move engine scoring weights into Trending or vice versa.

## Never break
- **Visual identity:** black + gold only, Fraunces / Inter, CSS variables. Poster-first, minimal
  text. **Premium animations** (200–250ms).
- The **free-on-8-services** logic and availability map (free vs paid styling already exists).
- The "Newer = last ~3 years" definition and the homepage "shuffle 3" behavior, unless explicitly
  asked to change them.

## Reuse, don't reinvent
- Poster-grid / row styles (**`.rg-grid` / `.rg-tile`** and the trending tab/row markup, the
  `trend-tab` buttons).
- Tap a Trending poster → **`openMovieDetail(m)` / `openMovieDetailById(id)`**.
- Gold **stroke SVG icons** (viewBox `0 0 24 24`, `stroke="currentColor"`, ~1.7 width). No emoji.

## Design constraints
- Mobile-first; **safe-area insets**; tap targets ≥ 44px.
- All scoring/filtering is **client-side** — keep it cheap. Compute once, cache where sensible;
  don't recompute `trendingScore` on every render. Lazy-load posters.
- GPU-friendly transforms/opacity for the row/strip animations; light DOM; avoid reflow.

## Verify before deploying
1. Syntax-check **both** inline `<script>` blocks (`vm.compileFunction`) — zero errors.
2. Confirm `getRecs` / `SCORING.md` are **untouched**, and `trendingScore`, the free toggle, the
   Newer tab, and the homepage shuffle-3 still work.
3. Deploy to Pages and **test on a real iPhone** (Safari + PWA).
4. **Do not change `index.html`** unless explicitly told.

---
**My specific request:**
