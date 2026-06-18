# CINELOG — Recommendation Engine

> **Comprehensive engine reference.** This document explains *exactly* how CINELOG turns a
> user's filters into a ranked list of movies, detailed enough to rebuild the engine from
> scratch. It is derived from the authoritative scoring reference (**[../SCORING.md](../SCORING.md)**)
> and the live implementation in **`v2.html`** (`getRecs()`, `getRandom()`, the adventurous-slider
> handler, `setRatingMode`, `setMode`, and the Trending block).
>
> **The scoring math is PROTECTED logic.** This doc *describes* it; it is not permission to
> change it. If a number must move, move **one** lever, capture before/after, get owner sign-off,
> and update `SCORING.md`. See `CLAUDE.md` → "Recommendation Philosophy."

All line numbers below refer to `v2.html` and are approximate (the file grows). The engine is
self-contained inside `getRecs()` (≈ lines 3569–4142); `getRandom()` (≈ 3524–3567) is the
Surprise-Me path; Trending (≈ 4143–4377) is a **separate, read-only** discovery feature that
never touches the engine.

---

## 0. The big picture

```
User filters (genre / era / length / language / kid / streaming / rating-mode / adventurous slider / mode)
        │
        ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  getRecs()                                                            │
  │   1. FETCH candidate pool  (Supabase, imdb_rating desc, limit 500)    │
  │   2. MIX IN discovery pool  (least-popular quality films, if full)    │
  │   3. CLIENT FILTERS  (lang / kid / not-interested / streaming)        │
  │   4. SCORE each film  → raw = base + popMod + genreBonus + penalties   │
  │                              + favBon + recBon                         │
  │   5. RANK by raw, then add ±6 noise over the top 45 → re-rank          │
  │   6. SPLIT seen / unseen, DIVERSIFY order, render by mode              │
  └──────────────────────────────────────────────────────────────────────┘
        │
        ▼
  Poster gallery (Fresh Picks + optional "Worth a rewatch")
```

`getRandom()` ("Surprise Me") skips steps 2, 4, 5, 6 entirely — it fetches a big pool, applies
the client filters, Fisher-Yates shuffles, and shows 20 unranked.

---

## 1. Candidate fetch & the mixed pool

### Constants (≈ lines 2091–2097)
```
CANDIDATE_LIMIT = 500
POOL_LIMIT      = CANDIDATE_LIMIT          // ranking operates over the full pool
DISCOVERY_LIMIT = 150
MERGED_LIMIT    = POOL_LIMIT + DISCOVERY_LIMIT = 650
```

**Why 500?** The "How Adventurous?" slider can only surface lesser-known films if lesser-known
films are actually *in* the pool. A pool of ~30 top-rated films is all blockbusters, so the
popularity penalty has nothing obscure to promote. 500 well-rated films include ~110 hidden gems.

### Primary fetch (≈ lines 3575–3588)
- **Columns:** `imdb_id,title,year,runtime_minutes,genre,director,actors,imdb_rating,rotten_tomatoes_score,metascore,poster_url,vote_count,original_language,mpaa_rating,franchise` plus `streaming`.
- Built by **`buildQuery(selectCols, limit)`** (≈ line 2834), which appends PostgREST `or=(...)`
  filters for any selected **genre** (`genre.ilike.*X*`), **era** (decade `year` ranges), and
  **length** (`runtime_minutes` ranges), then `&order=imdb_rating.desc.nullslast`.
- **Streaming-column fallback:** if the request 4xx/5xx's (the `streaming` column might not
  exist in some deployments), it retries the same query *without* `,streaming` so the app still
  works.
- **Wider net when streaming-filtering:** `streamingActive = freeOnly && selServices.size > 0`;
  `fetchLimit = streamingActive ? Math.max(POOL_LIMIT, 80) : POOL_LIMIT`. Since `POOL_LIMIT = 500`
  already exceeds 80, `fetchLimit` stays 500 in practice.
- Empty result → contextual "No films matched…" status, early return.

### Mixed candidate pool — discovery fetch (≈ lines 3591–3611)
Fires **only when the primary fetch came back FULL** (`pool.length >= fetchLimit`) — meaning more
films matched than were pulled, so the obscure-but-good tail got cut off by the rating sort.

It then pulls up to `DISCOVERY_LIMIT = 150` of the **least-popular quality films** matching the
same genre/era/length filters:
```
buildQuery(...) + '&imdb_rating=gte.6.5&vote_count=not.is.null&order=vote_count.asc.nullslast'
```
These are merged into the pool, **deduped by `imdb_id`**. Same streaming-column fallback applies.

- When the primary pool is **not** full (narrow filters already contain everything), discovery is
  **SKIPPED**, so those cases are byte-for-byte identical to a no-discovery engine; the cap raise
  to `MERGED_LIMIT` is a no-op then.
- **Best-effort:** any discovery failure is swallowed (`try/catch`) and the engine proceeds with
  the primary pool.

### Surprise Me fetch (`getRandom`, ≈ line 3533)
Uses its own `RANDOM_FETCH_LIMIT = 1500` (generous enough that low-rated indies can also be
drawn), same `order=imdb_rating.desc.nullslast`, same streaming-column fallback.

---

## 2. Client-side filters (applied BEFORE ranking)

After fetch, the pool is filtered in JS (≈ lines 3614–3633 in `getRecs`; 3543–3544 in `getRandom`):

```js
pool = pool.filter(m => passesLang(m) && passesKid(m) && !isNotInterested(m));
if (streamingActive) pool = pool.filter(passesStreaming).slice(0, MERGED_LIMIT);
else                 pool = pool.slice(0, MERGED_LIMIT);
```

| Filter | Defined | Behavior |
|---|---|---|
| `passesLang(m)` | ≈ 2226 | `langFilter==='all'` → true; else require `m.original_language === 'en'`. |
| `passesKid(m)` | ≈ 2724 | `kidOnly` off → true; else `m.mpaa_rating ∈ KID_RATINGS = {G, PG, TV-G, TV-PG}`. |
| `isNotInterested(m)` | ≈ 2360 | `niSet.has(m.imdb_id)`; engine uses `!isNotInterested(m)` so hidden films are removed. |
| `passesStreaming(m)` | ≈ 2211 | `freeOnly` off → true; **no** services picked → true; else film must be on ≥1 selected service in a **free tier** (`FREE_TIERS = {flatrate, free, sub, ads, subscription}`). |

When a filter empties the pool, `getRecs` emits a contextual "No films match with English only +
Kid-friendly enabled…" / "No films matching your filters are free to stream on …" status and
returns early.

`movieAvailability(m)` (≈ 2193) normalizes the `streaming` JSONB into `[{svc, tier, free}]` for
recognized providers only (matched via `SVC_BY_ALIAS`); `passesStreaming` reads it.

---

## 3. `qualityScore(m)` — weighted rating blend (≈ lines 3646–3657)

The 3-way **Audience / Balanced / Critics** control (`setRatingMode`, default `'balanced'`) sets
`RATING_WEIGHTS` (≈ line 2763):

| Mode | IMDb | Rotten Tomatoes | Metascore |
|---|---|---|---|
| `audience` | 0.85 | 0.075 | 0.075 |
| `balanced` *(default)* | 0.50 | 0.25 | 0.25 |
| `critics` | 0.15 | 0.425 | 0.425 |

IMDb never fully disappears — it stays at 15% even in Critics mode as an audience reality-check.

**Computation:**
- IMDb rescaled to 0–100 as `imdb_rating * 10`; RT and Meta used as-is (already 0–100).
- Each **present** source adds `value * weight` to `weighted` and its `weight` to `totalW`.
- **Renormalization:** `avg = weighted / totalW` — divides only by the weights actually present,
  so missing sources don't drag the score toward zero.
- **No usable signal** (`totalW < 0.0001`) → returns a neutral **65**.
- **Confidence penalty by source count** (`present`): 3 sources → `0`; 2 → `-2`; 1 → `-5`.
- Result clamped to `[0, 100]`: `Math.max(0, Math.min(100, avg + conf))`.

---

## 4. `fitScore(m)` — runtime / era fit (≈ lines 3659–3674)

Starts at `score = 100`. Two **−50** partial penalties:

- **Length:** if any length pill is selected and `runtime_minutes` does **not** fall in a selected
  band → `score -= 50`. A **null runtime always passes** (`inLen = true`). Bands:
  Under 90 (`rt<90`), 90–120 (`rt>=90 && rt<=120`), 120–150 (`rt>120 && rt<=150`), Over 150 (`rt>150`).
- **Era:** if any era pill is selected and `year` is non-null and not in a selected decade range →
  `score -= 50`. A **null year is not penalized**. Decades: Pre-1960 `[0,1959]`, 1960s … 2010s,
  2020s `[2020,2100]`.

Returns `Math.max(0, score)`. A film failing both length and era can reach 0.

---

## 5. `popularityScore(m)` — log-scale fame (≈ lines 3679–3683)

```
if (vote_count == null || vote_count <= 0) return 50;     // unknown → neutral
lv = log10(vote_count);
return clamp01_100( ((lv - 3) / 3) * 100 );
```
Maps **1,000 votes → 0**, **1,000,000 votes → 100**, linear on log10 between, clamped to [0,100].
Stored as `m._fame` / `m._surprise`. This is "fame," not quality.

---

## 6. The Adventurous slider → continuous weights

`advPos` (0–100, default **50**) is the *continuous* driver of all adventurous math. The UI bands
(`ADV_BANDS` — Deep Cuts / Hidden Gems / Balanced / Popular Picks / Crowd Favorites) are **labels
only** and do not touch the math.

### Derived weights (≈ lines 3744–3751)
```
ratingsWeight     = 0.55                          // FIXED quality-vs-fit blend
blockbusterWeight = max(0, (50 - advPos) / 50)    // 0→1 sliding LEFT  (Lesser Known)
crowdWeight       = max(0, (advPos - 50) / 50)    // 0→1 sliding RIGHT (Crowd Favorites)
qualityFactor     = 1 - 0.05 * blockbusterWeight  // quality counts slightly less when obscure
genreFactor       = 1 - (2/3) * blockbusterWeight // 1.0 center/right → 0.33 at full left
```
Both one-sided weights are **0 at the true center** (`advPos=50`), so partial positions (25/75)
get partial-strength effects, not just the extremes. `genreFactor` scales genre bonuses (§7).

### `stretch(x)` — contrast stretch (≈ line 3754)
```
stretch(x) = clamp01_100( 50 + (x - 50) * 1.4 )
```
Amplifies quality gaps around the 50 midpoint so the list isn't flat.

### `lerpAnchors(votes, anchors)` — piecewise-linear interpolation (≈ lines 3757–3765)
Null votes → 0; below the first anchor returns the first value; above the last returns the last;
otherwise linearly interpolates between bracketing anchors.

### `LEFT_ANCHORS` — Lesser-Known full-strength modifier by `vote_count` (≈ lines 3773–3776)
```
[0,-3] [10000,-2] [25000,5] [50000,13] [100000,13]
[150000,7] [200000,2] [300000,-10] [600000,-28] [1000000,-45] [2000000,-52]
```
Intent: **<25k** = too-obscure protection (near-neutral / slight penalty, no boost); **25k–50k** =
strong lesser-known boost; **50k–100k** = PEAK zone (+13); **100k–150k** = moderate; **150k–200k**
= nearly neutral; **200k+** = increasing penalty leaning left (very hard at 1M+).

### `RIGHT_ANCHORS` — Crowd-Favorites full-strength boost by `vote_count` (≈ lines 3778–3780)
```
[0,0] [100000,0] [200000,2] [300000,5] [600000,13] [1000000,20] [2000000,25]
```

### Applied per film (≈ lines 3923–3925)
```
leftMod  = lerpAnchors(vote_count, LEFT_ANCHORS)  * blockbusterWeight;
rightMod = lerpAnchors(vote_count, RIGHT_ANCHORS) * crowdWeight;
popMod   = leftMod + rightMod;
```

---

## 7. `genreScore(m)` — position & intent (≈ lines 3797–3837)

OMDb stores genres primary-first (e.g. `"Comedy, Romance, Drama"`). Selected genres (excluding the
**Kid-Friendly** pseudo-pill) are rewarded more when they sit near the **FRONT** of the film's
genre list.

### Tables (≈ lines 3790–3795)
```
POS_BOOST        = [18, 9, 4, 1]      // 1 genre selected: primary, secondary, third, 4th+
POS_BOOST_STRICT = [18, 8, 2, 0]      // Comedy: strong primary, harsh once buried
PURITY_BONUS     = 7                  // film is ONLY the selected genre
STRICT_GENRES    = { 'comedy' }
POS_WEIGHT       = [1.0, 0.7, 0.4, 0.2]   // multi-select: how "primary" each match is
MULTI_BASE       = { 1:6, 2:16, 3:24, 4:30 }   // by # of selected genres matched
```

**Single genre selected:**
- Not in the film at all (`pos < 0`) → `0`.
- Else `score = (STRICT? POS_BOOST_STRICT : POS_BOOST)[min(pos, 3)]`.
- If the film's genre list is exactly length 1 → add `PURITY_BONUS` (+7).

**Multiple genres selected:**
- For each selected genre present: `matched++`, `sumW += POS_WEIGHT[min(pos,3)]`.
- A STRICT genre (Comedy) buried at `pos >= 2` sets `strictBuried`.
- `bonus = (MULTI_BASE[min(matched,4)] || 0) * (sumW / matched)`.
- If `strictBuried` → `bonus *= 0.6`.

**Final scaling:** `total = score * genreFactor` (§6 — full at center/right, shrinks to 0.33 at
full left). With **no genres selected**, returns `0`. Diagnostic fields `_gPos/_gPrimary/
_gSecondary/_gPurity/_gMulti/_gTotal` are populated for the genre console.table.

---

## 8. Penalties

| Penalty | Where | Rule |
|---|---|---|
| **Animation** | ≈ 3841 | If Animation is NOT a selected genre and the film's genre contains "animation" → `-20`, else `0`. |
| **Documentary** | ≈ 3842–3844 | Exempt if any selected genre ∈ `DOC_FRIENDLY_GENRES = {sport, music, comedy}`. Otherwise genre contains "documentary" → `-20`, else `0`. |
| **Franchise** | ≈ 3848–3857 | `franchiseCounts` tallies pool members per franchise. `big = count >= 3`; `popular = vote_count >= 300000`. `big && popular` → `-25` (e.g. LOTR); `big` → `-20`; else `-15`. **Then scaled by `blockbusterWeight`** (≈ 3930), so it only bites left-of-center and fades to 0 at center/right. |
| **Confidence** | ≈ 3862–3877 | Keeps ultra-obscure single-source critic-darlings from dominating. `v = vote_count\|\|0`; `strong` = how many of {IMDb≥7.5, RT≥80, Meta≥75} hold. `v>=25000` → `0`. `10000<=v<25000` → `strong>=2 ? 0 : -8`. `v<10000` → base `(v<5000? -25 : -15)`, softened `+20` if `strong>=3`, else `+12` if `strong>=2`; a lone strong source stays hard-hit. |
| **Exposure** | ≈ 3907–3933 | `exposure` read from `localStorage['cinelog_exposure']` (no-op if unavailable). `expPen = -min(8, expCount * 1.5)` — a gentle demotion (cap −8) for films shown often, so the list rotates. |

---

## 9. Favorite bonus & recency bonus (additive nudges)

### `favoriteBonus(m)` → `favBon` (≈ lines 3883–3891)
A **taste profile** is built from the user's favorited films. `buildFavProfile()` (≈ 2389)
fetches the favorited films' genres and tallies them into `favProfile = { genres:{<g>:count}, n }`.
Rebuilt after favorites load (`loadFavorites().then(buildFavProfile)`) and after every `onFavClick`.
Signed out / empty favorites → `favProfile = null`.
```
favoriteBonus(m):
  if (!favProfile || !favProfile.n) return 0      // INVARIANT: no favorites → exactly 0
  mg  = m's lowercased genres
  hit = Σ favProfile.genres[g] for g in mg
  if (!hit) return 0
  return min(9, (hit / favProfile.n) * 9)         // bounded [0,9], never negative
```
**Invariant:** with no favorites the term is exactly 0, so output is identical to the original
engine. Never penalizes non-matching films.

### `recencyBonus(m)` → `recBon` (≈ lines 3896–3903)
```
REC_MAX = 4, REC_SPAN = 15, nowYear = new Date().getFullYear()
if (year == null)  return 0
age = nowYear - year
if (age <= 0)      return 4              // current/future year
if (age >= 15)     return 0              // 15+ years old → no nudge
return 4 * (1 - age/15)                  // linear decay
```
A gentle tiebreaker toward fresher releases, bounded [0,4] — small by design so it never overrides
quality/fit.

---

## 10. Final score assembly (≈ lines 3910–3947)

```
qS   = stretch(quality)
base = qS * ratingsWeight * qualityFactor + fit * (1 - ratingsWeight)
raw  = base + popMod + genreBonus + animPen + docPen + fPen + confPen + expPen + favBon + recBon
```
With `ratingsWeight = 0.55`: **quality contributes 55%** (after stretch & qualityFactor),
**fit 45%**. All §8/§9 terms are additive.

- **`raw` is intentionally NOT clamped** — heavily-penalized blockbusters keep a real ordering
  instead of all colliding at 0; this drives ranking.
- **Display score `m.ws`** (≈ 3945): `Math.max(0, Math.min(100, Math.round(raw)))` — clamped to
  0–100 for the UI only; never used for ranking.
- Per-movie debug fields: `_popMod, _fPen, _genreBonus, _confPen, _expPen, _favBon, _recBon, _raw,
  _surprise (=round(fame)), _quality, _fame`. Rating pills are driven by `_imdb (=imdb_rating*10),
  _rt, _meta`.

### `sCls(s)` — score color thresholds (≈ line 2864)
```
s >= 85 → 'sg' (green)   |   s >= 70 → 'sb'   |   s >= 55 → 'sa'   |   else → 'sr' (red)
```

---

## 11. Controlled randomness (≈ lines 3949–3958)

```
NOISE = 6, CANDIDATE_POOL = 45
ranked.sort(by _raw desc)
each m: m._noise = (idx < 45) ? (random*2-1)*6 : 0
        m._rankScore = m._raw + m._noise
ranked.sort(by _rankScore desc)
```
Only the **top 45** films get jitter in `[-6, +6]`; everything below gets `0`. Films far ahead keep
their lead; near-tied films within the top pool swap for variety. The noise is small relative to
real score gaps, so bad matches can't leap over good ones. This is what makes the same filters
return a slightly different list each run.

A **second** source of run-to-run variety is the **exposure memory** (§8): the unseen films each
run actually surfaces get `exposure[imdb_id] += 1` persisted to `localStorage`, gently demoting
them next time so the catalog rotates.

---

## 12. Modes & output assembly

`viewMode ∈ hybrid | fresh | rewatches` (default `hybrid`); `random` is handled separately by
`getRandom()`. The Go button dispatches `viewMode==='random' ? getRandom() : getRecs()`.

| Mode (UI name) | `viewMode` | Behavior |
|---|---|---|
| **Smart Mix** | `hybrid` | Up to **10 unseen** ("Fresh Picks", diversified) + "Worth a rewatch" divider + up to **5 seen**. |
| **Fresh Picks** | `fresh` | `diversifyOrder(allUnseen.slice(0, 15))`, no rewatch section. |
| **Rewatches** | `rewatches` | `allSeen.slice(0, 15)`, no fresh section (not diversified — already shuffled). |
| **Surprise Me** | `random` | `getRandom()` — 20 unranked, shuffled; all ranking math ignored. |

### Seen / unseen split (≈ lines 4063–4064)
```
allUnseen = ranked.filter(m => !isSeen(m));
allSeen   = ranked.filter(m =>  isSeen(m));
```

### Exposure bump — mode-aware (≈ lines 4070–4076)
Only the **UNSEEN films each mode actually renders** get `exposure[imdb_id] += 1`: **hybrid** bumps
the top **10**, **fresh** the top **15**, **rewatches none** (it renders only seen films).

### `diversifyOrder(list)` — output diversity (≈ lines 4086–4098)
Selection-preserving reorder of an already-selected, rank-sorted unseen list (hybrid top-10, fresh
top-15) so the same **primary genre** doesn't stack consecutively. Same films, same count; **#1
(top rank) anchored first**; each next slot takes the highest-ranked remaining film whose primary
genre differs from the previous card (falls back to rank order when none differ). `list.length < 3`
→ unchanged. No score touched, no film added/dropped. **Not** applied to rewatch (shuffled) or
Surprise Me.

### Hybrid rewatch shuffle (≈ lines 4117–4126)
The rewatch picks are **always Fisher-Yates shuffled** (not ranked) before slicing 5, so the same
seen films don't keep surfacing. The "Fresh Picks" label only shows when there are seen films to
pair it with.

Final render: `openResultsGallery(galleryGroups, viewMode)` opens the full-screen poster gallery.

### `getRandom()` — Surprise Me (≈ lines 3524–3567)
Fetches up to 1500 matching films, applies the same client filters, Fisher-Yates shuffles, takes
the first 20, and renders **without rank numbers**. The adventurous slider, rating-mode control,
and ALL ranking math are intentionally ignored. Rating pills are mirrored from raw values
(`m._imdb = m.imdb_rating` etc.) since the ranking math that normally sets them didn't run.

---

## 13. How user lists shape results

| List | Set | Effect on recs |
|---|---|---|
| **Hidden** (`not_interested`) | `niSet` | **Excluded** entirely via `!isNotInterested(m)` (and in Trending). |
| **Seen** | `seenSet` | **Splits** the ranked pool — seen films go to "Worth a rewatch" (hybrid) / Rewatches mode; demoted out of Fresh. In Trending, seen films are demoted (−1000) so unseen fill first. |
| **Likes** (`favorite`) | `favSet` → `favProfile` | Feeds the **favorite bonus** (§9) and the Trending "For You" taste bonus. Never penalizes; bounded. |
| **Watchlist** | `watchSet` | Display/management only — does **not** affect ranking. |

All four live in the `user_movies` table, RLS-scoped to the signed-in user. Signed out → all sets
empty → engine reduces to the no-personalization baseline. See **[DATABASE.md](./DATABASE.md)**.

---

## 14. Diagnostics

Inside `getRecs`, two `console.table` breakdowns (top 40, each wrapped in `try/catch`):
- **Scoring:** title, imdb_votes, fame, pop_mod, franchise_pen, genre_bonus, conf_pen, exp_pen,
  fav_bonus, recency, quality, raw, display.
- **Genre:** title, selected_genres, movie_genres, genre_positions, primary/secondary match,
  purity bonus, multi-genre bonus, total genre score.

An **in-UI diagnostics panel** mirrors these arrays on-page. It is **OFF by default** and
triple-gated: `DEV_DIAGNOSTICS` const, `localStorage['cinelog_dev']==='1'`, or `?dev=1`. It reads
only already-computed `m._*` fields — no new math, no re-sort, no mutation. Output is byte-for-byte
identical whether the panel is on or off.

---

## 15. Trending Tonight (separate, read-only discovery)

A lightweight homepage row + full-screen tabbed page (≈ lines 4143–4377). **Catalog-wide, no login
required.** It reuses `sbHeaders()`, `movieAvailability()`, `niSet/seenSet/favSet`, and
`openMovieDetail()`, but **never touches the engine, scoring, auth, or writes**.

### Constants
```
TREND_POOL_SIZE     = 250    // candidate pool (top by imdb_rating desc)
TREND_ROW_COUNT     = 3      // posters in the homepage preview
TREND_SESSION_BOOST = random*100   // sampled ONCE per page load → lists rotate per app load
```

### Score components (each 0–100)
- `trendQuality(m)` = **plain average** of present rating scales (IMDb×10, RT, Metacritic); 0 if none.
- `trendPopularity(m)` = log-scaled `vote_count`: `(log10(v)-3)/3*100`, clamp [0,100]; 0 if no votes.
- `trendRecency(m)` = newer scores higher: `(year-(now-30))/30*100`, clamp [0,100]; last ~30 years → 0–100.

### `trendingScore(m)` (≈ lines 4195–4200)
```
trendingScore = quality*0.55 + popularity*0.30 + recency*0.10 + sessionBoost*0.05
```
This is "high-quality, broadly appealing films worth watching tonight" — **NOT** live/internet
trending.

### Taste bias — `trendTasteBonus(m)` (≈ 4204–4210)
Reuses `favProfile`; `min(25, hits/favProfile.n * 30)` — modest, capped; 0 when signed out / no
favorites.

### Ranking — `trendRanked(pool)` (≈ 4242–4250)
```
pool.filter(!isNotInterested)        // exclude hidden
    .filter(trendStreamable)         // FREE on one of the 8 toggle subscription services
    .map(m => trendingScore + trendTasteBonus - (isSeen ? 1000 : 0))   // demote seen
    .sort(desc)
```
**`trendStreamable(m)`** (≈ 4236) requires availability on a **free tier** of one of the **8 toggle
subscription services** (Netflix, Max, Disney+, Prime Video, Hulu, Paramount+, Apple TV+, Peacock)
— rent/buy storefronts do not count.

### Tabs (≈ 4299–4314)
- **Trending** (default): `trendRanked(pool)` filtered to `imdb_rating >= 7.0` (or null), capped 50.
- **Newer**: **STRICT** — only films `year >= currentYear - 3` (last 3 years), sorted by
  `quality + popularity`, capped 50.

The homepage row takes the top ~30 of `trendRanked`, shuffles, and shows 3.

---

## 16. End-to-end flow (current)

1. App auto-connects to Supabase (baked anon key); Trending row lazy-loads.
2. On sign-in: `loadSeen / loadNotInterested / loadFavorites / loadWatchlist`, then
   `buildFavProfile()` builds the taste profile.
3. User sets filters and a mode, taps **Find my movie** (or **Surprise me**).
4. `getRecs()` fetches (+ optional discovery merge), client-filters, scores every film into `raw`,
   ranks with ±6 noise over the top 45, splits seen/unseen, diversifies, bumps exposure, and opens
   the poster gallery by mode. (`getRandom()` shuffles 20 instead.)
5. Card actions (Seen / Like / Watchlist / Hide) write to `user_movies`; Like also rebuilds
   `favProfile`, changing future favorite/Trending bonuses.

---

## 17. Future improvement ideas

These are **suggestions only** — the engine is protected; nothing here is approved.

- **Collaborative / embedding signals** beyond genre-count taste profiles (actor/director affinity,
  TMDB keyword vectors, "because you liked X").
- **Negative taste signal** from Hidden films (currently only a hard exclude) to down-weight similar
  films rather than just removing exact matches.
- **Watchlist as a positive ranking signal** (currently display-only).
- **Server-side scoring** so the obscure tail isn't bounded by the 500/650 client pool.
- **Per-user exposure** (currently `localStorage`, so it's per-device, lost on clear, and unshared
  across devices).
- **Confidence-aware quality** that blends Bayesian shrinkage toward the catalog mean for thin-vote
  films, replacing the step-function confidence penalty.
- **Recency as a tunable knob** rather than a fixed 15-year linear decay.
- **Trending freshness**: a true time-decayed popularity signal (TMDB `popularity` is stored but
  not yet used in `trendingScore`).
