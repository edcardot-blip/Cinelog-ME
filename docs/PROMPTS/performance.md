# Prompt — Mobile Performance

> Paste into a fresh Claude Code session, then add your specific request at the bottom.

## Context
CINELOG is a single-file, vanilla HTML/CSS/JS app (no framework, no build) — a large `v2.html`
with two inline `<script>` blocks. All current work happens in **`v2.html`**. Read **`CLAUDE.md`**
first. The engine in `getRecs()` is PROTECTED — optimize *around* it, don't change its math.
**Mobile (iPhone Safari + installed PWA) is the primary target.**

## Goal
Improve runtime performance and perceived smoothness on a phone, without changing visual identity
or engine behavior. Aim for consistent 60fps animations and fast time-to-first-interaction.

## What "fast" means here (the levers)
- **GPU-friendly animation only.** Animate **`transform` and `opacity`**, never layout/paint
  properties (no animating width/height/top/left/margin). Use `will-change` *sparingly* and remove
  it after the animation.
- **Lightweight DOM.** Don't build huge node trees up front. For long poster grids, render what's
  visible / lazy-load offscreen posters (`loading="lazy"`), reuse tiles where practical.
- **Lazy work.** Defer non-critical computation (e.g. Trending's `trendingScore`) until needed;
  cache results instead of recomputing on every render. Don't block first paint on it.
- **Avoid reflow / layout thrash.** Batch DOM reads then writes; don't read `offsetWidth` in a loop
  interleaved with style writes. Use `requestAnimationFrame` for visual updates; debounce search
  inputs and scroll handlers.
- **Reduced-motion.** Honor `prefers-reduced-motion` — calmer fades, no strobing — and treat it as
  a perf path too (less work when motion is reduced).

## Never break
- **Visual identity:** black + gold, Fraunces / Inter, CSS variables, poster-first. Don't strip the
  **premium animations** to gain speed — make them cheaper instead. Keep transitions in the
  200–250ms range.
- **Engine ids/handlers and math:** `#go-btn`, `#output`, `#genre-pills`, `#adv-slider`, `setMode`,
  `setRatingMode`, `setLangFilter`, `setFreeOnly`, `onSeenClick`, `onFavClick`, and the
  `raw = base + popMod + …` scoring stay intact.
- Behavior parity — optimizations must not change what the user sees, only how fast.

## Gotchas to respect
- A `position:fixed` element resolves against the nearest **transformed ancestor**; don't add
  `transform`/`will-change` to a container that hosts full-screen modals or you'll re-break
  centering. Keep modals direct children of `<body>`.
- Reference-counted `lockScroll`/`unlockScroll`; tearing those down wrong leaks scroll state.
- Clean up timers / `requestAnimationFrame` / observers (no leaks on rapid re-search or navigation).

## Verify before deploying
1. Syntax-check **both** inline `<script>` blocks (`vm.compileFunction`) — zero errors.
2. Confirm engine ids/handlers and the scoring formula are unchanged; behavior is identical.
3. Profile on a **real iPhone** (Safari + PWA): scroll a long grid, run several searches, open/close
   modals — watch for jank, reflow, and memory growth. Test reduced-motion.
4. **Do not change `index.html`** unless explicitly told.

---
**My specific request (name the screen/interaction that feels slow):**
