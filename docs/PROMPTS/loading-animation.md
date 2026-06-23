# Prompt — Cinematic Projector Loading Animation

> Paste into a fresh Claude Code session, then add your specific request at the bottom.

## Context
CINELOG is a single-file, vanilla HTML/CSS/JS app. All current work happens in **`index.html`** (the live app; `v2.html`/`v1.html` are an alias/archive — do not edit them).
Read **`CLAUDE.md`** first. The engine in `getRecs()` is PROTECTED — this task is presentation
only and must not touch scoring.

## Goal
Refine the **cinematic projector loading state** shown while the engine computes a recommendation.
It should feel like a film projector warming up — premium and intentional, not a generic spinner.
The loading state **replaces the Trending row** (or the results area) while a search runs, then
swaps out for results when `getRecs()` returns.

## Behavior
- Trigger on the **Find My Movie** CTA (`#go-btn`) and render into / over `#output`.
- **Minimum visible duration** (~700–1000ms) so a fast engine result doesn't flash the animation;
  if the engine finishes early, hold until the min duration elapses, then reveal results.
- Replace the **Trending row** while searching; restore it (or show results) when done.
- Honor **`prefers-reduced-motion`**: drop the projector flicker/shutter motion for a calm fade or
  static frame. Never strobe.

## Never break
- **Visual identity:** black + gold only, Fraunces / Inter, CSS variables for colors/fonts. The
  projector glow uses gold (`--accent`), nothing else bright.
- **Engine ids/handlers:** preserve `#go-btn` and `#output`. Do not wrap timing logic into the
  scoring math — gate the *UI reveal*, not the computation.
- **Premium animations** (200–250ms for transitions; the projector loop can be longer but smooth).

## Reuse, don't reinvent
- Existing `.projector` / `.loading` styles and any current loading markup — extend, don't fork.
- Gold **stroke SVG icons** if glyphs are needed (no colored emoji).
- The reference-counted scroll lock if the loader is a full overlay.

## Design constraints
- Mobile-first; GPU-friendly only — animate **`transform` / `opacity`**, never layout properties
  (no animating width/height/top/left → avoid reflow). Use `will-change` sparingly.
- Respect **safe-area insets** if the loader is full-screen.
- Keep the DOM lightweight; tear down timers/animation frames on completion (no leaks if the user
  re-searches rapidly).

## Verify before deploying
1. Syntax-check **both** inline `<script>` blocks (`vm.compileFunction`) — zero errors.
2. Confirm `#go-btn` / `#output` still resolve and the engine output renders after the loader.
3. Test **reduced-motion** (iOS Settings → Accessibility → Motion) and a normal run.
4. Deploy to Pages and **test on a real iPhone** (Safari + PWA): smooth 60fps, min-duration holds,
   no flash, Trending restores.
5. **Do not change `index.html`** unless explicitly told.

---
**My specific request:**
