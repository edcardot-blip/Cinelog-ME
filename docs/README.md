# CINELOG — /docs

The permanent developer handbook. Read these to understand the project without relying on chat
history. The project constitution is the root **[CLAUDE.md](../CLAUDE.md)** (start there); for a
fast AI-session brief, **[AI_CONTEXT.md](./AI_CONTEXT.md)** is the single most useful file.

## Start here
- **[../CLAUDE.md](../CLAUDE.md)** — project constitution: vision, design rules, what never changes,
  how the codebase/backend/pipeline work, verify-before-deploy workflow.
- **[AI_CONTEXT.md](./AI_CONTEXT.md)** — fast-start brief for a new Claude Code session: everything
  to know before editing (architecture, philosophy, known bugs, pitfalls, never-change list).

## Understand the project
- **[PROJECT.md](./PROJECT.md)** — complete overview: vision, goal, audience, features, screens,
  navigation, auth, lists, recommendation flow, tech stack, status, future ideas (~10-min read).
- **[../README.md](../README.md)** — professional project README (install, run locally, deploy).

## Design & UI
- **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** — the full design language: colors (CSS variables +
  hex), typography (Fraunces/Inter), spacing, radius, shadows, animation, icons, buttons, cards,
  posters, modals, navigation, the projector loader, overall style.
- **[UI_ARCHITECTURE.md](./UI_ARCHITECTURE.md)** — every screen (purpose / layout / components /
  interactions / navigation / animations) with real ids, classes, and function names.

## Engine & data
- **[RECOMMENDATION_ENGINE.md](./RECOMMENDATION_ENGINE.md)** — comprehensive engine reference:
  candidate pool, filters, scoring math, the adventurous slider, penalties, modes, randomness, and
  Trending. A rebuild-from doc derived from `SCORING.md` and `v2.html`.
- **[DATABASE.md](./DATABASE.md)** — the Supabase database: every `movies`/`user_movies` column,
  auth/RLS, the streaming JSONB shape, indexes, the catalog inclusion bar, and known limitations.
- **[../SCORING.md](../SCORING.md)** — the authoritative protected-logic scoring reference. Keep
  current whenever scoring changes.
- **[../pipeline/GATE.md](../pipeline/GATE.md)** — catalog ingestion + nightly refresh pipeline
  (TMDB/OMDb, the addition gate, budgets, GitHub Actions crons).

## Planning & conventions
- **[ROADMAP.md](./ROADMAP.md)** — Completed / In Progress / High / Medium / Low / Future.
- **[TODO.md](./TODO.md)** — prioritized actionable checklist (🔥 Critical / ⭐ High / 📌 Medium / 💡 Nice).
- **[CODING_GUIDELINES.md](./CODING_GUIDELINES.md)** — naming, CSS, components, animation, state,
  modal patterns, performance, mobile-first, how to build future features.

## Reusable prompts — [PROMPTS/](./PROMPTS/)
Ready-to-paste, project-tailored instructions for common tasks:
[homepage-redesign](./PROMPTS/homepage-redesign.md) ·
[movie-detail-redesign](./PROMPTS/movie-detail-redesign.md) ·
[loading-animation](./PROMPTS/loading-animation.md) ·
[recommendation-engine](./PROMPTS/recommendation-engine.md) ·
[watchlist](./PROMPTS/watchlist.md) · [likes](./PROMPTS/likes.md) ·
[trending](./PROMPTS/trending.md) · [authentication](./PROMPTS/authentication.md) ·
[performance](./PROMPTS/performance.md) · [mobile-ui](./PROMPTS/mobile-ui.md)

## Where things live
- `v2.html` — the active premium redesign (current app). `index.html` — the classic live app.
- `pipeline/` — `ingest.mjs` (additions), `refresh.mjs` (streaming + ratings + posters), migrations.
- `.github/workflows/` — `catalog-refresh.yml`, `catalog-maintenance.yml` (the crons).

## Adding a doc
When you ship a major feature, add/update the relevant doc here (and `docs/<feature>.md` if new),
keep `SCORING.md` in sync for any engine change, and add a line to the Index above. Documentation
should always reflect the **current** state of the app.
