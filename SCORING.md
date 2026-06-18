# Cinelog Recommendation Scoring — Reference

> **PROTECTED LOGIC — changes require explicit owner approval, one lever at a time, with before/after.**
>
> This document describes the scoring pipeline *exactly as it currently behaves* in
> `index.html`. It is a read-only capture of a hard-won, tuned recipe. Do not treat
> anything here as a suggestion to change the math. If a number ever needs to move,
> move ONE number, record the before/after behavior, and get owner sign-off first.

Line numbers are approximate — the file has grown to ~2010 lines since the Tier-2
changes, so treat them as a guide, not exact. The engine lives in `getRecs()`, with
`getRandom()`, the adventurous-slider handler, `setRatingMode`, and `setMode`.

> **Tier-2 update (post-original-capture):** four behaviors were ADDED after this doc's
> first version — `favoriteBonus`, `recencyBonus`, an output-diversity reorder, and the
> mixed candidate pool — plus the exposure-bump fix (#7) and an in-UI diagnostics panel.
> See **§13** for the additions; §1 (pool), §9 (raw formula), §11 (exposure bump /
> diversity), and §12 (diagnostics) are corrected inline below.

---

## 1. Data fetch & candidate pool

**Constants (lines 649–655):**
```
CANDIDATE_LIMIT = 500
POOL_LIMIT      = CANDIDATE_LIMIT   // ranking operates over the full candidate pool
```

**Why the pool is large (verbatim intent, comment lines 649–653):** `CANDIDATE_LIMIT`
is how many films we pull from the DB to rank over, and it *must* be large. The "How
Adventurous?" slider can only surface lesser-known films if lesser-known films are
actually in the pool. Ordering by rating alone capped at 30 gave a pool that was
~all blockbusters, so the popularity penalty had nothing obscure to promote. 500
well-rated films include ~110 hidden gems.

**The query (getRecs, lines 1489–1501):**
- Columns: `imdb_id,title,year,runtime_minutes,genre,director,actors,imdb_rating,rotten_tomatoes_score,metascore,poster_url,vote_count,original_language,mpaa_rating,franchise` plus `streaming`.
- Built by `buildQuery(...)` (applies genre/era/length DB filters) with
  `&order=imdb_rating.desc.nullslast` appended.
- If the `streaming` column is missing the request is retried *without* it
  (`streaming` column may not exist yet) so the app still works (1496–1501).

**Streaming = ELIGIBILITY, not a quality cutoff (Tier-3 fix, v2.html):**
```
streamingActive = freeOnly && selServices.size > 0;
```
A selected streaming service is an **availability filter, not a hidden rating cap**. When a service
is selected, the candidate fetch is **streaming-aware**: it queries films that list any selected
service (server-side, `&or=(streaming->>alias.not.is.null,…)` via `streamingFilterParam()`, limit
1000) matching the genre/era/length filters — then ranks them. So on-service films rated below the
global top-rated pool's cutoff are still eligible (e.g. Apple TV+ now returns CODA, Killers of the
Flower Moon, The Lost Bus, Causeway…, not just the 1 that slipped through before). `passesStreaming`
still applies client-side for the precise free-tier check; discovery merge is skipped on this path.

When **no** service is selected, behavior is byte-for-byte unchanged: top-rated `POOL_LIMIT=500`
fetch + the discovery merge. The MATCH count is likewise streaming-aware so it no longer reads ~0.

> Earlier this fetched the global top-500-by-rating *then* filtered to on-service films, which
> created an accidental ~7.9 IMDb cutoff and hid most on-service titles. Fixed: availability →
> eligibility, rating → rank.

**Mixed candidate pool — discovery (Tier-2 addition, see §13d):** when the primary
rating-sorted fetch comes back FULL (`pool.length >= fetchLimit` — more films matched
than were pulled, so the obscure end got cut off), a second "discovery" fetch pulls up to
`DISCOVERY_LIMIT = 150` of the LEAST-popular quality films matching the same filters
(`order=vote_count.asc.nullslast`, `imdb_rating >= 6.5`, `vote_count not null`) and merges
them in, deduped by `imdb_id`. The ranking cap becomes `MERGED_LIMIT = POOL_LIMIT +
DISCOVERY_LIMIT = 650`. SKIPPED when the primary pool isn't full (narrow filters already
contain everything), so those cases stay byte-for-byte unchanged; the cap raise is a no-op
then. Best-effort — a discovery failure degrades to the primary pool.

**Surprise Me fetch (getRandom, line 1446):** uses its own `RANDOM_FETCH_LIMIT = 1500`
(generous enough that low-rated indies can also be drawn), same `order=imdb_rating.desc.nullslast`.

---

## 2. Client-side filters applied BEFORE ranking

These are defined in the data layer and *consumed* by the engine — they are NOT
redefined inside `getRecs`. Applied at lines 1506 (and 1456 in getRandom):

```
pool = pool.filter(m => passesLang(m) && passesKid(m) && !isNotInterested(m));
if (streamingActive) pool = pool.filter(passesStreaming).slice(0, POOL_LIMIT);
```

| Filter | Defined at | Behavior |
|---|---|---|
| `passesLang(m)` | 764 | `langFilter==='all'` → true; else `m.original_language==='en'`. |
| `passesKid(m)` | 1223 | `kidOnly` off → true; else `m.mpaa_rating` ∈ {G, PG, TV-G, TV-PG} (`KID_RATINGS`, line 1222). |
| `isNotInterested(m)` | 898 | `niSet.has(m.imdb_id)`; engine uses `!isNotInterested(m)`. |
| `passesStreaming(m)` | 749 | `freeOnly` off → true; no services selected → true; else film must be available on ≥1 selected service in a free tier (`FREE_TIERS` line 707). |

When a filter empties the pool, getRecs emits a contextual "No films match…" status
and returns early (1503, 1507–1513, 1518–1522).

---

## 3. `qualityScore(m)` — weighted rating blend (lines 1538–1549)

> **Tier-3 (v2.html):** audience-driven genres (Comedy/Horror/Action/Adventure/Romance) now
> override these weights and fold in popularity — see **§16**. The blend below is the baseline
> used for all other (critic-respected) genres.

Rating-source weights, set by the 3-way Audience/Balanced/Critics control
(`RATING_WEIGHTS`, lines 1262–1266; default `ratingMode = 'balanced'`, line 1272):

| Mode | IMDb | Rotten Tomatoes | Metascore |
|---|---|---|---|
| `audience` | 0.85 | 0.075 | 0.075 |
| `balanced` | 0.50 | 0.25 | 0.25 |
| `critics`  | 0.15 | 0.425 | 0.425 |

IMDb never fully disappears — it stays at 15% even in Critics mode as an
audience reality-check (comment line 1261).

**Computation:**
- IMDb is rescaled to 0–100 as `imdb_rating * 10`; RT and Meta are used as-is.
- Each present source contributes `value * weight` to `weighted`, and its weight to `totalW`.
- **Renormalization when a source is missing:** the average is `weighted / totalW`,
  i.e. it divides only by the weights actually present, so missing sources don't drag
  the score toward zero.
- **No usable signal** (`totalW < 0.0001`) → returns a neutral `65`.
- **Confidence penalty by source count** (`present`):
  - 3 sources → `0`
  - 2 sources → `-2`
  - 1 source → `-5`
- Result clamped to `[0, 100]`: `Math.max(0, Math.min(100, avg + conf))`.

---

## 4. `fitScore(m)` — runtime/era fit (lines 1551–1566)

Starts at `score = 100`. The `-50` partial penalties:

- **Length:** if any length pill is selected and the film's `runtime_minutes` does
  **not** fall in a selected band → `score -= 50`. A null runtime always passes
  (`inLen = true`). Bands: Under 90 (`rt<90`), 90–120 (`rt>=90 && rt<=120`),
  120–150 (`rt>120 && rt<=150`), Over 150 (`rt>150`).
- **Era:** if any era pill is selected and the film's `year` is non-null and not in a
  selected decade range → `score -= 50`. A null year does not get penalized.

Returns `Math.max(0, score)`. So a film failing both length and era can reach 0.

---

## 5. `popularityScore(m)` — log-scale fame (lines 1571–1575)

```
if (m.vote_count == null || m.vote_count <= 0) return 50;   // unknown → neutral
lv = log10(vote_count);
return clamp01_100( ((lv - 3) / 3) * 100 );
```
Maps **1k votes → 0**, **1M votes → 100**, interpolated linearly on log10 between,
clamped to [0, 100]. This is the "fame" score (stored as `m._fame`).

---

## 6. The Adventurous slider → continuous weights

`advPos` (0–100, line 1239) is the continuous driver for ALL adventurous math; the
UI bands (`ADV_BANDS`, 1231–1237: Deep Cuts / Hidden Gems / Balanced / Popular Picks /
Crowd Favorites) are *labels only* and do not touch the math.

**Derived weights (lines 1636–1643):**
```
ratingsWeight     = 0.55                          // fixed; quality-vs-fit blend
blockbusterWeight = max(0, (50 - advPos) / 50)    // 0→1 sliding LEFT (Lesser Known)
crowdWeight       = max(0, (advPos - 50) / 50)    // 0→1 sliding RIGHT (Crowd Favorites)
qualityFactor     = 1 - 0.05 * blockbusterWeight  // quality counts slightly less when obscure
```
Both one-sided weights are 0 at the true center (advPos=50), so partial positions
(25/75) get partial-strength effects, not just the extremes.

Also derived: `genreFactor = 1 - (2/3) * blockbusterWeight` (line 1679; 1.0 at
center/right → 0.33 at full left) — used to scale genre bonuses (see §7).

**`stretch(x)` — contrast stretch (line 1646):**
```
stretch(x) = clamp01_100( 50 + (x - 50) * 1.4 )
```
Amplifies gaps between quality scores around the 50 midpoint so the list isn't flat.

**`lerpAnchors(votes, anchors)` — piecewise-linear interpolation (lines 1649–1657):**
Null votes treated as 0; below the first anchor returns the first value; above the
last returns the last value; otherwise linearly interpolates between bracketing anchors.

**`LEFT_ANCHORS` (Lesser-Known full-strength modifier by vote_count, lines 1665–1668):**
```
[0, -3], [10000, -2], [25000, 5], [50000, 13], [100000, 13],
[150000, 7], [200000, 2], [300000, -10], [600000, -28],
[1000000, -45], [2000000, -52]
```
Intent (comment 1659–1664): <25k = too-obscure protection (near-neutral/slight
penalty, no boost); 25k–50k = strong lesser-known boost; 50k–100k = PEAK zone
(+13); 100k–150k = moderate; 150k–200k = nearly neutral; 200k+ = increasing
penalty as you lean left (down to very hard at 1M+).

**`RIGHT_ANCHORS` (Crowd-Favorites full-strength boost by vote_count, lines 1670–1672):**
```
[0, 0], [100000, 0], [200000, 2], [300000, 5], [600000, 13],
[1000000, 20], [2000000, 25]
```

**Applied (lines 1789–1791):**
```
leftMod  = lerpAnchors(vote_count, LEFT_ANCHORS)  * blockbusterWeight;
rightMod = lerpAnchors(vote_count, RIGHT_ANCHORS) * crowdWeight;
popMod   = leftMod + rightMod;
```

---

## 7. `genreScore(m)` — position & intent (lines 1689–1729)

OMDb stores genres primary-first. Selected genres (excluding Kid-Friendly) are
rewarded more when they sit near the FRONT of a film's genre list.

**Tables (lines 1682–1687):**
```
POS_BOOST        = [18, 9, 4, 1]   // 1 genre selected: primary, secondary, third, 4th+
POS_BOOST_STRICT = [18, 8, 2, 0]   // Comedy: strong primary, harsh once buried
PURITY_BONUS     = 7               // film is ONLY the selected genre
STRICT_GENRES    = { 'comedy' }
POS_WEIGHT       = [1.0, 0.7, 0.4, 0.2]   // multi-select: how "primary" each match is
MULTI_BASE       = { 1:6, 2:16, 3:24, 4:30 }   // by # of selected genres matched
```

**Single genre selected (lines 1700–1706):**
- If the genre isn't in the film at all (`pos < 0`) → `0`.
- Otherwise `score = (STRICT? POS_BOOST_STRICT : POS_BOOST)[min(pos,3)]`.
- If the film's genre list is exactly length 1 → add `PURITY_BONUS` (+7).

**Multiple genres selected (lines 1707–1724):**
- For each selected genre present, `matched++` and `sumW += POS_WEIGHT[min(pos,3)]`.
- If a STRICT genre (Comedy) is buried at `pos >= 2`, set `strictBuried`.
- `bonus = (MULTI_BASE[min(matched,4)] || 0) * (sumW / matched)`.
- If `strictBuried` → `bonus *= 0.6` (Comedy as a buried tertiary tag is damped).

**Final scaling (line 1726):** `total = score * genreFactor` (genreFactor from §6 —
full at center/right, shrinks toward 0.33 as you slide left). Diagnostic fields
`m._gPos/_gPrimary/_gSecondary/_gPurity/_gMulti/_gTotal` are populated for the genre
console.table. With no genres selected, returns `0`.

---

## 8. Penalties

> **Tier-3 update (v2.html):** the two hardcoded penalties below were REPLACED by a single,
> data-driven **genre-impact repel** term. See **§14** for the current behavior. The
> description here is retained as the historical baseline.

**`animationPenalty` (lines 1732–1733):** if Animation is NOT a selected genre and the
film's genre string contains "animation" → `-20`; else `0`.

**`documentaryPenalty` (lines 1734–1736):** exempt if any selected genre is in
`DOC_FRIENDLY_GENRES = {sport, music, comedy}`. Otherwise if the film's genre contains
"documentary" → `-20`; else `0`.

**`franchisePenaltyFull` (lines 1740–1749):** `franchiseCounts` tallies how many pool
members share each franchise. For a film with a franchise:
- `big = count >= 3` (3+ entries); `popular = vote_count >= 300000`.
- `big && popular` → `-25` (mega mainstream blockbuster, e.g. LOTR)
- `big` → `-20`
- otherwise → `-15`

This raw penalty is then **scaled by `blockbusterWeight`** at line 1796
(`fPen = franchisePenaltyFull(m) * blockbusterWeight`), so it only bites
**left-of-center** and fades to 0 at center/right.

**`confidencePenalty` (lines 1754–1769):** keeps ultra-obscure single-source
critic-darlings from dominating. `v = vote_count || 0`. `strong` = how many of
{IMDb≥7.5, RT≥80, Meta≥75} hold.
- `v >= 25000` → `0` (credible enough).
- `10000 <= v < 25000` → `strong >= 2 ? 0 : -8` (RT/Meta-alone demoted).
- `v < 10000` → base `pen = (v < 5000) ? -25 : -15`, then softened:
  `strong >= 3` → `pen += 20`; else `strong >= 2` → `pen += 12`. A lone strong
  source stays hard-hit.

**Exposure / rotation memory (`expPen`, lines 1771–1799):** `exposure` is read from
`localStorage['cinelog_exposure']` (no-op if unavailable). For each film:
`expCount = exposure[imdb_id] || 0; expPen = -Math.min(8, expCount * 1.5)` — a gentle
demotion (capped at -8) for films shown often, so the list rotates.

---

## 9. Final score assembly (lines 1776–1811)

```
qS   = stretch(quality)
base = qS * ratingsWeight * qualityFactor + fit * (1 - ratingsWeight)
raw  = base + popMod + genreBonus + repelPen + fPen + confPen + expPen + favBon + recBon
```
with `ratingsWeight = 0.55`, so quality contributes 55% (after stretch and
qualityFactor) and fit contributes 45%.

> **Tier-3 (v2.html):** `animPen + docPen` were replaced by a single `repelPen` term
> (the genre-impact repel, **§14**). With no genre selected and no animation/documentary
> tag, `repelPen = 0`, so the formula reduces to the prior behavior.

`favBon` and `recBon` are the two Tier-2 additive nudges (**§13a/§13b**). Both default to
0 — `favBon` is exactly 0 with no favorites, `recBon` is 0 for films ≥15 years old — so
with no favorites and an older catalog `raw` reduces to the original formula above.

- **`raw` is intentionally NOT clamped** (comment 1801–1802): heavily-penalized
  blockbusters keep a real ordering instead of all colliding at 0.
- **Display score `m.ws`** (line 1809): `Math.max(0, Math.min(100, Math.round(raw)))`
  — clamped to 0–100 for the UI only; never used for ranking.
- Per-movie debug fields stored: `_popMod, _fPen, _genreBonus, _confPen, _expPen,
  _favBon, _recBon, _raw, _surprise (=round(fame)), _quality, _fame`.
- Rating pills: `_imdb (=imdb_rating*10), _rt, _meta` drive whether each pill renders.

**`sCls(s)` — color thresholds (line 1339):**
```
s >= 85 → 'sg' (green)   |   s >= 70 → 'sb'   |   s >= 55 → 'sa'   |   else → 'sr' (red)
```

---

## 10. Controlled randomness (lines 1813–1822)

```
NOISE = 6, CANDIDATE_POOL = 45
ranked.sort(by _raw desc)
for each m: m._noise = idx < CANDIDATE_POOL ? (random*2-1)*NOISE : 0
            m._rankScore = m._raw + m._noise
ranked.sort(by _rankScore desc)
```
Only the top 45 films get jitter in `[-6, +6]`; everything below gets `0`. Films far
ahead keep their lead; near-tied films within the top pool swap for variety. The noise
is small relative to real score gaps, so bad matches can't leap over good ones.

---

## 11. Mode splitting (lines 786–804, 1437–1481, 1857–1910)

`viewMode` ∈ `hybrid | fresh | rewatches` (line 786); `random` is handled by
`getRandom()`. The Go button dispatches: `viewMode==='random' ? getRandom() : getRecs()`
(line 1340).

After ranking, the pool splits (lines 1858–1859):
```
allUnseen = ranked.filter(m => !isSeen(m));
allSeen   = ranked.filter(m =>  isSeen(m));
```

**Exposure bump (fix #7):** only the UNSEEN films each mode actually renders get
`exposure[imdb_id] += 1`, persisted to localStorage, so surfaced films rotate out over
time. Mode-aware: **hybrid** bumps the top **10**, **fresh** the top **15**, **rewatches
none** (it renders only seen films). Previously it always bumped the top-15 unseen
regardless of mode, which silently rotated films that were never shown in Rewatch Mode.

- **`rewatches`** (legacy stub, no UI button): `allSeen.slice(0, 15)`, no fresh section.
- **`hybrid` (default = Smart Mix)**: up to **10** unseen ("Top picks", passed through
  `diversifyOrder`) + a "Worth a rewatch" divider + up to **10** seen. The rewatch picks
  are **ALWAYS Fisher-Yates shuffled** (not ranked), then the count is **rounded DOWN to an
  even number** (max 10) so the 2-up mobile grid never ends on a lonely poster (5 → 4).

> **Tier-3 (v2.html):** the **`fresh`** mode (Fresh Picks) was **removed** — it was the same
> ranking as `hybrid` with no real recency bias, so the two modes were nearly identical. The
> UI now offers just **Smart Mix** (`hybrid`) and **Surprise Me** (`random`); the seen cap
> rose from 5 to an even-rounded ≤10. See **§15**.

`diversifyOrder` (output diversity, Tier-2 addition, **§13c**) reorders an already-selected,
rank-sorted unseen list so the same primary genre doesn't stack consecutively —
SELECTION-PRESERVING (same films, #1 anchored). Not applied to rewatch or Surprise Me.

**`getRandom()` — "Surprise Me" (1437–1481):** fetches up to 1500 matching films,
applies the same client filters, Fisher-Yates shuffles, takes the first 20, and renders
without rank numbers. The Adventurous slider, rating-mode control, and ALL ranking math
are intentionally ignored (comment 1416–1419). Rating pills are mirrored from raw
values since the ranking math (which normally sets `_imdb/_rt/_meta`) didn't run
(line 1472).

---

## 12. Diagnostics — console.table breakdowns + in-UI panel

Both breakdowns live in `getRecs`, each wrapped in `try{}catch{}`, limited to the top 40:

**Scoring breakdown:** title, imdb_votes, fame, pop_mod, franchise_pen, genre_bonus,
conf_pen, exp_pen, **fav_bonus**, **recency**, quality, raw, display. (`fav_bonus` and
`recency` are the Tier-2 columns.)

**Genre breakdown:** title, selected_genres, movie_genres, genre_positions,
primary_genre_match, secondary_genre_match, genre_purity_bonus, multi_genre_bonus,
total_genre_score.

**In-UI diagnostics panel (Tier-1 addition):** the same two arrays also render as an
on-page panel under the results, OFF by default and triple-gated — `DEV_DIAGNOSTICS`
const, `localStorage['cinelog_dev']==='1'`, or `?dev=1`. It reads only already-computed
`m._*` fields: no new math, no re-sort, no mutation. Output is byte-for-byte identical
whether the panel is on or off. The console.table versions still print regardless.

---

## 13. Tier-2 additions (favorites, recency, output diversity, mixed pool)

Added AFTER the original capture above. Each is bounded and additive; the design goal
throughout is "a gentle nudge that never overrides the §9 base."

### 13a. `favoriteBonus(m)` → `favBon` (additive term in `raw`)
A taste profile is built from the user's favorited films: `buildFavProfile()` fetches the
favorited films' genres and tallies them into `favProfile = { genres:{<g>:count}, n }`.
Rebuilt after favorites load (`loadFavorites().then(buildFavProfile)`) and after each
`onFavClick`; signed out / empty favorites → `favProfile = null`.
```
favoriteBonus(m):
  if (!favProfile || !favProfile.n) return 0       // INVARIANT: no favorites -> exactly 0
  mg  = m's lowercased genres
  hit = sum of favProfile.genres[g] for g in mg
  return min(9, (hit / favProfile.n) * 9)          // bounded [0, 9], never negative
```
**Invariant:** with no favorites the term is exactly 0, so `raw` and all downstream output
are byte-for-byte identical to the original engine. Never penalizes non-matching films.

### 13b. `recencyBonus(m)` → `recBon` (additive term in `raw`)
```
REC_MAX = 4, REC_SPAN = 15, nowYear = new Date().getFullYear()
recencyBonus(m):
  if (m.year == null) return 0
  age = nowYear - m.year
  if (age <= 0)   return 4            // current/future year
  if (age >= 15)  return 0            // 15+ years old -> no nudge
  return 4 * (1 - age/15)             // linear decay
```
A gentle tiebreaker toward fresher releases, bounded [0, 4] — small by design so it never
overrides quality/fit.

### 13c. Output diversity — `diversifyOrder(list)`
Selection-preserving reorder of an already-selected, rank-sorted unseen display list
(hybrid top-10, fresh top-15). Same films, same count; #1 (top rank) anchored first; each
next slot takes the highest-ranked remaining film whose PRIMARY genre differs from the
previous card (falls back to rank order when none differ). `list.length < 3` → unchanged.
No score is touched, no film added/dropped. Not applied to rewatch (shuffled) or Surprise
Me. See §11.

### 13d. Mixed candidate pool (discovery fetch)
See §1: when the primary fetch is full, merge up to `DISCOVERY_LIMIT = 150` least-popular
quality films (`vote_count asc`, `imdb_rating >= 6.5`, same filters), deduped; ranking cap
`MERGED_LIMIT = 650`. Skipped when the primary pool isn't full, so narrow-filter behavior
is unchanged. Best-effort: discovery failure degrades to the primary pool.

### Net effect on `raw` (§9)
```
raw = base + popMod + genreBonus + animPen + docPen + fPen + confPen + expPen + favBon + recBon
```
With no favorites and older films, `favBon = recBon = 0` and this reduces to the original
formula. The mixed pool changes which films are *candidates* (only on full pools); output
diversity changes display *order* only.

---

## 14. Tier-3 — Genre-impact repel (replaces `animPen` + `docPen`)

The old flat penalties (§8) only repelled two genres (Animation, Documentary). They're now one
data-driven term, `repelPen` → `m._repelPen`, that models the fact that **some genres define a
film's mood and others just blend in**. A *defining* genre the user did NOT select repels;
*connective* genres never do. Asymmetric by design: pick **Drama** and a "Comedy, Drama" film is
repelled, but pick **Comedy** and "Comedy, Drama" is fine (Drama is connective).

```
GENRE_IMPACT = {                       // 0 = connective (not listed) → never repels
  comedy:1, horror:1, animation:1, documentary:1, musical:1, family:1,   // defining (full)
  western:0.7, music:0.6, romance:0.5, 'sci-fi':0.5, fantasy:0.5, war:0.5, sport:0.5  // notable
}
OPTIN_GENRES = { animation, documentary }   // repel even when NO genre is selected (preserves old behavior)
REPEL_BY_POS = [20, 12, 6, 2]               // unwanted genre at primary / secondary / tertiary / 4th+
REPEL_FLOOR  = -30                          // cap on total repel per film
DOC_FRIENDLY = { sport, music, comedy }     // documentary is welcome when one of these is selected
```

For each genre `g` at position `pos` in a film's genre list that is **not** in the selected set:
skip connective genres (`impact = 0`); skip documentary when a doc-friendly genre is selected;
then — if `g` is opt-in **or** the user has selected at least one genre —
`pen -= REPEL_BY_POS[min(pos,3)] * impact`. Final `repelPen = max(pen, REPEL_FLOOR)`.

- **No genre selected:** only Animation & Documentary repel (≈ −20 at primary, position-scaled) —
  byte-equivalent intent to the old flat −20, just softer when the tag is buried.
- **Not scaled by the adventurous slider** (unlike `genreBonus`/`fPen`) — mood mismatch is
  independent of how adventurous you feel.
- New diagnostics column **`genre_repel`** in both the console.table and the dev panel.

## 15. Tier-3 — Mode simplification

- **Fresh Picks (`fresh`) removed.** It re-used the `hybrid` ranking with no genuine recency
  bias, so its top picks duplicated Smart Mix. The mode card, `MODE_DESCS`/`MODE_LABELS` entry,
  `setMode` toggle entry, the `getRecs` `fresh` branch, and the exposure-bump `fresh` case were
  all removed. Remaining modes: **Smart Mix** (`hybrid`) and **Surprise Me** (`random`); the
  `rewatches` stub is kept (no button) so nothing throws.
- **Smart Mix seen cap 5 → even-rounded ≤10** (see §11).
- **Surprise Me prefers unseen:** `getRandom()` now shuffles unseen and seen separately and fills
  from unseen FIRST (seen only backfills when fewer than 20 unseen match). Hidden still excluded.

---

## 16. Tier-3 — Audience-driven genres in `qualityScore`

Critics and crowds diverge most for certain genres (critics undervalue comedies, horror, blockbusters),
so these are judged more on **IMDb + popularity (number of ratings)** and much less on RT/Metascore.
Keyed off the film's **primary genre** (`genre.split(',')[0]`):

```
AUDIENCE_GENRES = {
  comedy:    {imdb:0.80, rt:0.10,  meta:0.10,  pop:0.40},   // strong tier
  horror:    {imdb:0.80, rt:0.10,  meta:0.10,  pop:0.40},
  action:    {imdb:0.65, rt:0.175, meta:0.175, pop:0.30},   // moderate tier
  adventure: {imdb:0.65, rt:0.175, meta:0.175, pop:0.30},
  romance:   {imdb:0.65, rt:0.175, meta:0.175, pop:0.30}
}
```

For a film whose primary genre is in the table, `qualityScore` uses these `imdb/rt/meta` weights
(instead of the global `ratingMode` weights), computes the usual renormalized blend + confidence
penalty → `ratingPart`, then folds in popularity:
```
quality = ratingPart * (1 - pop) + popularityScore(m) * pop
```
- **Strong tier (Comedy, Horror):** popularity ≈ 40% of quality, IMDb ≈ 48%, RT/Meta ≈ 6% each.
- **Moderate tier (Action, Adventure, Romance):** popularity ≈ 30%, IMDb ≈ 45.5%, RT/Meta ≈ 12% each.
- **All other (critic-respected) genres** — Drama, Documentary, Biography, History, War, Crime,
  Mystery, Thriller, Sci-Fi, Fantasy, Musical, … — are **untouched**: not in the table, so they
  follow the global Audience/Balanced/Critics control exactly as before.

The popularity slice is **intrinsic** (not scaled by the adventurous slider); the slider's `popMod`
(§6) still independently rescues hidden-gem picks. Observed effect: a Comedy filter went from
arthouse darlings (Bringing Up Baby, Playtime, Tampopo) to crowd-pleasers (Superbad, The Hangover,
Ferris Bueller, La La Land); Horror surfaced It, Get Out, The Exorcist, Scream.
