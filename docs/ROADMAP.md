# CINELOG — Roadmap

> Status of the premium redesign and what's next. Source of truth for *vision and rules* is the
> root **[../CLAUDE.md](../CLAUDE.md)**; this file tracks *progress*. Companion docs:
> **[TODO.md](./TODO.md)** (actionable checklist), **[CODING_GUIDELINES.md](./CODING_GUIDELINES.md)**,
> **[AI_CONTEXT.md](./AI_CONTEXT.md)**.

CINELOG is a single-file, vanilla HTML/CSS/JS movie-recommendation app (premium black + gold,
poster-first, mobile-first). `v2.html` is the **active premium redesign** where all current work
happens; `index.html` is the **classic** live app. Both share the same Supabase backend.

Last updated: 2026-06-17.

---

## ✅ Completed (shipped in the v2 redesign)

These pieces are built and live in `v2.html`:

- **One-screen homepage wizard** — the full flow (Title → Quick Filters → Recommendation Mode →
  Find My Movie) fits on a single screen; no scrolling to get to a pick.
- **Full-screen results gallery** — recommendations render as a full-screen poster grid
  (`renderGalleryTile`, `.rg-grid`/`.rg-tile`) instead of a list.
- **Movie detail modal** — `openMovieDetail(m)` opens a reusable, flex-centered detail overlay
  (poster, metadata, ratings, streaming, and the Seen / Like / Watchlist / Hidden actions).
- **Poster-grid collection pages** — Watchlist, Likes, Seen, and Hidden each render as a poster
  grid (`renderCollectionGrid` / `renderCollectionTile`), reusing the detail modal on tap.
- **Cinematic projector loading** — the premium "projector" loading animation that plays while
  recommendations are generated.
- **Trending refactor** — Trending rebuilt as a separate, read-only discovery page
  (`renderTrendingPage`) that never touches the recommendation engine.
- **Advanced Filters "Refine Results" redesign** — the full-screen modal framework
  (`.modal-host`, pinned header + Done footer, body-only scroll) and the refine-card chips
  (`renderRefineChips`) that mirror current filter state.
- **Gold icon system** — single-color gold stroke SVG icons (viewBox 0 0 24 24,
  `stroke=currentColor`) replacing multi-color emoji throughout.
- **Modal-positioning fix** — picker/modal hosts relocated to be direct children of `<body>` on
  load so `position:fixed` resolves against the viewport, not a transformed ancestor; the
  `[hidden]` vs `display:flex` flex-drift bug fixed so hidden sheets no longer hold flex space.
- **Catalog pipeline + nightly refresh + TMDB poster migration** — GitHub Actions crons keep the
  catalog fresh: `pipeline/ingest.mjs` (acclaim-gated additions) and `pipeline/refresh.mjs`
  (nightly streaming-availability refresh, ratings rotation, and poster migration to TMDB URLs).
  See **[../pipeline/GATE.md](../pipeline/GATE.md)**.
- **Favorite → Like rename** — the `favorite` list is presented everywhere in the UI as **"Like"**
  (the underlying DB column / `favSet` state name is unchanged).

---

## 🔄 In Progress

- **Final mobile polish** — last pass on spacing, safe-area handling, touch targets, and animation
  timing across iPhone Safari and the installed PWA. The one area still actively being refined.

---

## 🔼 High Priority

- **v2.html → index.html swap** — once the redesign is approved, promote `v2.html` to become the
  live app (replacing the classic `index.html`). This makes the redesign the default experience.
- **Auth-redirect config** — confirm Supabase → Auth redirect URLs include the GitHub Pages URL(s)
  (and the post-swap URL) so Google OAuth completes cleanly on the live app and the PWA.

---

## 🔸 Medium Priority

- Cross-device QA of every picker (Genre / Era / Length) and the full-screen modals on physical
  iPhones (Safari + installed PWA).
- Accessibility tightening — aria-labels, focus management on modal open/close,
  `prefers-reduced-motion` coverage across all new animations.
- Keep `SCORING.md` and `pipeline/GATE.md` in sync as the catalog grows.

---

## 🔹 Low Priority

- Empty/loading/error-state polish for the collection grids (Watchlist / Likes / Seen / Hidden).
- Minor copy and microcopy refinements across the wizard and detail modal.

---

## 💡 Future Ideas (not committed — do not build without sign-off)

- **Favorites/Likes sub-collections** — let users group Liked films into named collections.
- **More streaming services** — expand the streaming-availability filter beyond the current set.
- Additional discovery surfaces (read-only, must never alter the recommendation engine).
- Richer movie-detail content where the catalog already has the data.

> Anything here is a candidate, not a commitment. New features must reuse existing components,
> match the design language, and never modify the protected recommendation engine.
