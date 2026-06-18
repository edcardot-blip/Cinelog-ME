# Prompt — Likes Collection Page

> Paste into a fresh Claude Code session, then add your specific request at the bottom.

## Context
CINELOG is a single-file, vanilla HTML/CSS/JS app. All current work happens in **`v2.html`**.
Read **`CLAUDE.md`** first. The engine in `getRecs()` is PROTECTED and out of scope here.

## Naming gotcha (read carefully)
The feature is shown in the UI as **"Like"** with a **heart** icon, but the underlying Supabase
column in `user_movies` is **`favorite`**. **Keep the DB column named `favorite`** and keep the
handler **`onFavClick`** / `isFavorite` / `loadFavorites` / `showFavorites` — only the *label* and
*icon* say "Like." Do not rename the column or the handlers to match the UI text.

## Goal
Refine the **Likes** page — a premium **poster-grid collection** of the films the user liked. It is
the **same collection pattern** as Watchlist (see `watchlist.md`). Features:

- **Count** of liked films (subtle, gold-accented).
- **Search** by title.
- **Sort** (recently liked / title / year / rating).
- **Tap → detail** via `openMovieDetail(m)` / `openMovieDetailById(id)`.

## Reuse, don't reinvent (important)
Likes and Watchlist **share one collection component**. Use the existing functions/markup:
- `openCollection` / `closeCollection`, `showFavorites` (and `loadFavorites` / `isFavorite`),
  `renderCollectionGrid` / `renderCollectionTile`, `showCollectionState`, `refreshOpenCollection`,
  `openCollectionDetail`.
- Poster-grid styles **`.rg-grid` / `.rg-tile`**.
- The **one reusable modal system** (detail view is a direct child of `<body>`).
- The **heart** glyph as a gold **stroke SVG icon** (viewBox `0 0 24 24`,
  `stroke="currentColor"`, ~1.7 width) — not a colored/emoji heart.

Any improvement to the collection component must be made **once** so Watchlist benefits too — no
Likes-only fork.

## Never break
- **Visual identity:** black + gold only, Fraunces / Inter, CSS variables. Poster-first, minimal
  text. **Premium animations** (200–250ms).
- The Supabase **`favorite`** column and `onFavClick` / `isFavorite` handlers.
- Don't redesign into a generic list/dashboard.

## Design constraints
- Mobile-first; **safe-area insets** (notch + bottom nav); tap targets ≥ 44px.
- Reference-counted `lockScroll` / `unlockScroll`; restore scroll on close; reuse
  `showCollectionState` for empty/loading.
- GPU-friendly transforms/opacity; lazy poster loading; light DOM.

## Verify before deploying
1. Syntax-check **both** inline `<script>` blocks (`vm.compileFunction`) — zero errors.
2. Confirm `favorite` / `onFavClick` / shared collection functions / `.rg-grid` / `.rg-tile` still
   resolve, and that **Watchlist still works** (shared component).
3. Deploy to Pages and **test on a real iPhone** (Safari + PWA): grid, search, sort, tap→detail,
   heart toggling, empty state.
4. **Do not change `index.html`** unless explicitly told.

---
**My specific request:**
