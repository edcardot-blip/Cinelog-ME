# Prompt — Tuning the PROTECTED Recommendation Engine

> Paste into a fresh Claude Code session, then add your specific request at the bottom.
> This is the one task where changing scoring math is *allowed* — but only with discipline.

## Context
CINELOG is a single-file, vanilla HTML/CSS/JS app. All current work happens in **`index.html`** (the live app; `v2.html`/`v1.html` are an alias/archive — do not edit them).
The recommendation engine is the **heart of the app** and is **PROTECTED**. It lives in
**`getRecs()`** and is fully documented in **`SCORING.md`**. **Read `SCORING.md` and `CLAUDE.md`
in full before changing a single number.**

## Goal
Tune the engine so recommendations feel: Personalized · High quality · Varied · Human-curated ·
Never repetitive. The engine blends, roughly: base quality (IMDb/RT/Meta), runtime/era fit, an
adventurous-slider popularity curve (`#adv-slider`), genre scoring, penalties, a favorites
taste-nudge, recency, and an output-diversity / controlled-shuffle pass. The core combine looks
like `raw = base + popMod + …` — that formula and the individual scorers must remain present.

## The rules of tuning (do not skip)
1. **Change one lever at a time.** Never rewrite ranking wholesale or "clean up" the scoring in
   passing. One knob, one change.
2. **Capture before/after.** State which lever you're moving, its old and new value, and the
   intended effect. Show example outputs (same inputs) before and after so the shift is visible.
3. **Keep `SCORING.md` in sync.** Any math/weight/threshold change is mirrored in `SCORING.md` in
   the same session. The doc must always describe the *current* engine.
4. **Never rewrite ranking blindly.** If a request implies a big restructure, stop and propose the
   smallest lever that achieves it; confirm before going further.
5. **Diversity & anti-repetition are features.** Don't remove the shuffle/diversity pass to make
   results "more deterministic" — variety is intentional (e.g. rewatch picks are always shuffled).

## Never break
- The **scorer set** and the `raw = base + popMod + …` combine. Don't delete penalties, the
  favorites nudge, recency, or the diversity step without explicit instruction.
- **Engine ids/handlers:** `#go-btn`, `#output`, `#genre-pills`, `#adv-slider`, `setMode`,
  `setRatingMode`, `setLangFilter`, `setFreeOnly`, `onSeenClick`, `onFavClick`.
- **Discovery (Trending) is separate and read-only** — it must never feed back into or alter the
  engine. Keep `trendingScore` out of `getRecs`.
- Visual identity and the homepage hierarchy are out of scope here.

## Presentation vs. logic
If the request is actually about *displaying* engine output (chips, labels, "why" text), don't edit
the math — **wrap the engine setter on `window`** (call the original, then update UI), as done for
the segmented-pill and refine-card chips.

## Verify before deploying
1. Syntax-check **both** inline `<script>` blocks (`vm.compileFunction`) — zero errors.
2. Confirm the `raw = base + popMod + …` formula and all scorers are still present and intact.
3. Run several representative searches (different modes, slider positions, signed-in vs out) and
   compare against the captured "before" output.
4. Confirm `SCORING.md` now matches the code.
5. Deploy to Pages and **test on a real iPhone** (Safari + PWA).
6. **Do not change `index.html`** unless explicitly told.

---
**My specific request (name the lever and the intended effect):**
