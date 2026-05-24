# Compression-Prediction Explorer

A text-based interactive demonstration that the equivalence between compression and prediction is not a metaphor but a measurable mechanic. Users drag a slider that fades the predictable words from a familiar fairy tale and replaces them, in place, with the predictor's reconstruction of what was removed. Information visibly moves from the page into the predictor — never destroyed, only relocated.

## Status

Pre-implementation. The design is settled; Phase 0 is the next step.

## Docs

- [`docs/abstract.md`](docs/abstract.md) — what the project is, the information-theoretic core, what the user sees, the determinism/variability tiers, scope, and design principles.
- [`docs/user-scenarios.md`](docs/user-scenarios.md) — Gherkin-style behavior specs.
- [`docs/implementation-plan.md`](docs/implementation-plan.md) — four-phase build plan, committed architectural decisions, and exit criteria.

## Layout

```text
compression-prediction/
├── docs/                      # design docs
├── pipeline/                  # Python — offline build pipeline (Phase 0 & 1)
└── runtime/                   # Next.js — slider runtime (Phase 2 & 3)
    └── public/
        └── tales/             # static JSON output, one per tale (committed)
```

## Stack

- **Pipeline:** Python. Calls the OpenAI API (`gpt-5.4-mini`) for surprisal scoring and gap reconstruction; writes one JSON per tale into `runtime/public/tales/`.
- **Runtime:** Next.js, deployed to Vercel. Serves tale JSONs as static assets and renders the slider mechanic in the browser.
