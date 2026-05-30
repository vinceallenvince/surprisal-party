# CLAUDE.md — runtime/

This file provides guidance to Claude Code when working in the runtime/ directory.

The runtime is the Next.js front-end for the **Compression-Prediction Explorer**. It ships as a fully static site (Vercel-deployed). The runtime fetches cached tale JSON files from `public/tales/` — written there by the offline Python pipeline in `pipeline/` — and renders the slider mechanic against them. **The runtime never tokenizes, scores, or calls a language model.**

See `../docs/abstract.md` and `../docs/implementation-plan.md` for the project's full design context.

## Stack

- **Next.js 16** with the **App Router** (`src/app/`)
- **React 19**
- **Static export** (`output: 'export'` in `next.config.mjs`) — produces `out/` at build time; no SSR, no API routes, no middleware
- **TypeScript** in strict mode, `ES2022` target, path alias `@/*` → `src/*`
- **Tailwind CSS 4** + **DaisyUI 5** (currently themed `bumblebee`)
- **Vitest** + Testing Library for unit/component tests (`pnpm test`)
- **Playwright** for E2E (`pnpm test:e2e`) — no e2e tests yet; will be added against Phase 2 features
- **pnpm** as package manager (pinned via `packageManager` field)
- **Husky + lint-staged + Prettier + ESLint** for pre-commit hygiene

## Development commands

```bash
pnpm dev           # local dev server
pnpm build         # static export to out/
pnpm lint          # eslint
pnpm test          # vitest
pnpm test:watch
pnpm test:e2e
pnpm test:e2e:ui
```

## Directory layout

```
runtime/
├── next.config.mjs        # output: 'export', images.unoptimized: true
├── tsconfig.json          # strict TS, ES2022, @/* -> src/*
├── public/
│   └── tales/             # JSON cache files (written by pipeline/cprediction.run)
└── src/
    ├── app/
    │   ├── layout.tsx     # root layout, <html lang="en">, Geist fonts, DaisyUI theme
    │   ├── page.tsx       # explorer entry (currently a Phase 2 placeholder)
    │   ├── error.tsx      # root error boundary
    │   ├── globals.css    # Tailwind + DaisyUI bootstrap
    │   └── providers/     # ThemeProvider, ToastProvider — available, not yet wired
    ├── components/ui/     # dormant primitives from the skeleton (button, card, form,
    │                      # icons, layout, toast, typography, theme-toggle).
    │                      # Use what helps, prune what doesn't as Phase 2 progresses.
    ├── lib/               # utils.ts (cn), form-validation.ts, logger.ts
    ├── test/setup.ts      # vitest setup (jest-dom matchers)
    └── types/             # shared TS types (toast types live here)
```

## Architectural commitments — do not break these

- **Static export only.** `next build` must produce a fully static `out/` directory. No server components that fetch at request time, no `route.ts` API endpoints, no `middleware.ts`, no `getServerSideProps`. The runtime is just static HTML + client-side JavaScript that reads pre-built JSON.

- **Tale JSON is consumed via `fetch('/tales/<slug>.json')`** at runtime in the browser. The pipeline writes these files; the runtime reads them. No server-side fetching of tales.

- **Single language (English).** The repo's earlier i18n routing was stripped — there is no `[lang]` segment, no locale switcher, no dictionary system. Do not reintroduce them without a docs change first.

- **The cache schema is authoritative.** When the runtime needs TypeScript types for tale JSON, **derive them from the pydantic models in `pipeline/cprediction/cache.py`** (via `model_json_schema()` or a generator) rather than hand-rolling parallel definitions. The runtime must not invent fields the schema doesn't define.

- **Determinism per the abstract.** The runtime renders cached state — same JSON in → same UI out, every time. Do not introduce randomness, live LLM calls, or non-deterministic ordering.

## Path-alias conventions

- All source imports use the `@/*` alias mapping to `src/*`.
- `@/lib/utils` is the canonical home for the `cn` class-merge helper (and small future utilities).
- The skeleton previously had a duplicate `@/app/lib/utils`; that's been consolidated. Don't recreate it.

## Phase 2 milestones (in order)

These come from `../docs/implementation-plan.md`. Each is independently testable:

1. **Static rendering** of a cached state at a mid-slider position (no slider control yet).
2. **Slider control** that swaps between cached states (no animation yet).
3. **Gap-closing reflow + tile-migration animation** (FLIP technique).
4. **Seam interaction** — hover-peek + click-lock.

The Phase 2 exit criterion is: someone can drag the slider through a tale and the title-fade surprise lands without explanation.

## Useful skeleton bits

- **DaisyUI components** (`card`, `btn`, etc.) work via Tailwind utility classes. Theme is set on `<html data-theme="bumblebee">`.
- **`clsx` + `tailwind-merge`** combined as `cn()` in `@/lib/utils`.
- **`lucide-react`** for icons.
- **`zod`** is installed — use it for runtime validation of fetched tale JSON if you want a belt-and-suspenders check before trusting the cache.

## Deployment

Vercel auto-detects the Next.js project. Per the implementation plan:

- **Root directory:** `runtime/`
- **Framework preset:** Next.js (auto-detected)
- **Production branch:** `main`
- **Ignored Build Step:** `git diff HEAD^ HEAD --quiet -- runtime/ || exit 1` — skips builds when only `pipeline/` or `docs/` changed without regenerated tales
