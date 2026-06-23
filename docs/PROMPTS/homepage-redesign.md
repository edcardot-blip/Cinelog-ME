# Prompt — Homepage / One-Screen Wizard Redesign

> Paste this into a fresh Claude Code session, then add your specific request at the bottom.

## Context
CINELOG is a single-file, vanilla HTML/CSS/JS app (no framework, no build). All current work
happens in **`index.html`** (the live app; `v2.html`/`v1.html` are an alias/archive — do not edit
them). Read **`CLAUDE.md`** (the constitution) and **`SCORING.md`** before
touching anything. Backend is Supabase; the recommendation engine in `getRecs()` is PROTECTED.

## Goal
Refine the **homepage one-screen wizard** — the first thing the user sees. It must answer
"What should I watch tonight?" in under 10 seconds. The established hierarchy (do **not** reorder
it):

1. **Hero** — title/brand, premium and minimal.
2. **Quick-filter sheets** — the Genre / Era / Length pickers (bottom-sheet modals).
3. **Recommendation Mode cards** — the mode selectors that call `setMode(...)`.
4. **Find My Movie** — the primary CTA (`#go-btn`) that runs the engine into `#output`.
5. **Trending row** — a discovery strip below the wizard.

**The whole wizard must fit one iPhone screen with no scroll** (down to the CTA). The Trending row
may sit just below the fold; the wizard above it does not scroll.

## Never break
- **Visual identity:** black + gold only (`--accent` `#e8b04b`, `--accent2`; `--bg/--bg2/--bg3`).
  No bright colors except gold; no green except the existing "Seen" teal. **Fraunces** headings
  (`--serif`), **Inter** body (`--sans`). Use the CSS variables — never hardcode hex/fonts.
- **Engine ids/handlers:** preserve `#go-btn`, `#output`, `#genre-pills`, `#adv-slider`, and the
  `setMode` / `setRatingMode` / `setLangFilter` / `setFreeOnly` handlers exactly. Renaming any of
  them breaks the engine.
- **Poster-first, minimal text.** Don't turn the homepage into a dashboard or a settings page.
- **Premium animations** (200–250ms ease transitions). Don't remove them.

## Reuse, don't reinvent
- The **one reusable modal system** for the quick-filter sheets — flex-centered, and the host must
  be a **direct child of `<body>`** (a `position:fixed` element resolves against the nearest
  transformed ancestor, not the viewport).
- Existing **mode card** and **pill** components and their styles.
- Gold **stroke SVG icons** (viewBox `0 0 24 24`, `stroke="currentColor"`, ~1.7 stroke width).
  Never colored emoji.

## Design constraints
- Mobile-first; respect **safe-area insets** (`env(safe-area-inset-*)`) top and bottom so the hero
  clears the notch and the CTA clears the home indicator / bottom nav.
- Tap targets ≥ 44px. Modals must sit above the bottom nav (z-index) and use the reference-counted
  `lockScroll` / `unlockScroll` (restore scroll position on close).
- Hidden flex siblings must be **truly removed** (`[hidden]{display:none}`) — a CSS `display` rule
  overrides the UA `[hidden]` rule and the pickers will drift off-center.

## If you tune the engine
Don't — unless explicitly told. Presentation changes must **wrap** engine setters on `window`
(call the original, then update UI), as done for the segmented-pill and refine-card chips. Never
edit the scoring math to change the homepage.

## Verify before deploying
1. Extract **both** inline `<script>` blocks and syntax-check them (e.g. `vm.compileFunction`) —
   zero errors.
2. Confirm every engine id/handler above still resolves.
3. Deploy to Pages and **test on a real iPhone** (Safari + installed PWA): one screen, no scroll
   to the CTA, safe-area correct. Desktop browsers don't reproduce iOS behavior.
4. **Do not change `index.html`** unless explicitly told.

---
**My specific request:**
