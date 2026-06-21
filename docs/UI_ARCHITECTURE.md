# CINELOG — UI Architecture

A screen-by-screen map of CINELOG's interface as built in **`v2.html`** (the active app). For each
screen: **Purpose · Layout · Components · Interactions · Navigation · Animations**. Element ids,
class names, and function names are quoted verbatim from the source so future sessions can find and
extend them safely.

> CINELOG is a single-file vanilla HTML/CSS/JS app. The whole UI is a stack of full-screen
> overlays and modals layered over one home screen, governed by a strict z-index ladder
> (nav `900` < settings `1000` < results/collection `1200` < movie detail `1300` < modal host
> `1500` < stacked modal `1600`) and a reference-counted scroll lock (`lockScroll`/`unlockScroll`).
> See `DESIGN_SYSTEM.md` for visual tokens.

**Navigation primitives shared by every screen:**
- `navTo(tab)` — bottom-tab router (`discover` / `watchlist` / `favorites` / `seen` / `more`).
- `setNavActive(tab)` — moves the gold `.active` state on the bottom nav.
- `openModalHost(id)` / `closeModalHost(id)` — generic modal show/hide (adds `.open`, then `.shown`
  next paint for the animation; aria-hidden toggled).
- `lockScroll()` / `unlockScroll()` — reference-counted body scroll freeze (restores scroll Y).
- Esc closes overlays in priority order: subscriptions → advanced → sheet/movie-detail → gallery →
  collection → trending → settings.

---

## 1. Home / Discover

**Container:** `#screen-discover` (the only always-present screen; the default bottom-nav tab).

**Purpose.** The one-screen wizard that takes a user from open to a great pick in seconds. It owns
the brand hero, quick filters, recommendation mode, and the single "Find My Movie" CTA. Per the
constitution its hierarchy — **Title → Quick Filters → Refine → Recommendation Mode → Find My Movie**
— must not be reordered.

**Layout (top → bottom).**
1. **Header / hero** — `.apphead` containing the circular profile bubble (`#auth-pill`, pinned
   top-right) and `.hero-new`:
   ```html
   <h1>What Should I <span class="em">Watch?</span></h1>   <!-- serif, gold italic "Watch?" -->
   <p class="hero-sub">The perfect movie in seconds.</p>
   ```
2. **Quick-filter buttons** (`.qfilters`) — three tappable summaries with gold-stroke icons:
   - Genre → `onclick="openSheet('genre')"`, value shown in `#qf-genre-val`
   - Era → `openSheet('era')`, value in `#qf-era-val`
   - Length → `openSheet('length')`, value in `#qf-length-val`
3. **Refine Results card** (`#adv-disc`, class `.refine-card`) → `onclick="openAdvanced()"`. Shows a
   gold spark icon, "Refine Results" serif title, a subtitle, and `.refine-chip`s summarizing the
   current advanced filters (rebuilt by `renderRefineChips()`).
4. **Recommendation mode cards** (`#mode-seg`, `.mode-cards`) — two `.mode-card`s (2-col grid):
   - `#mode-hybrid` ("Smart Mix" / "Best Overall", default `.on`) → `setMode('hybrid')`
   - `#mode-random` ("Surprise Me" / "Random Pick") → `setMode('random')`
   - `#mode-desc` shows a dynamic italic description; `#mode-rewatches` is a hidden compatibility stub.
     (Fresh Picks was removed — it duplicated Smart Mix's ranking. Also note: a homepage **Streaming
     Services** selector sits between the Genre/Era/Length row and Refine Results.)
5. **Stats row** (`.stats`) — two stat tiles with gold-edge accents and SVG icons:
   `#seen-count` ("Seen") and `#s-pool` ("Match", the current matched-pool size).
6. **Find My Movie CTA** (`#go-btn`, `.go-btn`) — gold gradient button, label "✦ Find My Movie"
   (becomes "✦ Surprise me" in random mode).
7. **Output / loaders** — `#output` (status messages if filters return nothing), `#proj-loader`
   (the cinematic projector, shown during a fetch), and `#trend-row` (the trending preview).

**Components.** Profile bubble, quick-filter pills, refine card, mode cards, stat tiles, gold CTA,
projector loader, trending scroller.

**Interactions.**
- `setMode(m)` toggles the `.on` mode card, updates `#mode-desc` and the CTA label.
- Tapping `#go-btn` (listener near line 3015) calls `getRecs()` (ranked) or `getRandom()` (shuffle)
  depending on the active mode; the button disables while the request is in flight.
- `updatePoolCount()` / `updateSeenCount()` keep `#s-pool` / `#seen-count` live as filters change.

**Navigation.** Quick-filter buttons open the picker sheets; the refine card opens Advanced Filters;
the CTA opens the **Recommendation Results** gallery; the trending "See all" opens the **Trending**
page; the profile bubble triggers auth; the bottom nav routes to the collection screens.

**Animations.** The hero is static; tapping a mode card animates its gold-tint `.on` state; the CTA
lifts on hover and presses on active; launching a recommendation cross-fades `#trend-row` out and the
`#proj-loader` in.

---

## 2. Movie Detail (floating modal)

**Container:** `#md-overlay` → `#md-sheet` (`role="dialog"`, `aria-modal="true"`). Opened by
`openMovieDetail(m)` (~line 3206); z-index `1300`.

**Purpose.** The reusable deep-view for a single film: artwork, metadata, ratings, where to watch,
why it was recommended, and the four personal-list actions. Opened from every poster everywhere
(gallery, collections, trending) so it's the canonical detail surface.

**Layout.** A centered, scrollable sheet (max `460px`, radius `22px`). The vertical order is the
intended reading hierarchy: **backdrop → poster → title → meta → director → genres → ratings →
streaming → why → library actions**, with generous section spacing.
- `.md-close` — small **glass** close button (top-right): blurred translucent circle, gold-stroke
  SVG ✕. Reusable style for close buttons app-wide.
- `.md-hero` — 16/10 artwork (dimmed backdrop, gradient fade) with a floating 2/3 `.md-hero-poster`
  (enlarged ~94px, soft shadow) that scales in on open.
- `.md-body`:
  - `.md-title` (serif, prominent), `.md-meta` (year · runtime · MPAA — one line).
  - `.md-credit.md-director` (secondary, one line) — shows **all** director names inline when there
    are ≤3 (e.g. sibling duos); collapses to "+N more" only for the rare 4+ "bunch" case. Then
    **genres**: ≤3 → all inline; >3 → first
    three + a `.md-genre-more` "Show all" toggle (`mdShowAllGenres()`) that reveals `.md-genre-chips`
    (all genres as wrapped chips). **Never "+N".** Note: `.md-genre-chips[hidden]{display:none}` is
    required — a CSS `display` rule overrides the UA `[hidden]` rule.
  - `.md-ratings` — matched rating badges on **one uniform line** (`flex-wrap:nowrap`):
    `.rating-badge.rb-imdb`, `.rb-rt`, `.rb-meta` (identical height/padding/border/font). Each is
    now a **clickable external link** (`a.rb-link`, opens in a new tab) to that film's page:
    IMDb is an exact deep-link (`/title/<imdb_id>/`); RT & Metacritic use each site's **search
    endpoint** keyed on the title (robust — no fragile per-title slugs, never 404s). URLs are
    generated on the fly by `ratingLinks(m)` — **no URLs are stored**. (Same links are wired on the
    `.card` rating pills, with `event.stopPropagation()` so a badge tap doesn't open the card.)
  - **Where to watch** — a responsive **2-column provider grid** (`.md-providers` → `.md-prov`
    cards: colored `--svc` dot · provider name · `FREE`/`RENT`/`BUY` tag), built by
    `mdProviderCard(a, m, spanFull)`. Identical card width/height/padding; free providers sort
    first. **Even-grid rule:** on an odd count, the single least-important *paid* storefront is
    dropped so there's no lonely card — keep priority is free/streamable > Apple TV > Amazon/Prime >
    YouTube/Google Play, with anything else (e.g. Fandango) dropped first; if every provider is free
    (nothing to spare) the last card spans both columns instead. Each card links to the service via
    `streamingLink(svc, m)` (per-service `searchUrl` in the static `SERVICES` config — no per-movie
    URLs; prefers `m.watch_link` if ever stored). *(Result cards still use inline `.av` pills.)*
  - `.md-why` — gold-tinted panel: "✨ Why we picked this" + `mdWhyText(m)`, which builds an
    **interesting, varied** one-liner from the film's own attributes (critics/audience scores,
    hidden-gem status, genre blend, era, runtime, genre-family mood, lead actor) and picks one by a
    **stable hash of the id** — so the catalog reads with variety while a film stays consistent.
    Deliberately avoids the flat "Directed by X" line.
  - `#md-acts` — four **compact** `.md-pill` action cards (gold-stroke SVG icons) built by
    `mdActionPills(m)`: **Seen** (`act-seen`) · **Like** (`act-fav`) · **Watchlist** (`act-watch`)
    · **Hide** (`act-hide`). Selected = subtle glow/outline (Seen teal, Like gold glow, Watchlist
    gold outline, Hide muted) — never a filled block.

**Components.** Hero artwork, floating poster, uniform rating-badge set, provider grid, why panel,
4-up compact action cards.

**Interactions.**
- Each pill: `onclick="mdAct(this,'<fn>','<id>')"` where `<fn>` is the engine handler from
  `mdActFn(act)` — `onSeenClick` / `onFavClick` / `onWatchClick` / `onNiClick`. `mdAct` calls the
  handler and repaints the pills via `rebuildMdActs()` **immediately** (the handler flips the
  in-memory set synchronously before its network await), then **again after the await** to reconcile
  a rolled-back/failed save — so toggling on/off feels instant instead of waiting on the round-trip.
  The toggled pill plays a `pillpulse` bump.
- Selected pills all show the **same subtle gold glow** (border + text `--accent`/`--accent2` + soft
  glow) — consistent and on-brand, never a filled block. The `.act-*:hover` / `.act-*.marked` rules
  are scoped to `.card-act` (and hovers wrapped in `@media (hover:hover)`) so they don't leak into
  `.md-pill` — an earlier unscoped `:hover` was sticking on touch after a tap, leaving an un-selected
  pill still coloured.
- Backdrop click or `.md-close` closes; Esc closes the detail first (before any underlying overlay).

**Navigation.** Opened via `openMovieDetailById(id)` from gallery/trending tiles and
`openCollectionDetail(id)` from collection tiles. `closeMovieDetail()` calls
`refreshOpenCollection()` so toggling Like/Watchlist updates the underlying collection grid live.

**Gotcha — display the RAW rating values.** The detail modal reads `m.imdb_rating` directly for
the IMDb badge, **not** `m._imdb`. The engine sets `m._imdb = imdb_rating*10` internally (a 0–100
pill-presence signal); rendering `_imdb` would show "IMDb 74" instead of "7.4". (`_rt`/`_meta`
already match their 0–100 columns, so only IMDb is affected.)

**Animations** (~220–240 ms, premium). Backdrop fades + blurs in (`blur(8px)`, `.22s`); the sheet
slides up + scales in (`scale(.96) translateY(14px) → none`, `.24s`); the poster scales in
(`scale(.92) → none`) just after. Closing reverses. Pills press to `scale(.93)` and pulse on
toggle. All transforms are disabled under `prefers-reduced-motion`.

---

## 3. Quick-Filter Sheets (Genre / Era / Length)

**Container:** `#sheet-host` with `#sheet-genre`, `#sheet-era`, `#sheet-length`. Opened by
`openSheet(group)` (~line 1970), closed by `closeSheet()`; z-index `1500`.

**Purpose.** Centered pop-up sheets that surface the engine's existing multi-select pill grids in a
focused, mobile-friendly card — keeping the home screen uncluttered.

**Layout.** A centered `.sheet` card (radius `22px`) with `.sheet-head` (centered serif
`.sheet-title` + "All"/"Clear" `.clr` buttons + a small gold `.sheet-done-sm`) and a scrollable
`.sheet-body` holding the reused pill grid: `#genre-pills`, `#era-pills`, or `#length-pills`.

**Components.** Sheet card, header actions, picker pills (`.sheet .pills .pill`, selected =
`.on-amber` gold).

**Interactions.** Tap pills to multi-select; "All"/"Clear" reset; "Done" / backdrop / close-X
dismiss. Selections flow back into the home quick-filter value labels.

**Navigation.** Launched from the three home quick-filter buttons; returns to Home on close.

**Animations.** `.open` mounts the host, `.shown` (set next paint) blurs the backdrop `2px→10px` and
springs the card `scale(.96)→1` via `cubic-bezier(.34,1.2,.4,1)`. **Gotcha:** hidden sheets use
`display:none` (`.sheet[hidden]`) — they must be fully removed from the flex flow or the picker
drifts off-center.

---

## 4. Advanced Filters — "Refine Results" (full-screen modal)

**Container:** `#adv-modal` (`.modal-host`). Opened by `openAdvanced()` (~line 1831), closed by
`closeAdvanced()`.

**Purpose.** A full-screen modal for the deeper preference controls that personalize the engine —
Language, Where to Watch, Ratings lean, and the "How Adventurous?" slider — plus access to My
Subscriptions. The home `.refine-card` mirrors its current state.

**Layout.** `.modal-fs` with sticky `.modal-fs-head` ("Advanced Filters" + close-X) and a scrolling
`.modal-fs-body.af-body` of sections:
- **Language** — `#lang-seg` segmented control (`#lang-all` "Subtitles OK" default / `#lang-en`
  "English Only"), help in `#lang-note`.
- **Where to Watch** — `#cost-seg` (`#cost-any` "Stream, Rent, or Buy" default / `#cost-free`
  "My Subscriptions"). Selecting My Subscriptions slides open `#svc-picker` with a `#subs-row` that
  opens the Subscriptions modal; `#subs-row-sub` summarizes chosen services.
- **Ratings** — `#rating-seg` (3-way: `#rating-audience` "Audience" / `#rating-balanced` "Balanced"
  default / `#rating-critics` "Critics"), help in `#ratings-desc`.
- **Adventurous slider** (`.adv-card`) — `#adv-slider` (0–100) with a live `#adv-badge`
  (`band-0`…`band-4`), tick labels (Deep Cuts / Balanced / Crowd Favorites), and `#adv-desc`.

**Components.** Gold sliding-pill segmented controls, the My Subscriptions row, the signature
adventurous slider (white knob, gold halo, gradient track).

**The gold sliding-pill segment.** Each `.af-seg` contains an absolutely-positioned gold pill
`.af-pill` (`linear-gradient(180deg,var(--accent2),var(--accent))`) that animates beneath the
options via `transform:translateX()` + `width` over `cubic-bezier(.34,1.2,.4,1)`. The active
`.cost-opt.on` text/icon turns near-black `#1a1305`. `positionSegPill(seg)` snaps the pill to the
current selection; `positionAllSegPills(true)` runs with `.no-anim` on first paint so it doesn't
slide in from the corner.

**Interactions.** `setLangFilter(v)`, `setFreeOnly(v)` (also opens subscriptions when true),
`setRatingMode(mode)` (re-scores an open gallery), and the slider's `input` handler updating the
badge/ticks/description.

**Navigation.** Opened from the home refine card (and the gallery's `.rg-refine` button). On close,
`renderRefineChips()` refreshes the home summary. The My Subscriptions row opens `#subs-modal`.

**Animations.** Standard `.modal-fs` slide-up + fade; segmented pills slide; the subscriptions
picker (`#svc-picker`) expands its `max-height`/`opacity`.

### 4a. My Subscriptions (stacked modal)
**Container:** `#subs-modal` (`.modal-host.stack`, z `1600`). `openSubscriptions()` /
`closeSubscriptions()`. A `.modal-fs` with "All"/"Clear" actions and `#service-pills` (toggleable
service pills from the `SERVICES` set). Stacks above Advanced Filters; `updateSubsRow()` keeps the
`#subs-row-sub` summary in sync.

---

## 5. Recommendation Results (full-screen poster gallery)

**Container:** `#results-overlay` (`.results-overlay`, z `1200`). `openResultsGallery(groups, mode)`
(~line 3158) / `closeResultsGallery()`.

**Purpose.** The payoff screen — a full-screen poster gallery of the engine's picks after "Find My
Movie" or "Surprise Me." Poster-first, minimal chrome.

**Layout.**
- Sticky `.rg-head`: `.rg-back` ("‹ Back"), centered `.rg-titles` with `#rg-mode` (the mode label
  via `MODE_LABELS`) over `#rg-count` ("N picks"), and a `.rg-refine` gear button.
- Scrollable `.rg-body` containing `.rg-grid` (responsive 2→5 columns) of `.rg-tile`s. Optional
  `.rg-group-label`s separate groups (e.g. Fresh + Rewatch picks).

**Components.** Gallery header (back / mode / count / refine), poster tiles with `.rg-rank` and
`.rg-imdb` badges, `.rg-noposter` fallbacks.

**Interactions.** `renderGalleryTile(m, rank)` builds each tile (rank omitted in Surprise Me);
tapping `openMovieDetailById(id)` opens the shared detail modal (films cached in `galleryFilms`).
`.rg-refine` reopens Advanced Filters; Back / Esc close the gallery.

**Navigation.** Entered from the home CTA; tiles → Movie Detail; refine → Advanced Filters; back →
Home.

**Animations.** Overlay fades + slides up (`translateY(14px)→0`, `.3s`); tiles enter staggered via
`tilein` (per-tile `animation-delay`, ~32ms step, capped ~520ms); tiles lift on hover.

---

## 6. Collection Pages — Watchlist / Likes / Seen / Hidden

**Container:** `#collection-overlay` (`.collection-overlay`, z `1200`). `openCollection(type)`
(~line 3423) / `closeCollection()`. One shared page serves all four list types via `COLLECTION_DEFS`:
```js
watchlist {set:watchSet, title:'Watchlist', icon:'🔖'}
favorites {set:favSet,   title:'Likes',     icon:'♥'}
seen      {set:seenSet,  title:'Seen',      icon:'✓'}
hidden    {set:niSet,    title:'Hidden',    icon:'🙈'}
```

**Purpose.** Browse and manage the user's saved films. Reuses the gallery's `.rg-grid`/`.rg-tile`
visual language for consistency, with added count/search/sort.

**Layout.**
- `.cg-head`: `.rg-back`, centered `.cg-titles` (`#cg-title` + `#cg-count` "N films"), `.cg-head-spacer`.
- `#cg-controls`: a `.cg-search` input (`#cg-search-input`, live `renderCollectionGrid()`) and a
  `.cg-sort` `<select>` (`#cg-sort-select`: Recently Added / Alphabetical / Release Year / IMDb /
  Runtime).
- `#cg-body`: the `.rg-grid` of tiles, or a `.cg-state` empty/loading/sign-in state.

**Components.** Collection header, search box, sort dropdown, poster grid, per-type empty states,
sign-in CTA.

**Interactions.** `renderCollectionGrid()` filters by title (case-insensitive) and sorts by the
selected key. Tiles → `openCollectionDetail(id)` (shared Movie Detail). When detail closes,
`refreshOpenCollection()` re-filters so un-liked / un-watchlisted films drop out live. If signed
out, an empty-state sign-in button calls the auth flow.

**Navigation.** Opened by the bottom nav (`navTo('watchlist'|'favorites'|'seen')`) and from the
Settings "Lists" shortcuts. Hidden is reached via More → Lists. Close resets nav to `discover`.

**Animations.** Same overlay fade/slide-up as the results gallery; tiles use `tilein`.

---

## 7. Trending (full page, tabbed)

**Container:** `#trend-overlay` (z `1200`). `openTrendingPage()` (~line 4345) / `closeTrendingPage()`.

**Purpose.** A read-only discovery surface (separate from the recommendation engine, per the
constitution). Revamped 2026-06-21: genuinely surfaces *current* films, not just all-time classics.

**Scoring (separate from `getRecs`).** `trendingScore = trendAdjPopularity·0.45 + trendQuality·0.35
+ trendRecency·0.20`. `trendAdjVotes` mirrors the engine's `adjVotes` (a film gaining votes fast
reads as popular), so recent/buzzy titles lead. The candidate pool (`loadTrendPool`) is **two merged
fetches**: top ~250 by rating **plus** the ~180 most-voted films from the last 5 years — so recent
titles actually qualify (the old single rating-sorted pool excluded them). No free-streaming gate.

**Layout.**
- `.cg-head` (reuses collection header styling): `.rg-back`, `.cg-title` "Trending", `#trend-count`.
- `.trend-search` (`#trend-search-input`): a **global catalog search** bar that queries the *entire*
  `movies` table (`title=ilike.*word*…`, popular-first, limit 60) — not just the trend pool.
  Debounced (`onTrendSearchInput` → `runTrendSearch`, race-guarded by `trendSearchQuery`); results
  render in `#trend-page-body` (tabs deactivate). Clearing (`clearTrendSearch`) or switching tabs
  restores the active tab.
- `#trend-tabs` (`role="tablist"`): **four** `.trend-tab`s — **Trending** (`trending`, recency-aware
  buzz), **New Releases** (`new`, last 3 yrs by buzz), **Crowd-Pleasers** (`crowd`, ≥150k votes +
  strong rating), **Hidden Gems** (`gems`, high rating + <80k votes). `setTrendingTab(tab)` →
  `trendTabList(tab, pool)`. Active tab gets the gold `.on` treatment.
- `#trend-page-body`: a `.trend-blurb` (per-tab one-liner) + a `.rg-grid` of `.rg-tile`s. Tiles carry
  a reused `.rg-rank` `#N` badge (Trending & Crowd-Pleasers only) and a `.rg-imdb` rating chip;
  `openTrendDetail(id)` on tap. Loading spinner during `loadTrendPool()`.

**Components.** Tabbed header, poster grid, the home trending preview row (`#trend-row` /
`#trend-scroller`, a 4-poster horizontal scroll with a "See all" → `openTrendingPage()`).

**Interactions.** `setTrendingTab(tab)` swaps the active tab and re-renders; tiles open Movie Detail;
Back / Esc close.

**Navigation.** Opened from the home trending row's "See all"; tiles → Movie Detail; back → Home.

**Animations.** Overlay fade/slide-up; tiles `tilein`; the home preview row uses `trendin` /
`trendskel` skeleton shimmer while loading.

---

## 8. Profile / Authentication

**Purpose.** Google sign-in/out (Supabase OAuth) and account identity. Per-user lists (`seen`,
`favorite`/Like, `watchlist`, `not_interested`/Hidden) are RLS-scoped to the signed-in user.

**The gold profile bubble** (`#auth-pill`, in `.apphead`). A circular, gold-ringed button pinned
top-right with a layered gold glow:
- Signed out: `.auth-pill` showing a person-outline gold SVG; `aria-label="Sign in with Google"`.
- Signed in: `.auth-pill.in` showing the user's initials via `authInitials(full, email)`, in `--accent2`.

**Interactions.** `onAuthPill()` (~line 2666) branches: signed-in → confirm → `signOut()`;
signed-out → `signInGoogle()`. `updateAuthPill()` re-renders the bubble from `currentUser`;
`updateAccountUI()` updates the Settings account row; `initAuth()` restores an existing session and
wires auth listeners. The Settings "Account" group (`#set-account`) shows either a "Sign in with
Google" row or the name/email + "Sign out".

**Navigation.** The bubble is always available from Home. Signing in/out re-renders the bubble,
account row, and unlocks/locks the collection pages' content.

**Animations.** Bubble lifts/brightens on hover (gold glow intensifies), presses to `scale(.95)`.

---

## 9. Settings ("More") — premium redesign (2026-06-21)

**Container:** `#set-overlay` → `.set-panel` (z `1000`). `openSettings()` / `closeSettings()`;
opened by the **More** bottom-nav tab (`navTo('more')`).

**Purpose.** A polished, iOS-style preferences page (Apple Settings / Letterboxd / Things 3 feel).
Every row does something real — no "Planned"/placeholder rows. It re-homes the *user preferences*
that used to live in Advanced Filters or were unimplemented, and surfaces the user's collections.

**Layout — `#set-menu`** (gold-stroke SVG icons throughout, grouped `.set-list` cards):
- **Profile header** `#set-profile` (`renderSettingsProfile()`): gold avatar (initials or Google
  `avatar_url`), name, "N Movies Seen", favourite genres (from `favProfile.genres`), "Joined …"
  (`currentUser.created_at`). Signed-out → Welcome + **Sign in** button.
- **Recommendations:** **Streaming Services** row → `openSubscriptions()` (the existing picker;
  prefs already persist via `saveSubscriptionPrefs`), summary in `#set-subs-meta`; **Language**
  segmented (`setLangPref('en'|'all')` → persisted `cinelog_lang`, calls `setLangFilter`).
  *(Recommendation mode lives on the home screen's mode cards — not duplicated here. The
  adventurous slider lives in the Advanced Filters / "Refine Results" modal — see §4 — not here.)*
- **My Collection:** a single **Hidden** row with live count (`#set-hidden-count`) →
  `openCollection('hidden')`. Seen / Likes / Watchlist are reached from the **bottom nav**, so only
  Hidden (which has no nav tab) lives here.
- **Appearance:** Theme — Dark (Default).
- **About:** live Movies-in-Catalog (`totalFilms`) + Last Updated (fetched once into `_lastDbUpdate`)
  + Version (`APP_VERSION`) + Build (`APP_BUILD`); then tappable rows → `openInfo(key)` info modal
  (`#info-ov`, z `1400`): What's New / Send Feedback / Contact Support / Rate / Privacy / Terms
  (`INFO_CONTENT`; feedback/support use `mailto:`).
- **Footer** `.set-foot2`: CINELOG · Version 1.0 · "Built for people who love movies."

The persisted language pref (`cinelog_lang`) is re-applied on load via a small IIFE.
`refreshSettings()` repaints the profile, the Hidden count, the language segmented state, the
streaming summary and About stats on every open. `#set-lists` / `#set-listview` / `openList()`
remain for the legacy in-overlay list path but are no longer the primary route (collections open
full-screen via `openCollection`).

**Navigation.** Reached via More; closing resets the bottom nav to `discover`. Esc closes
info-modal → subscriptions → advanced → sheet → settings in order.

**Animations.** `.set-overlay.open` reveals the panel (blur backdrop, elevation shadow); rows press
on tap, segmented buttons scale on `:active`; all motion respects `prefers-reduced-motion`.

---

## 10. Bottom Tab Bar (global)

**Container:** `#bottom-nav` (`.bottom-nav`, `aria-label="Primary"`, z `900`). Persistent across the
app, floating above content with a blurred translucent background and safe-area bottom padding.

**Purpose.** Primary navigation between the five top-level destinations.

**Tabs & routing** (each `.bnav-item` = `.bnav-ic` glyph over `.bnav-lbl`):

| Tab | id | Glyph | `navTo(...)` → |
|---|---|---|---|
| Discover | `#nav-discover` (default `.active`) | ✦ | Home (close settings, scroll top) |
| Watchlist | `#nav-watchlist` | 🔖 | `openCollection('watchlist')` |
| Likes | `#nav-favorites` | ♥ | `openCollection('favorites')` |
| Seen | `#nav-seen` | ✓ | `openCollection('seen')` |
| More | `#nav-more` | ☰ | `openSettings()` |

**Interactions.** `navTo(tab)` (~line 2047) dispatches; `setNavActive(tab)` (~line 2063) moves the
`.active` class. The active tab turns gold (`--accent2`) with a gold drop-shadow glow on its icon.
Closing Settings auto-resets the active tab to Discover.

**Animations.** Tab color transitions `.14s`; the active icon gains
`filter:drop-shadow(0 0 8px rgba(232,176,75,.35))`.

---

## Quick function index

| Function | Opens / does |
|---|---|
| `navTo(tab)` / `setNavActive(tab)` | Bottom-nav routing / active state |
| `openSheet(g)` / `closeSheet()` | Genre/Era/Length picker sheets |
| `openAdvanced()` / `closeAdvanced()` | Advanced Filters modal |
| `openSubscriptions()` / `closeSubscriptions()` | My Subscriptions (stacked) modal |
| `setMode(m)` | Select recommendation mode (hybrid/fresh/random) |
| `setLangFilter` / `setFreeOnly` / `setRatingMode` | Advanced filter toggles |
| `positionSegPill` / `positionAllSegPills` | Animate the gold sliding pill |
| `getRecs()` / `getRandom()` | Run engine / shuffle, then open gallery |
| `openResultsGallery(groups,mode)` / `closeResultsGallery()` | Results poster gallery |
| `openCollection(type)` / `closeCollection()` / `renderCollectionGrid()` | Watchlist/Likes/Seen/Hidden |
| `openTrendingPage()` / `closeTrendingPage()` / `setTrendingTab(t)` | Trending page + tabs |
| `openMovieDetail(m)` / `openMovieDetailById(id)` / `closeMovieDetail()` | Movie Detail modal |
| `openSettings()` / `closeSettings()` / `openList(which)` | Settings + Lists |
| `onAuthPill()` / `signInGoogle()` / `signOut()` / `updateAuthPill()` | Authentication |
| `lockScroll()` / `unlockScroll()` / `openModalHost` / `closeModalHost` | Shared overlay plumbing |
