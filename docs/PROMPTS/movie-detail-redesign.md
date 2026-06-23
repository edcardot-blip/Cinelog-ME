# Prompt — Movie Detail Modal Redesign

> Paste into a fresh Claude Code session, then add your specific request at the bottom.

## Context
CINELOG is a single-file, vanilla HTML/CSS/JS app. All current work happens in **`index.html`** (the live app; `v2.html`/`v1.html` are an alias/archive — do not edit them).
Read **`CLAUDE.md`** and **`SCORING.md`** first. The engine in `getRecs()` is PROTECTED.

## Goal
Refine the **floating movie-detail modal** — the premium overlay shown when a poster is tapped.
It is opened by **`openMovieDetail(m)`** (and `openMovieDetailById(id)`); keep using those entry
points. The detail layout, top to bottom:

- **Artwork** — large poster, the visual anchor (poster-first).
- **Metadata** — title (Fraunces), year, runtime, genres (minimal, gold-accented).
- **Rating badges** — IMDb / RT / Metacritic badges (the `.md-*` rating components).
- **Streaming** — where-to-watch row (the availability map; free vs paid styling already exists).
- **Why** — the "why this pick" blurb (`.md-why` / `.why`), gold-tinted section.
- **Action pills** — Apple-Music-style icon pills row (Seen / Like / Watchlist / Hide), wired to
  `onSeenClick`, `onFavClick`, and the watchlist/hidden handlers.

## Never break
- **Visual identity:** black + gold only, Fraunces headings / Inter body, CSS variables for all
  colors/fonts. No bright colors except gold; no green except the existing "Seen" teal.
- **Entry points & handlers:** keep `openMovieDetail` / `openMovieDetailById`, and preserve
  `onSeenClick` / `onFavClick` and the watchlist/hidden onclicks. Note: the **DB column is
  `favorite`** but the UI labels it **"Like"** (heart) — don't rename the column.
- **Poster-first** hierarchy and **premium animations** (200–250ms).

## Reuse, don't reinvent
- The **one reusable modal system** — flex-centered, **direct child of `<body>`** (so
  `position:fixed` resolves against the viewport, not a transformed ancestor).
- Existing `.md-section-lbl`, `.md-why`, rating-badge, streaming-row, and action-pill styles.
- Gold **stroke SVG icons** (viewBox `0 0 24 24`, `stroke="currentColor"`, ~1.7 width) — for the
  action pills and any glyphs. No colored emoji.

## Design constraints
- Mobile-first; respect **safe-area insets** so the modal and its action row clear the notch and
  home indicator. Tap targets ≥ 44px.
- Use reference-counted `lockScroll` / `unlockScroll`; restore scroll position on close. Modal
  z-index above the bottom nav. The modal scrolls internally; the page behind stays locked.
- Hidden sections inside flex must be truly removed (`[hidden]{display:none}`).

## If you tune the engine
Don't, unless told. The "Why" text comes from engine output — render it, don't recompute scoring.
Any state update should wrap the engine setter on `window`, not edit the math.

## Verify before deploying
1. Syntax-check **both** inline `<script>` blocks (`vm.compileFunction`) — zero errors.
2. Confirm `openMovieDetail`/`openMovieDetailById` and the action-pill handlers still resolve.
3. Deploy to Pages and **test on a real iPhone** (Safari + PWA): modal centers, scrolls inside,
   safe-area correct, pills tappable.
4. **Do not change `index.html`** unless explicitly told.

---
**My specific request:**
