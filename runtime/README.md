# Surprisal Party — runtime

The browser front-end for **Surprisal Party**: the interactive slider that
compresses a text by removing predictable words and shows the predictor
rebuilding them. It is a fully **static** Next.js site. It fetches pre-built
corpus JSON and renders the mechanic. **The runtime never tokenizes, scores, or
calls a language model**; all of that happens offline in the Python `pipeline/`,
which writes the JSON this app reads.

For the project as a whole, see the [root README](../README.md) and
[`docs/`](../docs/). For the architectural commitments that constrain changes
here, see [`CLAUDE.md`](./CLAUDE.md).

## Stack

- **Next.js 16** (App Router) + **React 19**
- **Static export** (`output: 'export'`) — `next build` emits a static `out/`; no
  SSR, no API routes, no middleware
- **TypeScript** (strict), path alias `@/*` → `src/*`
- **Tailwind CSS 4** + **DaisyUI 5**
- **Vitest** + Testing Library (unit/component); **Playwright** (E2E, not yet
  populated)
- **pnpm**

## Getting started

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

> If you renamed or moved the project folder and `pnpm dev` fails with a
> Turbopack "Next.js package not found" panic, the install's absolute-path
> artifacts are stale: `rm -rf node_modules .next && pnpm install`.

## Commands

```bash
pnpm dev           # dev server (Turbopack)
pnpm build         # static export to out/
pnpm lint          # eslint
pnpm test          # vitest (unit/component)
pnpm test:watch
pnpm test:e2e      # playwright
```

## Project structure

```
runtime/
├── next.config.mjs          # output: 'export', images.unoptimized
├── public/
│   └── tales/               # tale JSON caches (written by the pipeline) — fetched at runtime
└── src/
    ├── app/                 # layout.tsx, page.tsx (renders <ExplorerContainer/>), globals.css
    ├── components/explorer/ # the explorer: shell, header, prose column, predicted strip,
    │                        #   slider, modals (primer / about / metrics), corpus drawer
    ├── components/ui/        # dormant scaffold primitives (used where helpful)
    ├── lib/                 # tale-render (pure derivation), primer, utils, hooks
    └── types/               # tale-cache types (derived from the pipeline schema)
```

The explorer's core data derivation lives in `src/lib/tale-render.ts`
(`renderPosition` turns a cached position into rendered prose + removed tiles +
the header readout); the interactive surface lives in `src/components/explorer/`.

## How it works

The browser fetches `/tales/<slug>.json` (a precomputed cache: surprisal scores,
gap boundaries, reconstructions, fidelity) and renders one of five fixed
slider positions from it. Dragging the slider re-derives the view from the same
cached data — same JSON in, same UI out.

## Architecture commitments (see [`CLAUDE.md`](./CLAUDE.md) for the full list)

- **Static export only** — no server components that fetch at request time, no
  `route.ts`, no `middleware.ts`.
- **Corpus JSON via `fetch('/tales/<slug>.json')`** in the browser; the pipeline
  writes these files, the runtime only reads them.
- **Single language (English)** — the scaffold's i18n routing was removed; there
  is no `[lang]` segment or dictionary system.
- **The cache schema is authoritative** — TypeScript types are derived from the
  pydantic models in `pipeline/cprediction/cache.py`, not hand-rolled.
- **Determinism** — cached state renders identically every time; no randomness
  in resting/rendered output, no live model calls.

## Testing

[Vitest](https://vitest.dev/) for unit/component tests (co-located as
`*.test.ts(x)`), [Playwright](https://playwright.dev/) for E2E (in `e2e/`, none
yet). Run `pnpm test` / `pnpm test:e2e`.

## Deployment

Vercel, auto-detected Next.js. Root directory `runtime/`, production branch
`main`. The project's Ignored Build Step skips builds when only `pipeline/` or
`docs/` changed without regenerated tales.
