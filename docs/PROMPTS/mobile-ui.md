# Prompt — Mobile / PWA UI Rules

> Paste into a fresh Claude Code session, then add your specific request at the bottom.

## Context
CINELOG is a single-file, vanilla HTML/CSS/JS app. All current work happens in **`index.html`** (the live app; `v2.html`/`v1.html` are an alias/archive — do not edit them).
Read **`CLAUDE.md`** first. **iPhone Safari + the installed PWA is the primary experience** —
design for it first; desktop is secondary. The engine in `getRecs()` is PROTECTED.

## Goal
Get the mobile / PWA experience right: safe-areas, one-screen fits, real tap targets, and the
layout gotchas that have bitten this app before.

## The mobile rules (non-negotiable)
- **Safe-area insets.** Use `env(safe-area-inset-top/bottom/left/right)` so headers clear the notch
  and CTAs / bottom nav clear the home indicator. Verify the `viewport-fit=cover` meta is present.
- **One-screen fits.** The homepage wizard fits one iPhone screen down to the **Find My Movie** CTA
  with no scroll. Don't let a redesign push the CTA below the fold.
- **44px tap targets.** Every interactive element (pills, mode cards, action pills, nav, profile
  bubble) is at least 44×44px.
- **Premium animations** stay (200–250ms ease); use GPU-friendly `transform`/`opacity`.

## Hard-won gotchas (do not re-break these)
1. **`position:fixed` resolves against the nearest *transformed* ancestor**, not the viewport.
   Full-screen modals/overlays must be **direct children of `<body>`** (the picker host is
   relocated to body on load for exactly this reason). Don't put `transform`/`will-change`/`filter`
   on an ancestor that wraps a fixed overlay.
2. **A CSS `display` rule overrides the UA `[hidden]` rule.** Hidden siblings in a **flex**
   container still take space unless truly removed — always include `[hidden]{display:none}`. This
   bug drifted the Genre/Era/Length picker off-center.
3. **Scroll-lock is reference-counted** (`lockScroll`/`unlockScroll`); restore the page scroll
   position on close. Modals must sit **above** the bottom nav (z-index).

## Never break
- **Visual identity:** black + gold, Fraunces / Inter, CSS variables, poster-first, minimal text.
- **Engine ids/handlers:** `#go-btn`, `#output`, `#genre-pills`, `#adv-slider`, `setMode`,
  `setRatingMode`, `setLangFilter`, `setFreeOnly`, `onSeenClick`, `onFavClick`.
- The homepage hierarchy (Hero → Quick Filters → Mode → Find My Movie) and the one-screen wizard.

## Reuse, don't reinvent
- The **one reusable modal system** (flex-centered, direct child of `<body>`).
- Poster grid **`.rg-grid` / `.rg-tile`** and the shared collection component.
- Gold **stroke SVG icons** (viewBox `0 0 24 24`, `stroke="currentColor"`, ~1.7 width). No emoji.

## Verify before deploying
1. Syntax-check **both** inline `<script>` blocks (`vm.compileFunction`) — zero errors.
2. Confirm engine ids/handlers resolve; no scoring touched.
3. **Test on a real iPhone — both Safari *and* the installed PWA.** Check: safe-area top/bottom,
   one-screen fit, 44px targets, modals centered (no drift), hidden sheets removed from flow,
   scroll lock + restore, rotation. Desktop browsers do **not** reproduce iOS safe-area / toolbar /
   touch behavior.
4. **Do not change `index.html`** unless explicitly told.

---
**My specific request:**
