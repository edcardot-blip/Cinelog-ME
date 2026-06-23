# CINELOG — Coding Guidelines

> Conventions for working in the single-file app. The constitution is **[../CLAUDE.md](../CLAUDE.md)**
> (read it first). Engine rules: **[../SCORING.md](../SCORING.md)**. Pipeline:
> **[../pipeline/GATE.md](../pipeline/GATE.md)**. Project context for AI sessions:
> **[AI_CONTEXT.md](./AI_CONTEXT.md)**.

CINELOG is **vanilla HTML/CSS/JS in a single file, no framework, no build step.** All active work
is in `index.html` (the live app). Keep it that way — do not add a bundler, npm dependencies, or
extra files.

---

## File & architecture model

- **One file per app:** `index.html` (the live app — the promoted redesign; edit this one),
  `v2.html` (byte-identical alias, don't edit), and `v1.html` (archived classic). Each is fully
  self-contained: one `<style>` block, the markup, and inline `<script>` blocks (there are two
  inline scripts — both must parse cleanly).
- No external JS frameworks. The only network dependency is Supabase (fetch against the REST API
  with the baked anon key) and Google Fonts (Fraunces, Inter).

---

## Naming

- **CSS variables** for all colors and fonts — never hardcode hex or font names. Core vars:
  `--bg` / `--bg2` / `--bg3` (darks), `--accent` (`#e8b04b` gold) / `--accent2`, `--serif`
  (Fraunces), `--sans` (Inter), `--r` (radius).
- **Class names** are short, BEM-ish, kebab-case, namespaced by feature: e.g. `rg-grid` /
  `rg-tile` (results gallery), `sheet` / `sheet-done` (pickers), `modal-host` (full-screen modals),
  `.pill` / `.on-amber` (filter pills). Reuse an existing prefix before inventing a new one.
- **JS functions** are camelCase verbs: `getRecs`, `getRandom`, `openMovieDetail`,
  `renderGalleryTile`, `renderCollectionGrid`, `renderRefineChips`, `renderTrendingPage`,
  `lockScroll`, `unlockScroll`.
- **Never rename engine ids/handlers.** The JS reads them by id/onclick: `#go-btn`, `#output`,
  `#genre-pills`, `#adv-slider`, `setMode`, `setRatingMode`, `setLangFilter`, `setFreeOnly`,
  `onSeenClick`, `onFavClick`, … Renaming breaks the engine.

---

## CSS organization

- Single `<style>` block at the top of the file. Group rules by feature with comment banners
  (e.g. `/* ===== FULL-SCREEN MODAL FRAMEWORK ===== */`).
- Theme is **black + gold**. No bright colors except gold. The only non-gold accent is the
  existing "Seen" teal/green — never add new colored accents.
- Posters do the visual work; text is minimal. Rounded cards, soft borders, subtle shadows.
- Use the CSS variables everywhere. Gradients for gold buttons use
  `linear-gradient(180deg,var(--accent2),var(--accent))`.

---

## Component structure

- Render functions **return HTML strings** (or build small DOM fragments) and the caller injects
  them — e.g. `renderGalleryTile`, `renderCollectionTile`, `renderCollectionGrid`,
  `renderMovieList`, `renderSavedCards`, `renderCard`, `renderRefineChips`.
- **Reuse before you build.** A new feature should compose existing pieces:
  - movie detail → `openMovieDetail(m)`
  - poster grids → `.rg-grid` / `.rg-tile` and `renderCollectionGrid`
  - dialogs/overlays → the modal system (below)
- Avoid duplicate UI. Prefer one reusable modal system over per-feature popups.

---

## State management

- State is **top-level `let` variables plus `Set`s** in the inline script — no store, no reducer.
- The list-membership Sets hold `imdb_id`s and mirror the Supabase `user_movies` rows:
  - `seenSet` — Seen
  - `favSet` — Like (DB column is still `favorite`)
  - `watchSet` — Watchlist
  - `niSet` — Hidden / not-interested
  - `selGroups` — selected filter groups (Genre/Era/Length), keyed by group → `Set`
  - `selServices` — toggled streaming services
- When you add a list action, update the matching Set **and** persist to Supabase; keep the Set as
  the single source of truth the renderers read.

---

## Modal patterns

- **Reusable, flex-centered modal system.** Picker sheets (`.sheet`) and the full-screen modal
  framework (`.modal-host`, z-index 1500 base; the `.stack` variant at 1600 layers above) share
  one visual language: dark blurred backdrop, gold Done button, pinned header (title + X), pinned
  footer (Done), and **body-only scroll**.
- **Modals must be direct children of `<body>`.** On load, hosts (e.g. `sheet-host`) are relocated
  to `document.body` so `position:fixed` resolves against the viewport, not a transformed ancestor.
  Keep this — see the pitfalls below.
- **Scroll lock is reference-counted:** call `lockScroll()` on open, `unlockScroll()` on close, and
  restore the page scroll position. Do not toggle a body class directly (the old `body.sheet-open`
  approach was removed in favor of `lockScroll`/`unlockScroll`).
- Modals sit **above** the bottom nav (z-index).
- **Hidden flex siblings must be truly removed:** ensure `[hidden]{display:none}` wins, because a
  CSS `display:flex` rule overrides the UA `[hidden]` rule and leaves hidden sheets holding flex
  space (this caused the picker-drift bug).

---

## Animation guidelines

- Keep transitions short — roughly **200–250ms** (many smaller UI transitions are even faster,
  ~120–180ms). The results/detail transitions land in the 200ms range.
- Prefer **scale + fade** (transform + opacity) — they are GPU-accelerated. Avoid animating layout
  properties (width/height/top/left) on interactive paths.
- Always honor `@media (prefers-reduced-motion:reduce)` — reduce or remove motion there.
- Animations are part of the premium identity; don't remove them, but don't add gratuitous motion.

---

## Code style & performance

- Mobile-first: design and test for iPhone Safari + the installed PWA before desktop.
- Keep the DOM lightweight; render only what's needed. No heavy DOM churn on scroll.
- Prefer readability; minimize duplicated logic; small focused functions.
- Maintain accessibility where possible: aria-labels, focus on modal open/close,
  `prefers-reduced-motion`.

---

## Implementing future features (the rules)

- **Reuse** `openMovieDetail`, the poster grid, and the modal system rather than building new UI.
- **Wrap, never modify, engine setters.** To add presentation when a filter changes, wrap the
  setter on `window` — call the original first, then do your UI update — exactly as the
  segmented-pill and refine-card chips do. Do **not** edit `getRecs`, `getRandom`, or the scoring
  math to add UI.
- **Preserve every engine id and onclick** the JS reads (see Naming). Renaming breaks the engine.
- Discovery features (e.g. Trending) stay **separate and read-only** — they must never alter the
  engine or its ranking.
- Match the design language: CSS variables, gold stroke icons, poster-first, no clutter.

---

## Verify before deploy (required)

1. **Syntax-check both inline scripts** — extract each inline `<script>` and compile it (e.g.
   `vm.compileFunction`). Both must parse with **zero errors**.
2. **Engine intact** — if you touched anything near `getRecs`, confirm the
   `raw = base + popMod + …` formula and the scorers are still present (cross-check `SCORING.md`).
3. **Deploy & test on a real iPhone** — push to repo `main`, let Pages rebuild (~1–2 min), then
   test in Safari **and** the installed PWA. Desktop browsers don't reproduce iOS safe-area /
   toolbar / touch behavior.
