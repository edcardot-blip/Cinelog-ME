# Prompt — Watchlist Collection Page

> Paste into a fresh Claude Code session, then add your specific request at the bottom.

## Context
CINELOG is a single-file, vanilla HTML/CSS/JS app. All current work happens in **`index.html`** (the live app; `v2.html`/`v1.html` are an alias/archive — do not edit them).
Read **`CLAUDE.md`** first. The engine in `getRecs()` is PROTECTED and is out of scope here.
Backend is Supabase; the watchlist is the **`watchlist`** flag in `user_movies` (RLS-scoped to the
signed-in user).

## Goal
Refine the **Watchlist** page — a premium **poster-grid collection** of the films the user saved.
It is one instance of the shared collection component. Features:

- **Count** — how many films are saved (subtle, gold-accented header).
- **Search** — filter the grid by title.
- **Sort** — reorder (e.g. recently added / title / year / rating).
- **Tap → detail** — tapping a poster opens the movie-detail modal via `openMovieDetail(m)` /
  `openMovieDetailById(id)`.

## Reuse, don't reinvent (important)
Watchlist, Likes, and any future collection **share one collection component**. Use the existing
functions/markup rather than forking:
- `openCollection` / `closeCollection`, `showWatchlist` (and `loadWatchlist` / `isWatchlisted`),
  `renderCollectionGrid` / `renderCollectionTile`, `showCollectionState`, `refreshOpenCollection`,
  `openCollectionDetail`.
- The poster-grid styles **`.rg-grid` / `.rg-tile`**.
- The **one reusable modal system** for the detail view (direct child of `<body>`).
- Gold **stroke SVG icons** (viewBox `0 0 24 24`, `stroke="currentColor"`, ~1.7 width) for
  search/sort/empty-state glyphs. No colored emoji.

If you improve the collection component, improve it **once** so Likes benefits too — don't create a
parallel watchlist-only variant.

## Never break
- **Visual identity:** black + gold only, Fraunces / Inter, CSS variables. Poster-first, minimal
  text. **Premium animations** (200–250ms).
- The Supabase **`watchlist`** flag and its load/toggle handlers.
- Don't redesign this into a generic list/dashboard — posters do the work.

## Design constraints
- Mobile-first; respect **safe-area insets** (header clears notch, grid clears bottom nav).
- Tap targets ≥ 44px; grid columns sized for a phone first.
- Use reference-counted `lockScroll` / `unlockScroll` when the detail modal opens; restore scroll
  position on close. Empty / loading states should reuse `showCollectionState`.
- GPU-friendly: animate `transform`/`opacity`; lazy-load poster images; keep the DOM light for long
  lists (avoid reflow thrash).

## Verify before deploying
1. Syntax-check **both** inline `<script>` blocks (`vm.compileFunction`) — zero errors.
2. Confirm the shared collection functions and `.rg-grid`/`.rg-tile` still resolve, and that Likes
   still works (shared component).
3. Deploy to Pages and **test on a real iPhone** (Safari + PWA): grid, search, sort, tap→detail,
   empty state.
4. **Do not change `index.html`** unless explicitly told.

---
**My specific request:**
