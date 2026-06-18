# CINELOG — TODO

> Prioritized, actionable checklist. Companion to **[ROADMAP.md](./ROADMAP.md)** (higher-level
> status). Vision and rules live in **[../CLAUDE.md](../CLAUDE.md)**. All work happens in
> `v2.html` unless stated otherwise.

Last updated: 2026-06-17.

---

## 🔥 Critical

- [ ] Swap `v2.html` → `index.html` once the redesign is approved (promote v2 to the live app).
- [ ] Verify Supabase Auth redirect URLs include the GitHub Pages URL
      (`https://edcardot-blip.github.io/Cinelog-ME/`) and the post-swap URL so Google OAuth
      completes on both Safari and the installed PWA.
- [ ] Before any deploy: extract each inline `<script>` and syntax-check it (both inline scripts
      must parse with zero errors).
- [ ] Confirm the recommendation-engine math is intact (the `raw = base + popMod + …` formula and
      all scorers present) any time a change lands near `getRecs`.

---

## ⭐ High

- [ ] Test all pickers (Genre / Era / Length) on a physical iPhone — Safari **and** the installed
      PWA.
- [ ] Finish the final mobile polish pass (spacing, safe-area insets, touch targets, animation
      timing).
- [ ] Verify the full-screen modals (Advanced Filters / Refine Results, My Subscriptions) layer
      correctly (z-index, body-only scroll, Done/X behavior) on device.
- [ ] Confirm modal/picker hosts remain direct children of `<body>` after load (no
      `position:fixed` drift under transformed ancestors).
- [ ] Confirm the cinematic projector loading animation plays smoothly and respects
      `prefers-reduced-motion`.

---

## 📌 Medium

- [ ] QA all four collection grids (Watchlist / Likes / Seen / Hidden) — load, tap-to-detail, and
      the Seen/Like/Watchlist/Hidden toggles round-trip to Supabase.
- [ ] Confirm scroll position is preserved after closing any modal (`lockScroll`/`unlockScroll`
      reference counting).
- [ ] Audit aria-labels and focus handling on modal open/close.
- [ ] Verify the nightly catalog crons (`catalog-refresh.yml`, `catalog-maintenance.yml`) are
      green and the TMDB poster migration is progressing (see `pipeline/refresh.mjs`).
- [ ] Keep `SCORING.md` and `pipeline/GATE.md` synced with any engine/pipeline changes.

---

## 💡 Nice to Have

- [ ] Polish empty / loading / error states for the collection grids.
- [ ] Refine microcopy across the wizard and movie-detail modal.
- [ ] Investigate Favorites/Likes sub-collections (future — needs sign-off; reuse the grid + modal).
- [ ] Evaluate adding more streaming services to the availability filter (future — needs sign-off).

---

### Reminders when checking items off

- **Never modify the recommendation engine** to add UI — *wrap* engine setters on `window`
  (call the original, then update your UI), as done for the segmented pills and refine chips.
- **Preserve every engine id and onclick** the JS reads (`#go-btn`, `#output`, `#genre-pills`,
  `#adv-slider`, `setMode`, `setRatingMode`, `setLangFilter`, `setFreeOnly`, `onSeenClick`,
  `onFavClick`, …). Renaming them breaks the engine.
- **Reuse, don't duplicate** — the modal system, `openMovieDetail(m)`, and the poster grid
  (`.rg-grid`/`.rg-tile`) already exist.
- Deploy = push to repo `main` → Pages rebuilds (~1–2 min) → **test on a real iPhone**.
