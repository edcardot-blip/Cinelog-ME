# CINELOG — Design System

The complete design language for CINELOG, the premium black + gold, poster-first, mobile-first
movie-recommendation app. Every value below is extracted verbatim from **`v2.html`** (the active
app) — real hex codes, font names, pixel values, and class names. Use this document so future
changes always match the existing aesthetic.

> **Golden rule (from `CLAUDE.md`):** Use the CSS variables for all colors and fonts — *never*
> hardcode hex or fonts. No bright colors except gold. No green except the existing "Seen" teal
> accent. Black + gold, Fraunces headings, Inter body, poster-first. Treat the variables below as
> the single source of truth.

The overall feel to preserve: **Apple TV / A24 / luxury cinema** — premium, cinematic, minimal,
fast. Posters do the visual work; text is minimal. Elegant over flashy.

---

## 1. Color

All colors are CSS custom properties defined on `:root` (line 14 of `v2.html`):

```css
:root{
  --bg:#0a0a0b;       --bg2:#141416;      --bg3:#1c1c1f;      --bg4:#28282d;
  --text:#f6f5f3;     --text2:#a0a0a6;    --text3:#5c5c64;
  --border:#202024;   --border2:#2c2c32;
  --accent:#e8b04b;   --accent2:#f3c876;  --accent-dim:#3a2f18;
  --teal:#3bb4a8;     --teal-dim:#0e2725;
  --r:16px;  --rsm:9px;  --rpill:999px;
  --serif:'Fraunces',Georgia,serif;
  --sans:'Inter',-apple-system,sans-serif;
}
```

### Backgrounds (darkest → lightest)

| Variable | Hex | Usage |
|---|---|---|
| `--bg` | `#0a0a0b` | App canvas / page background, full-screen overlays, sticky-table header fill |
| `--bg2` | `#141416` | Cards, panels, stats, result cards, modals (`.card`, `.card-surface`, `.stat`, `.set-panel`, `.md-sheet`, `.sheet`) |
| `--bg3` | `#1c1c1f` | Inset controls: pills, inputs, segmented tracks, service rows, close buttons |
| `--bg4` | `#28282d` | Hover state for `--bg3` surfaces, active badges, segmented-option hover |

The page background is not flat black — `body` layers two radial gradients over `--bg`:
```css
background-image:
  radial-gradient(ellipse 80% 50% at 50% -10%,rgba(232,176,75,.10),transparent 60%),
  radial-gradient(circle at 90% 5%,rgba(80,120,200,.04),transparent 40%);
```
This is a warm gold glow at the top-center plus a faint cool blue accent top-right. Full-screen
overlays (`.results-overlay`, `.collection-overlay`, `.modal-fs`) repeat a tighter version of the
same gold-glow gradient so they feel continuous with the home screen.

### Text

| Variable | Hex | Usage |
|---|---|---|
| `--text` | `#f6f5f3` | Primary text, headings, titles (a warm off-white, never pure `#fff`) |
| `--text2` | `#a0a0a6` | Secondary text: subtitles, meta lines, body copy, captions |
| `--text3` | `#5c5c64` | Tertiary / muted: placeholders, ranks, disabled labels, group labels |

Note: a few one-off body-copy colors exist for legibility on tinted surfaces — `.why` uses
`#c8c7c3`, `.md-why p` uses `#d4d3cf`, `.md-rb`/badges use their own per-rating hexes (below).

### Borders

| Variable | Hex | Usage |
|---|---|---|
| `--border` | `#202024` | Default card/divider borders, hairlines, table rules |
| `--border2` | `#2c2c32` | Stronger borders: pills, inputs, segmented controls, hover-from state. Hover often goes to literal `#4a4a52` |

### Accent — Gold (the brand color)

| Variable | Hex | Usage |
|---|---|---|
| `--accent` | `#e8b04b` | **The gold.** CTAs, active states, kicker text, section numbers, icon stroke, profile bubble ring, focus borders |
| `--accent2` | `#f3c876` | Lighter gold for gradients (top of gold buttons), active labels, hero italic could use either; used for `.bnav-item.active`, `.rg-mode` count accents |
| `--accent-dim` | `#3a2f18` | Dark muted-gold fill behind gold elements: AI tags, `.refine-spark` background, no-color-mix fallbacks for active states |

Gold CTAs use a vertical gradient `linear-gradient(180deg,var(--accent2),var(--accent))` with black
text (`#1a1305`, never pure black) — see Buttons.

### Teal — the ONE sanctioned non-gold accent ("Seen")

| Variable | Hex | Usage |
|---|---|---|
| `--teal` | `#3bb4a8` | "Seen" affordance only: the `.seen-btn:hover`, signed-in auth pill (`.auth-pill.in`), DB-connected tag |
| `--teal-dim` | `#0e2725` | Dark teal fill for the marked/active "Seen" state, cost-option `.on` background |

Marked "Seen" text uses `#7fe3d8`; border `#1c4a45`. **Do not introduce any other green** — this
teal is the sole exception per the constitution.

### Action-state accent tints (movie-detail & card toggles)

Each personal-list action has a fixed tint used on `.marked` / hover. These are **not** new brand
colors — they exist only to differentiate the four toggles:

| Action | Border | Text | Marked background |
|---|---|---|---|
| Seen | `#1c4a45` | `#7fe3d8` | `var(--teal-dim)` |
| Like / Favorite | `#c2557a` | `#f0a0bd` | `rgba(194,85,122,.16)` |
| Watchlist | `#5b8fd6` | `#a8c8f0` | `rgba(91,143,214,.16)` |
| Hide | `#a05a5a` | `#e09a9a` | `rgba(160,90,90,.16)` |

### Rating-badge colors (IMDb / RT / Meta)

A matched badge set — same geometry, only color differs (`.rating-badge` / `.md-rb`):

| Badge | Border | Text | Background |
|---|---|---|---|
| IMDb (`.rb-imdb` / `.rimdb`) | `#78350f` | `#fbbf24` | `#2d1f00` |
| Rotten Tomatoes (`.rb-rt` / `.rrt`) | `#7f1d1d` | `#f87171` | `#2d0a0a` |
| Metacritic (`.rb-meta` / `.rmeta`) | `#1e3a5f` | `#7db0ff` | `#0c1a2e` |

The gallery IMDb chip (`.rg-imdb`) is the one bright exception — solid IMDb yellow `#f5c518` with
`#1a1305` text, deliberately mimicking the IMDb logo.

### Recommendation-score colors (`.score`)

`.sg` good `#4ade80`/`#052e16`, `.sb` blue `#38bdf8`/`#0c1a2e`, `.sa` amber `#fbbf24`/`#2d1f00`,
`.sr` red `#f87171`/`#2d0a0a`.

### Error surface

`.err` uses background `#1a0505`, border `#7f1d1d`, text `#f87171`.

---

## 2. Typography

Two families only, loaded from Google Fonts:

- **`--serif`: `'Fraunces',Georgia,serif`** — all headings, titles, and the hero. A high-contrast
  display serif. Used at weight **600** with negative tracking (`letter-spacing:-.01em` to `-.02em`).
- **`--sans`: `'Inter',-apple-system,sans-serif`** — all body copy, labels, buttons, meta, UI chrome.

Body default: `font-family:var(--sans)` with `-webkit-font-smoothing:antialiased`.

### The hero title (signature element)

```html
<div class="hero-new">
  <h1>What Should I <span class="em">Watch?</span></h1>
  <p class="hero-sub">…</p>
</div>
```
```css
.hero-new h1{font-family:var(--serif);font-size:clamp(27px,6vw,42px);font-weight:600;
  letter-spacing:-.02em;line-height:1.06;margin-bottom:.45rem}
.hero-new h1 .em{font-style:italic;font-weight:500;color:var(--accent)}   /* gold italic accent */
```
The `.em` span is the **gold italic accent** — a single word set in italic Fraunces at the gold
`--accent`, against off-white. This italic-gold treatment is the brand's typographic signature.
(The standalone `h1` rule for full-screen contexts uses `clamp(34px,6vw,52px)`.)

### Type scale (representative, from real rules)

| Role | Class | Size / weight |
|---|---|---|
| Hero title | `.hero-new h1` | `clamp(27px,6vw,42px)` / 600 serif |
| Hero subtitle | `.hero-sub` | `clamp(13px,3.4vw,15px)` / `--text2` |
| Kicker (eyebrow) | `.kicker` | `12px` / 600, `letter-spacing:.22em`, uppercase, gold, with hairline rules via `::before`/`::after` |
| Section title | `.section-title` | `20px` / 600 serif |
| Stat number | `.stat-n` | `32px` / 600 serif |
| Result card title | `.title` | `23px` / 600 serif |
| Movie-detail title | `.md-title` | `25px` / 600 serif |
| Gallery mode label | `.rg-mode` | `17px` / 600 serif |
| Collection title | `.cg-title` | `18px` / 600 serif |
| Modal title | `.modal-fs-title` | `21px` / 600 serif |
| Body / meta | `.meta`, `.hero-sub` | `12–15px` / `--text2` |
| Vibe label | `.vibe-label` | `15px` italic serif, `--accent2` |
| Tab / pill labels | `.trend-tab`, `.pill` | `12.5–13px` / 600 (tabs), 450 (pills) |
| Nav label | `.bnav-lbl` | `10.5px` / 600 |

Numeric badges use `font-variant-numeric:tabular-nums` so digits align.

---

## 3. Spacing & Rhythm

- Layout is **rem-based** for vertical rhythm, **px** for fine control inside components.
- Page wrapper: `body{padding:3.5rem 1rem 5rem}`, `.wrap{max-width:760px;margin:0 auto}`.
- Section spacing: `.section{margin-bottom:1.5rem}`; `.section-head{margin-bottom:1rem}`.
- Card padding: `.card-surface{padding:1.35rem 1.45rem}` (→ `1.1rem 1rem` on mobile);
  `.card{padding:1.2rem 1.4rem}`.
- Field rhythm: `.field{margin-bottom:1.4rem}` (→ `1.2rem` mobile).
- Gaps between pills/chips: `7–9px`; grid gallery gaps `13–18px` (scale up by breakpoint).
- **Safe-area insets** are used everywhere a surface touches a screen edge, via
  `max(<fallback>,env(safe-area-inset-*))` — bottom nav, modal heads/feet/bodies, gallery and
  collection padding. Always wrap edge padding this way for iPhone notch/home-indicator support.

Breakpoints in use: `780px` (tablet), `640px` / `600px` / `500px` (mobile), `380px` (narrow
phones); and min-width gallery grid steps at `520px`, `820px`, `1100px`.

---

## 4. Corner Radius

Three tokens plus a few component-specific literals:

| Token | Value | Usage |
|---|---|---|
| `--r` | `16px` | Cards, panels, stats, CTAs, modal surfaces, status boxes |
| `--rsm` | `9px` | Inputs, posters on result cards, dashed toggles, segmented track, service rows |
| `--rpill` | `999px` | All pills, chips, badges, score tags, the auth/prefs pills, nav active |

Component literals you'll also see: modal/sheet/detail cards use **`22px`** (`.modal-fs-done`
keeps `--r`, but `.sheet`, `.md-sheet`, `.md-hero` use `22px`); gallery tiles use **`13px`**;
`.refine-card` uses **`18px`**; segmented pills/options **`9–13px`**; nav items `12px`; small
badges `3–8px`. When in doubt, prefer the tokens.

---

## 5. Shadows & Glows

Shadows are **soft and dark**; the signature lighting effect is the **gold glow**.

**Soft elevation (dark):**
- Modals/sheets: `box-shadow:0 30px 90px rgba(0,0,0,.6)` (+ `0 0 0 1px rgba(255,255,255,.03) inset`)
- Settings panel: `0 24px 80px rgba(0,0,0,.55)`
- Movie-detail sheet: `0 30px 90px rgba(0,0,0,.66)`
- Gallery tiles: `0 6px 22px rgba(0,0,0,.42)` → hover `0 12px 32px rgba(0,0,0,.55)`

**Gold glows (the premium signal):**
- CTA `.go-btn`: `0 4px 24px rgba(232,176,75,.18)` → hover `0 6px 30px rgba(232,176,75,.28)`
- Profile bubble `.auth-pill`: ring + glow `0 0 0 3px rgba(232,176,75,.08),0 2px 12px rgba(232,176,75,.22)`
- Active mode card `.mode-card.on`: `0 0 0 1px rgba(232,176,75,.35),0 6px 26px rgba(232,176,75,.18)`
- Refine card `.refine-card`: layered inset + drop + `0 0 24px rgba(232,176,75,.06)`
- Vibe input focus: `0 0 0 4px rgba(232,176,75,.10),0 0 40px rgba(232,176,75,.10)`
- Slider thumb: white knob with gold halo `0 0 0 6px rgba(232,176,75,.10)` and a 3px gold border

The gold glow always uses `rgba(232,176,75,…)` (= `--accent`) at low alpha. Use sparingly and only
on interactive/premium elements; never as a generic drop shadow.

---

## 6. Animation Philosophy

Fast, GPU-friendly, and restrained — motion should feel like a luxury UI, never a toy.

- **Durations:** micro-interactions `120–150ms` (`.14s`/`.12s`), state/entrance transitions
  `200–260ms` (`.2s`–`.26s`), overlays `300–350ms` (`.3s`/`.34s`). Reel/glow loops 4.5–9s.
- **Easing:** standard transitions use `ease`; entrances use a springy
  `cubic-bezier(.22,.9,.3,1)` or `cubic-bezier(.2,.9,.3,1)`; "pop" affordances (sheets, pills,
  detail sheet) use overshoot `cubic-bezier(.34,1.2,.4,1)` and `cubic-bezier(.2,1.25,.4,1)`.
- **Pattern:** **scale + fade** for appearance. Modals/sheets enter from `scale(.9)→1` /
  `opacity 0→1`; overlays slide `translateY(10–14px)→0` while fading. Buttons press to
  `scale(.92–.99)` on `:active`.
- **GPU-only properties:** animations stick to `transform` and `opacity` (and `filter` for glows)
  to stay compositor-friendly on mobile. Several loaders set `will-change:opacity`.
- **`prefers-reduced-motion`:** honored. The projector loader disables its looping animations and
  swaps the progress bar to a calmer `projProgReduced` alternate:
  ```css
  @media (prefers-reduced-motion:reduce){
    .proj-glow,.proj-beam,.proj-dust i,.proj-grain,.proj-reel,.proj-lensglow{animation:none!important}
    .proj-beam{opacity:.7}.proj-glow{opacity:.7}
    .proj-prog::after{animation:projProgReduced 1.6s ease-in-out infinite alternate}
  }
  ```

**Keyframe catalog** (define new motion by reusing these where possible):
`fade`, `spin`, `pulse`, `tagin`, `tilein` (gallery tile entrance), `pillpulse` (action-pill bump),
`trendin`, `trendskel` (skeleton shimmer), and the projector set: `projGlow`, `projBeam`,
`projDust`, `projGrain`, `projSpin`, `projLens`, `projProg`, `projProgReduced`.

---

## 7. Icons

Icons are **monochrome gold-stroke SVGs**, never colored emoji (some emoji glyphs still appear as
quick labels in mode cards / nav, but all *chrome* icons follow this spec):

```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"> … </svg>
```

- **`viewBox="0 0 24 24"`**, `fill="none"`, **`stroke="currentColor"`**, **`stroke-width="1.7"`**,
  rounded caps/joins.
- Color comes from the parent's `color` (usually `--accent`/`--text`/`--text2`), so a single icon
  recolors by context. The profile bubble, quick-filter icons, refine spark, stat icons, and the
  gallery "Refine" gear all use this exact pattern.
- Keep `aria-hidden="true"` on decorative icons.

---

## 8. Buttons

### Gold CTA — `.go-btn` ("Find My Movie")
```css
.go-btn{width:100%;padding:17px;font-size:16px;font-weight:600;
  background:linear-gradient(180deg,var(--accent2),var(--accent));border:none;border-radius:var(--r);
  color:#1a1305;box-shadow:0 4px 24px rgba(232,176,75,.18)}
.go-btn:hover:not(:disabled){filter:brightness(1.06);transform:translateY(-1px);
  box-shadow:0 6px 30px rgba(232,176,75,.28)}
.go-btn:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
```
On mobile it grows to `padding:18px;font-size:17px;min-height:56px`. The same gold-gradient +
`#1a1305` text recipe is reused by `.modal-fs-done` and `.sheet-done-sm`. **All gold buttons use
near-black `#1a1305` text, never `#000`.**

### Pills — `.pill`
```css
.pill{border:1px solid var(--border2);border-radius:var(--rpill);padding:7px 15px;font-size:12.5px;
  color:var(--text2);background:var(--bg3);transition:all .14s;font-weight:450}
.pill:hover{border-color:#4a4a52;color:var(--text);transform:translateY(-1px)}
.pill.on-amber{background:#2d1a00!important;border-color:var(--accent)!important;
  color:var(--accent2)!important;box-shadow:0 0 0 1px rgba(232,176,75,.35)}
```
Selected pills use the **amber/gold "on" treatment**. Mobile bumps tap targets to `min-height:44px`.
Picker-sheet pills (`.sheet .pills .pill`) grow to `min-height:46px;padding:12px 18px`.

### Refine card — `.refine-card`
A full-width premium button-card on the home screen that opens Advanced Filters:
```css
.refine-card{background:linear-gradient(180deg,var(--bg3),var(--bg2));
  border:1px solid rgba(232,176,75,.30);border-radius:18px;
  box-shadow:0 0 0 1px rgba(232,176,75,.05) inset,0 8px 30px rgba(0,0,0,.45),0 0 24px rgba(232,176,75,.06)}
.refine-card:hover{border-color:rgba(232,176,75,.55); /* stronger glow */}
.refine-card:active{transform:scale(.985)}
```
It carries a gold `.refine-spark` icon, a serif `.refine-title` (with a gold `.refine-arrow`),
selectable `.refine-chip`s summarizing current filters, and a gold `.refine-adjust` call-to-action.

### Pill chrome buttons
`.prefs-btn` and `.auth-pill` are small pill buttons (`--bg3`, `--border2`, gold hover). The
profile variant of `.auth-pill` is circularized (see Profile). Close buttons (`.set-close`,
`.modal-fs-x`, `.md-close`, `.sheet-x`) are `34px`/`30px` circles on `--bg3` that press to
`scale(.92)`.

---

## 9. Cards

Shared card recipe: `background:var(--bg2)`, `border:1px solid var(--border)`, `border-radius:var(--r)`,
soft padding, subtle hover.

- **`.card-surface`** — the generic panel container.
- **`.card`** (result card) — `display:flex;gap:17px`, hover lifts `translateY(-1px)` and brightens
  the border. Holds the `.poster`, `.title-row`, rating `.rpills`, `.why`, and a 2×2 `.card-acts`
  grid (`.act-seen/.act-fav/.act-watch/.act-hide`).
- **`.stat`** — centered stat tile with a 2px gold top-edge accent (`::before`) and an icon.
- **`.refine-card`** — see Buttons (the premium gradient/glow card).
- **`.mode-card`** — recommendation-mode selector (see below).

### Recommendation mode cards — `.mode-cards` / `.mode-card`
```css
.mode-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mode-card{background:var(--bg2);border:1px solid var(--border2);border-radius:var(--rsm);
  padding:.95rem .55rem;text-align:center;transition:all .15s}
.mode-card.on{background:color-mix(in srgb,var(--accent) 13%,var(--bg2));border-color:var(--accent);
  box-shadow:0 0 0 1px rgba(232,176,75,.35),0 6px 26px rgba(232,176,75,.18)}
.mode-card.on .mc-title{color:var(--accent2)}
```
Three equal cards (Smart Mix / Fresh Picks / Surprise Me). The selected card gets the gold tint
(`color-mix`, with `--accent-dim` fallback) + gold glow; its `.mc-title` turns `--accent2`.

---

## 10. Movie Posters

Posters are the visual core — **aspect ratio 2/3**, poster-first.

- **Result-card poster** `.poster`: `width:144px;height:216px;border-radius:var(--rsm);object-fit:contain`.
  Responsive: `168×252` (tablet), `216×324` (desktop), `124×186` (mobile).
- **Gallery / collection tile** `.rg-tile`: `aspect-ratio:2/3;border-radius:13px;overflow:hidden`,
  `img{object-fit:cover}`, soft shadow, hover `translateY(-3px)`, entrance via `tilein`. A bottom
  gradient scrim (`::after`) improves legibility of overlaid badges.
- **Tile badges:** `.rg-rank` (serif rank pill, top-left) and `.rg-imdb` (solid IMDb-yellow chip,
  top-right).
- **Poster fallback** `.rg-noposter`: gradient placeholder (`linear-gradient(160deg,var(--bg3),var(--bg2))`)
  with an icon (`.rg-np-ic`) and the serif title (`.rg-np-title`) — never a broken image.
- Posters are TMDB URLs (`image.tmdb.org`) per the catalog pipeline.

---

## 11. Modals (the reusable system)

There is **one reusable modal system** — reuse it; don't invent new overlays (constitution rule).

**Host + backdrop** (`.modal-host` / `.modal-backdrop`):
```css
.modal-host{position:fixed;inset:0;z-index:1500;display:none}
.modal-host.stack{z-index:1600}              /* a modal stacked above another */
.modal-host.open{display:block}
.modal-backdrop{position:fixed;inset:0;background:rgba(6,6,8,.62);backdrop-filter:blur(2px);
  opacity:0;transition:opacity .25s ease,backdrop-filter .25s ease}
.modal-host.shown .modal-backdrop{opacity:1;backdrop-filter:blur(12px)}  /* blur ramps up */
```

**Full-screen panel** (`.modal-fs`) — flex column, fades + slides up, springy easing:
```css
.modal-fs{position:fixed;inset:0;display:flex;flex-direction:column;background:var(--bg);
  /* repeats the home gold-glow radial */ opacity:0;transform:translateY(10px);
  transition:opacity .26s ease,transform .3s cubic-bezier(.2,.9,.3,1)}
.modal-host.shown .modal-fs{opacity:1;transform:none}
```
Sticky `.modal-fs-head` and `.modal-fs-foot` use `rgba(10,10,11,.82–.88)` + `backdrop-filter:blur(14px)`;
all four edges use `max(<rem>,env(safe-area-inset-*))`. Footer holds the gold `.modal-fs-done`.

**Centered card variants** — flex-centered with backdrop blur and scale+fade:
- **Sheet picker** `.sheet` (Genre/Era/Length): `.sheet-host{display:flex;align-items:center;
  justify-content:center}`, card at `border-radius:22px`, enters `scale(.96)→1` via
  `cubic-bezier(.34,1.2,.4,1)`. Backdrop blur ramps `2px→10px`. **Hidden sheets must use
  `display:none` (`.sheet[hidden]{display:none!important}`)** — a leftover gotcha noted in
  `CLAUDE.md` (flex space from hidden siblings drifted the picker off-center).
- **Movie detail** `.md-overlay` (z 1300): flex-centered, `backdrop-filter:blur(7px)`, sheet at
  `460px`/`22px` enters `scale(.9) translateY(10px)→none` via `cubic-bezier(.2,1.25,.4,1)`.

**Z-index ladder:** bottom nav `900` < settings overlay `1000` < results/collection overlays `1200`
< movie detail `1300` < modal host `1500` < stacked modal (My Subscriptions) `1600`.

**Scroll lock:** modals call reference-counted `lockScroll()`/`unlockScroll()` (restore scroll
position on close). Full-screen overlays/modals must be **direct children of `<body>`** — a
`position:fixed` element resolves against the nearest transformed ancestor, so the picker host is
relocated to body on load (CLAUDE.md gotcha).

---

## 12. Navigation

### Header / top bar (`.apphead`)
The hero sits in `.apphead` with the circular profile bubble pinned top-right (see Profile). The
home screen has no persistent top chrome beyond this — it's a clean hero.

### Bottom tab bar (`.bottom-nav`)
```css
.bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:900;display:flex;
  background:rgba(14,14,16,.92);backdrop-filter:blur(14px);border-top:1px solid var(--border2);
  padding:8px 6px max(8px,env(safe-area-inset-bottom))}
.bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--text3);
  padding:6px 4px;border-radius:12px;min-height:48px;transition:color .14s,background .14s}
.bnav-item.active{color:var(--accent2)}
.bnav-item.active .bnav-ic{filter:drop-shadow(0 0 8px rgba(232,176,75,.35))}  /* gold glow on active icon */
```
Five tabs: **Discover · Watchlist · Likes · Seen · More**. Idle tabs are `--text3`; the active tab
turns gold (`--accent2`) with a gold drop-shadow glow on its icon. Each tab is `.bnav-ic` (19px
glyph) over a `.bnav-lbl` (10.5px / 600). `navTo(tab)` routes; `setNavActive(tab)` swaps `.active`.
The bar uses translucent blur and safe-area bottom padding so it floats above the home indicator,
and sits **below** the modal layers (z 900).

---

## 13. Loading — the Cinematic Projector

The signature loader (`.proj-loader`) is a self-contained cinema vignette shown in place of the
trending row while recommendations compute. It is a layered composition:

| Layer | Element | Effect |
|---|---|---|
| Backdrop | `.proj-loader` | Radial gold glow + dark gradient panel, fades in via `.vis` |
| Glow | `.proj-glow` | Soft gold orb, `projGlow` breathing loop (4.5s) |
| Beam | `.proj-beam` | Angled projector light beam, masked + clipped, `projBeam` flicker |
| Dust | `.proj-dust i` | Floating dust motes drifting through the beam, `projDust` (9s) |
| Grain | `.proj-grain` | SVG `feTurbulence` film-grain, `screen` blend, `projGrain` steps |
| Device | `.proj-device` | Inline SVG projector with spinning `.proj-reel`s + glowing `.proj-lensglow` |
| Text | `.proj-title` / `.proj-status` | Serif title ("Scanning the catalog") + rotating status line |
| Progress | `.proj-prog` / `::after` | Thin gold indeterminate bar, `projProg` sweep |

All looping layers are disabled under `prefers-reduced-motion` (the progress bar switches to the
calmer `projProgReduced`). This loader embodies the "luxury cinema" brand moment and must not be
removed (constitution).

The lightweight inline `.spin` spinner (gold-topped ring, `spin` keyframe) is used for small
inline/async states.

---

## 14. Overall Visual Style — quick reference

- **Black + gold, always.** `--bg` canvas, `--bg2` cards, gold `--accent` for everything premium.
- **Off-white, not white** (`--text` `#f6f5f3`); **near-black on gold, not black** (`#1a1305`).
- **Fraunces serif** for anything that should feel editorial; **Inter** for everything functional.
  The gold *italic* word in the hero is the signature.
- **Poster-first.** 2/3 posters, soft-rounded, with graceful gradient fallbacks.
- **Soft dark shadows + low-alpha gold glows.** No harsh shadows, no neon.
- **Motion is fast (120–350ms), springy, scale+fade, GPU-only, and reduced-motion-aware.**
- **Gold-stroke 24×24 SVG icons** (`stroke-width:1.7`, `currentColor`). No multicolor emoji in chrome.
- **One reusable modal system**, safe-area aware, scroll-locked, body-rooted, layered by a strict
  z-index ladder.
- The feel: **Apple TV / A24 / Four Seasons** — premium, cinematic, minimal, fast. Elegant over flashy.
