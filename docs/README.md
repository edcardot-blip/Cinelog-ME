# CINELOG — /docs

Feature and subsystem documentation. Keep these in sync with the app's current state — update
the relevant doc whenever a major feature ships. The project constitution is the root
**[CLAUDE.md](../CLAUDE.md)** (read that first).

## Index

- **[../CLAUDE.md](../CLAUDE.md)** — project constitution: vision, design rules, what never changes,
  how the codebase/backend/pipeline work, verify-before-deploy workflow.
- **[../SCORING.md](../SCORING.md)** — the recommendation engine reference (PROTECTED logic). The
  exact scoring pipeline in `getRecs()`. Keep current whenever scoring changes.
- **[../pipeline/GATE.md](../pipeline/GATE.md)** — catalog ingestion + nightly refresh pipeline
  (TMDB/OMDb, the addition gate, budgets, GitHub Actions crons).

## Where things live

- `v2.html` — the active premium redesign (current app). `index.html` — the classic live app.
- `pipeline/` — `ingest.mjs` (additions), `refresh.mjs` (streaming + ratings + posters), migrations.
- `.github/workflows/` — `catalog-refresh.yml`, `catalog-maintenance.yml` (the crons).

## Adding a doc

When you ship a major feature, add `docs/<feature>.md` covering: what it does, the key
functions/ids, how it's wired (especially anything that wraps engine functions), and any gotchas.
Then add a line to the Index above.
