# Implementation Plan

A four-phase plan: a spike to derisk the core hypothesis, then the data pipeline, then the runtime built directly against the static Figma designs, and finally hardening it for release. V1 commits to **Tier A** of *Determinism and Variability* (see the abstract): a single cached reconstruction per gap, fully deterministic, static-site architecture, no runtime language-model calls.

## Stack

- **Pipeline (Phase 0 and Phase 1): Python.** Loads the reference model locally via `transformers` and `torch`; Unicode normalization, regex, sentence segmentation, and JSON output are ecosystem-native; REPL-driven iteration suits the reconciliation work; `pytest` covers the unit tests on tricky inputs. The pipeline writes JSON output directly into the runtime's `public/tales/` directory so the files are served as plain static assets.
- **Runtime (Phase 2 and Phase 3): Next.js.** The slider mechanic ships as a Next.js app, with the cached tale JSONs served as static content from `public/`. The runtime's only job is to fetch JSON and render the slider mechanic; it never tokenizes, scores, or calls a language model.
- **Deployment: Vercel.** Auto-detected Next.js, per-PR preview deployments, production on `main`. See *Deployment* below.

```text
surprisal-party/
├── docs/                                 # design docs
├── pipeline/                             # Python — Phase 0 & 1
│   ├── reconciliation.py
│   ├── score.py
│   ├── reconstruct.py
│   ├── tests/
│   └── pyproject.toml
└── runtime/                              # Next.js — Phase 2 & 3
    └── public/
        └── tales/                        # static JSON output (committed)
```

## Deployment

V1 deploys to **Vercel** with the GitHub repo connected. The pipeline never runs on Vercel — only the Next.js runtime is built and served.

**Workflow:**

1. Pipeline runs locally on the developer's machine with the `Qwen2.5-7B-Instruct` weights cached in `~/.cache/huggingface/`. No API key, no network calls during scoring or reconstruction. It writes JSON files into `runtime/public/tales/`.
2. Pipeline source changes and regenerated JSON are committed together.
3. Push to a branch → Vercel auto-builds the runtime → preview URL appears on the PR.
4. Merge into `main` → production deploy.

**Properties this preserves:**

- No API keys exist anywhere in the project — the pipeline runs the model locally. Vercel needs zero environment variables for v1.
- Every Vercel build serves bit-for-bit identical JSON, preserving the determinism committed to in *Determinism and Variability*.
- Tale JSONs are plain static files under `public/`, served by Vercel's CDN with no serverless invocation per fetch.
- Per-PR preview URLs make UX checks — "does the title-fade surprise still land?" — shareable with collaborators on every branch.

**Vercel project settings:**

- **Root directory:** `runtime/`.
- **Framework preset:** Next.js (auto-detected).
- **Production branch:** `main`.
- **Ignored Build Step:** `git diff HEAD^ HEAD --quiet -- runtime/ || exit 1` — skips builds when only `pipeline/` or `docs/` changed without regenerated tales.

## Phase 0 — Spike (a few days)

**Goal:** confirm that reconstructions at deep compression are worth showing, and that the tokenization reconciliation layer behaves correctly on the trickier inputs. A cheap kill-switch before committing to the full pipeline.

**Scope:**

1. **Build the tokenization reconciliation layer.** This is the bridge between model tokens and user-visible words; everything downstream depends on it being correct. Includes unit tests on tricky inputs: multi-token names (e.g. *Aschenputtel*), contractions (*grandmother's*), hyphenated forms (*well-known*), sentence-initial words, punctuation-heavy passages, and Unicode-heavy source text.

   **Committed rules:**
   - **Leading whitespace** attaches to the following word (the word the space precedes). This matches BPE's natural behavior of producing tokens like `" grandmother"`.
   - **Punctuation** folds into the trailing word's tile, so `wolf,` is one tile. **Terminal punctuation** (`.`, `!`, `?`) is additionally anchored: it remains visible even when its attached word fades, so sentence boundaries stay legible at every slider position.
   - **Apostrophes and hyphens** do not split words: `grandmother's` and `well-known` are each a single word.
   - **BOS/EOS tokens** are stripped before aggregating surprisal so they do not contaminate the conserved total.
   - **Unicode** is normalized in the source text before scoring (Unicode normalization, smart-quote folding, en-dash handling) to avoid surprising tokenizations.

2. **Run the pipeline end-to-end on one fairy tale.** Use the reconciliation layer to score the tale, compute reconstructions at four or five threshold settings (including the far-right kernel-only case), and emit a hand-readable intermediate file.

3. **Eyeball.** Read the reconstructions and fidelity scores and decide whether they're worth showing.

**Decision point:** if the kernel-only reconstruction reads beautifully and the reconciliation layer passes its tests, proceed to Phase 1. If reconstructions are weak, adjust model or prompting; if reconciliation produces nonsensical alignments, fix the rules. If neither helps after a reasonable attempt, pivot the project before more time is invested.

**Exit criterion:** "I looked at the far-right reconstruction and want to show it to someone, and the reconciliation layer handled every tested edge case correctly."

## Phase 1 — Data pipeline and static cache

Build the offline pipeline that produces one JSON per tale, committed to the repo or hosted as static assets. The runtime in Phase 2 will simply fetch these. The runtime never calls a language model.

**Committed decisions for the pipeline:**

- **Tokenization reconciliation:** built and tested in Phase 0; downstream operates on words.
- **Threshold-stepping scheme:** a fixed set of discrete slider positions, each backed by precomputed state in the cache.
- **Cache schema:** one JSON per tale containing words (text, character offset, surprisal), the kernel set, span boundaries per slider position, reconstructions per gap per position, and fidelity scores. Schema is versioned.
- **Reference model:** `Qwen/Qwen2.5-7B-Instruct` loaded locally via `transformers`. The pipeline performs a single forward pass over the source text to extract exact per-token logprobs (no iteration, no API), and uses the same model for gap reconstruction via the chat template. *One model, both directions* is preserved bit-for-bit because the weights are literally identical between the two stages. Background: neither Anthropic nor OpenAI exposes a viable API surface for arbitrary source-text logprobs (see `pipeline/docs/api-notes.md`), and the only OpenAI workaround relied on a deprecation-prone older model. Local inference removes the vendor dependency entirely, makes the pipeline reproducible, and leaves a clean path for a future Tier C live-prediction layer (self-host the same weights behind a thin endpoint).
- **Span-merging rule:** sentence-boundary-bounded greedy, with a cap of ~30–40 words that triggers a split at the nearest sub-sentence boundary (comma, semicolon, em-dash) rather than mid-phrase. Terminal punctuation stays anchored (per Phase 0) so sentence boundaries remain visible at every slider position.
- **Starter corpus:** Little Red Riding Hood and Hansel and Gretel, roughly 1,500–3,000 words each (per `docs/abstract.md`). The remaining 8–13 tales will be selected during or after Phase 2, once the mechanic is validated against the starter pair.

**Open evaluations during Phase 1:**

- **Reconstruction-quality model upgrade.** Phase 0 used `Qwen/Qwen2.5-7B-Instruct` and validated the mechanic on LRRH and H&G. The reviewer flagged reconstruction quality on long, deeply-compressed gaps as a Phase 1 axis — greedy decoding sometimes terminates early and produces paraphrasic rather than source-faithful fills. Worth evaluating a larger model against the same two tales for side-by-side comparison before the cache is finalized for the full corpus.

  Candidate ranking on a 24 GB Apple Silicon M4 (the current dev hardware):

  | Model | Quality tier | Memory at 4-bit | Backend swap needed? |
  |---|---|---|---|
  | `Qwen/Qwen3-8B` (or similar dense 8B) | modest bump over 2.5-7B | fits at bf16 (~16 GB) | No — stays on `transformers` |
  | `mlx-community/Qwen3-30B-A3B-4bit` | 30B-class reconstruction at ~3B-dense inference cost (MoE A3B) | ~15 GB int4 | **Yes** — `transformers` → `mlx-lm` |
  | `mlx-community/Qwen3.6-27B-4bit` (dense) | high quality, slowest | ~14 GB int4 | Yes — MLX |
  | `mlx-community/Gemma-4-26B-A4B-it-4bit` | comparable to Qwen3-30B-A3B | ~13 GB int4 | Yes — MLX |

  Key constraint: all candidates above 8B require 4-bit quantization to fit in 24 GB unified memory. MoE total-param size dictates memory regardless of active params per token (the router needs all experts resident). On Apple Silicon, MLX is the cleanest path to running int4-quantized models, but it is a backend swap — `_model.py`, `score.py`, and `reconstruct.py` change; reconciliation, spans, thresholds, and fidelity are unchanged.

  **Recommended sequence:** (1) try `Qwen3-8B` first (one-line config change) and re-run LRRH + H&G; (2) if the quality bump is enough, ship it; (3) only if it isn't, take the MLX detour to `Qwen3-30B-A3B-4bit`; (4) if *even that* isn't enough, escalate to a hosted model via HF Inference Providers — see below.

  Either way, the new cache must be regenerated for the whole starter corpus and a brief comparison note added to `pipeline/docs/api-notes.md`.

  **Step-4 fallback: HF Inference Providers.** If neither the 8B nor the local 30B-A3B-4bit produces acceptable reconstruction quality, escalate to a much larger hosted model (Llama 3.1 405B, Qwen3-72B+, DeepSeek-V3, etc.) via [HuggingFace Inference Providers](https://huggingface.co/docs/inference-providers/). The pipeline stays build-time-only (Tier A determinism preserved at the artifact level), the static-site architecture is unchanged, and *one model, both directions* still holds — same hosted model for both `score()` and `reconstruct()`. Tradeoffs:

  - **Per-token cost.** Builds become non-free — roughly $5–$30 for the full 10–15 tale corpus, depending on chosen model and provider.
  - **Vendor coupling returns.** Mitigation: HF Inference Providers is itself a unifying layer over multiple providers (Together AI, Fireworks, Replicate, etc.), so we are not locked to one vendor.
  - **Reproducibility weakens.** A hosted endpoint can silently version-shift its weights between runs; the cache becomes "Qwen3-72B as Together served it on date X" rather than a self-contained artifact. Pin model + provider + date in the cache metadata.
  - **API surface must support echo + logprobs.** Same hard requirement that ruled out OpenAI's chat-completions endpoint applies here. **Before integrating**, write a ~30-line probe script that hits the chosen provider with a short passage, asks for echo logprobs over the prompt, and confirms the returned bits are non-trivial (not all ~0 like the OpenAI echo collapse). Together AI's `/v1/completions` endpoint on a base/instruct open-weight model is the most likely candidate; chat-only endpoints will not work for `score()`.

  Adds one new runtime dependency (the HF Inference Providers SDK or a direct provider client), one new env var (`HF_TOKEN` or equivalent), and provider/model selection captured in the cache metadata for traceability.

**Variability tier:** **Tier A.** One reconstruction per gap. Any sampling step is seeded; outputs are committed so the cache is bit-for-bit reproducible.

**Output:** 10–15 tale JSONs written to `runtime/public/tales/`, schema-validated, hand-inspectable, committed alongside pipeline source changes.

**Exit criterion:** all caches built and pass validation; rendering any cached state by hand produces a sensible snapshot.

## Phase 2 — Build the runtime against the static designs ✅

A static site that fetches a corpus JSON and runs the slider mechanic. No backend.

**Status — ✅ complete.** All six internal steps are built and styled to their Figma frames, and the runtime is deployed to production (surprisal.party). Behaviour is covered by unit tests (vitest) and per-epic Playwright e2e suites (Onboarding, Corpus Selection, Compression ⟷ Prediction), run in CI on every push/PR. The exit criterion below is met: a person can drag the slider through a corpus, walk the seams, switch corpora, and meet the onboarding primer, and the title-fade surprise lands.

**Why this is no longer an "ugly but functional" interim.** The original plan called for a deliberately unstyled build with all styling deferred to Phase 3. That made sense when the visual design was still unknown and would be *discovered* by building. It no longer holds: the design is fixed — a high-fidelity Figma Make prototype and a set of static Figma Design frames, one per scenario/state (see `process.md`, Step 6). Building unstyled then restyling would be wasted motion and would invite drift from the established design. So Phase 2 builds **styled from the first commit, directly against the frames**, sequenced by **dependency and risk** rather than by fidelity. (The position-to-position transition is the trickiest piece and is isolated in Step 4: an instant reflow with a few light CSS touches — no FLIP or layout animation.)

**Source of truth — scenarios first, Figma as a guide.** The user scenarios (`user-scenarios.md`) are the authority for **behaviour and interaction**; the Figma frames are the guide for **visual design and layout**. Where the two disagree, the *scenario wins* and the frame is treated as stale — note the drift so the frame can be corrected later. Some scenarios have **no frame at all** (see `figma-sources.yaml` → `unmapped_scenarios`, e.g. the two-regimes behaviour); those are built and verified against their Gherkin alone.

**Role of the static designs here — the visual coding reference.** Look up each scenario's frame node IDs in `figma-sources.yaml` (don't re-query the MCP just to *find* a frame); then call the Figma MCP (`get_design_context` / `get_screenshot`) only to pull the actual design context for the node you're implementing, and match its **visuals/layout** rather than reinventing the UI. Extract the design **tokens** (the warm coral-red accent, type, spacing, the near-black warm-gray ground) up front so everything built after sits on-spec. (The frames' second role — QA oracle — comes in Phase 3.)

**Internal sequence (each step independently testable; behaviour verified against the relevant scenario's Gherkin, visuals against its Figma frame):**

1. **Design tokens + static shell.** Extract colors / type / spacing from the Figma file into runtime tokens. Build the static three-region shell — header (title + ⓘ info icon + readout), middle column, right strip, slider — matched to its Figma frame (looked up in `figma-sources.yaml`). No data yet.
2. **Data binding.** Fetch a corpus JSON and render one cached mid-slider state into the shell, matching its state frame. Confirms cache shape and data flow.
3. **Slider state-swap (no animation).** Wire the five fixed positions to their cached states; each rendered position should match its corresponding compression frame. Confirms the interaction model.
4. **State transition.** Moving the slider swaps positions with **no layout/FLIP animation** — the prose reflows instantly (no `framer-motion`, no `getBoundingClientRect`, no transforms). Three light touches make the change legible:
   - **Colour crossfade.** Word spans are keyed by their **list position** (not word identity), so as the text reflows each DOM slot is reused and its colour eases between the old and new occupant — a soft white↔coral shimmer (`transition-colors`, ~0.7s). Kernel words stay coral from position 0. The prose column is **not** remounted on a swap (so the slots persist and the crossfade can run; scroll position is kept).
   - **Reveal flash.** A small random subset of the seams briefly **opens its predicted text inline** — expanding left-to-right to the prose size in grey, then collapsing — pushing the surrounding text in a fast "reshuffle" that signals the prediction changing. The subset is drawn from the **top quarter** of the seams (most likely above the fold) and its size falls off **exponentially** with compression (≈ `2^(maxIndex − index)`: more reveals when shallow, one at MAX). Selection uses `Math.random` — a deliberate exception to the determinism rule, since it is transient and decorative (the resting DOM is identical every time).
   - **Constellation at depth.** A real paragraph break (blank line) renders only while ≤ half the words are removed; past that, breaks collapse to spaces so the sparse survivors form a continuous constellation rather than tall vertical voids. (A single source line-wrap newline always collapses to a space; any separator touching a removed span collapses too.)
   - The right strip's tiles render statically (no entrance animation). All motion honours `prefers-reduced-motion`.
5. **Seam reconstruction reveal + keyboard walk.** The arrow keys step through the seams in story order, driving a single shared **active seam**. The active seam expands its predicted text inline (dimmed, in the reading type) and fills a fixed reconstruction inspector at the bottom of the middle column with the actual text + fidelity; advancing collapses the previous seam and opens the next. **Right** = next, **Left** = previous (no wrap-around), **Esc** clears; the column auto-scrolls to keep the active seam in view. The reveal is keyboard-driven only — the slider stays mouse-only, so the keys never conflict. Each step plays a soft advance/back click sound from `public/audio/`. The inspector's height is always reserved (no reflow); no floating card. Honour `prefers-reduced-motion` and the user's sound preference.
6. **Onboarding + navigation surfaces.** The first-visit primer, the header ⓘ re-summon, the corpus-picker drawer, and the About modal.

   **Primer dev-override (no design frame — implementation concern).** The primer shows once, gated by a persisted seen-flag (e.g. `localStorage`). For iteration without clearing browser storage, a development override forces it to appear regardless of the flag: an env flag (e.g. `NEXT_PUBLIC_FORCE_INTRO`) and/or an `?intro` query param. The override only changes whether the modal renders — it must **not** mutate the persisted seen record. This is a build-time/dev affordance, not a user scenario, so it lives here rather than in `user-scenarios.md` or `figma-sources.yaml`.

**Exit criterion:** every happy-path user scenario is implemented and styled to its Figma frame; a person can drag the slider through a corpus, walk the seams, switch corpora, and meet the onboarding primer — and the title-fade surprise lands.

## Phase 3 — Harden, QA, and ship

With styling no longer deferred, this is **not** a "make it pretty" pass. It is the cross-cutting work that can't be read off a single frame: conformance QA, the non-happy paths, and the performance / accessibility / responsive envelope.

**Role of the static designs here — the visual QA oracle.** Two oracles, matching the source-of-truth split: the **scenario Gherkin** is the oracle for behaviour, the **Figma frame** is the oracle for visual layout. Per `process.md` Step 7: Playwright drives the running app through each scenario, checks behaviour against the Gherkin, and compares the rendered screen against the corresponding static Figma frame (looked up in `figma-sources.yaml`, pulled via the MCP). Treat the visual half as structural/layout conformance plus spot-checks, **not** brittle pixel-diffing. Scenarios under `unmapped_scenarios` (no frame) are verified against their Gherkin only.

**Scope:**
- **Conformance QA.** The Playwright-vs-frame gate above, run across every scenario.
- **Performance.** Layout caching, viewport culling, animation budget for long corpora with many tokens.
- **Accessibility.** Screen-reader treatment of seams and migrated tiles, focus order, honouring `prefers-reduced-motion` (both motion and the click sounds), and full operability of the keyboard walk. (Keyboard navigation is now a core feature, not a polish item.)
- **Responsive envelope.** Two viewport builds. The **desktop/tablet** build (≥1024 px) is the full experience. Below that, a **mobile** build presents a **view-only compression** experience: it keeps the slider → compress → kernel mechanic and shows seams as plain gap marks, and drops the right "Removed" strip and migrated word-tiles, the seam reveal (predicted text), the reconstruction inspector, the header metrics readout (`stored / removed / avg fidelity`) and its explainer, and the arrow-key walk / click-a-removed-word affordances. The onboarding primer is unchanged. Behaviour authority for the divergence is the `@desktop` / `@mobile`-tagged scenarios in `user-scenarios.md`; the per-viewport Figma frames are tracked via the parallel `ui_mobile` lists in `figma-sources.yaml`. (This supersedes the earlier "no phone/touch build" constraint and the old tap-to-peek / long-press adaptation — mobile is deliberately view-only, with no touch substitute for the keyboard walk or the reveal.)
- **Edge cases.** Very short and very long corpora, error and loading states, slow networks, a first load with no `localStorage`.

**Optional escalation if v1 feels too predetermined in use:** generate 3–5 reconstructions per gap and pick one per session or per seam-open. This is **Tier B** from the abstract — same architecture, one regeneration of the cache. **Tier C** (live generation) is deferred beyond v1 unless A and B both prove insufficient.

**Exit criterion:** a stranger handed the URL figures out the mechanic without explanation, every scenario passes its conformance check, and the build holds up across the supported viewport range and edge cases.

## Loading screen — boot experience

The default corpus JSON is large (Hansel & Gretel is ~1.3 MB) and the corpus set will grow, so on a slow connection first paint can stall. Rather than a spinner, the boot wait **performs the app's own mechanic**: the phrase *"we threw you a surprisal party"* is shown with each word's surprisal as a superscript and compresses to its coral kernel `surprisal party` as the cache loads. This replaces the bare null-guard skeleton in `runtime/src/components/explorer/ExplorerContainer.tsx`. Behaviour authority is the `## Loading` section of `user-scenarios.md`; the visual guide is the Figma **Loading** page (`84:4`); Figma Make prompts that produced it live in `figma-make-prompts.md`.

**Source of truth — design frames.** Figma Loading page `84:4`, file `PhmORZnicz8g3er2ZspqZl`:

| State | Node | Phrase |
|---|---|---|
| Pre-load (full phrase) | `84:834` | `we² threw⁷ you³ a¹ surprisal²⁰ party¹⁸` |
| Loading in process | `84:862` | `threw⁷ surprisal²⁰ party¹⁸` (after `a, we, you` drop) |
| Loading complete | `84:878` | clean `surprisal party` (superscripts gone) |
| Abbreviated (returning) | `84:886` | clean `surprisal party` |

The frame's literal styles are already the runtime tokens: ground `#0d0d0d` (`bg-ground`), word `#e0e0e0` 32px (`text-prose`), superscript `#6a6a6a` 16px (`text-faint`), kernel `#ff6b6b` (`text-kernel`). The font becomes the app's `font-sans` (Geist), **not** the Figma-exported Inter.

**Scope.** Initial app boot only. The loader gates **only the default corpus** fetch — the manifest's first entry (`DEFAULT_CORPUS_SLUG`); the others load on demand when picked in the drawer (per the Corpus Selection scenarios) and keep the existing lightweight per-switch skeleton. Gating the ceremony on *all* corpora would make it wait for every 1 MB+ file, defeating its purpose. If on-demand switches should feel instant later, warm the remaining corpora with a **non-blocking background prefetch after boot** (idle time; never blocks the loader) — an optional follow-on, not part of this path.

**Architecture.** A new presentational/animation component `LoadingScreen` (in `src/components/explorer/`), orchestrated by `ExplorerContainer`, which owns the fetch and the boot decision.

- **The collapse is decoupled from bytes.** `fetch().json()` exposes no progress, and gzip makes a byte-percentage unreliable (the `Content-Length` is the compressed size while the stream yields decompressed bytes). So the collapse is a fixed, timed sequence; the real fetch only gates the *exit*. `LoadingScreen` props: `{ loaded: boolean; abbreviated: boolean; onComplete: () => void }`, with `loaded` derived in the container as `cache !== null`.
- **Internal state machine** (timer-driven, all timers tracked in a ref and cleared on unmount — StrictMode-safe, no setState-in-effect): `intro → hold → collapse(a→we→you→threw) → rest → settle → kernelHold → exit → onComplete()`.
  - **Word drops are hard cuts:** surviving tokens are simply rendered (conditional), so flexbox re-centres instantly — no per-word fade or width transition.
  - **`settle`** is the only animated step: the superscripts fade (~300 ms), then the two kernel words slide together to reclaim the superscript space, leaving a clean centred `surprisal party`.
  - **`rest → settle` is the load gate:** on entering `rest` the timeline holds on the kernel until `loaded` is true (matching the scenario's "rests on the kernel until it finishes"), then proceeds.
- **Phrase data** is authored, not pipeline output (mirroring `PrimerModal`'s illustrative constants): `we² threw⁷ you³ a¹ surprisal²⁰ party¹⁸`; kernel = `surprisal`, `party`; drop order ascending by surprisal (`a, we, you, threw`).

**Timings (full / abbreviated):** hold 2000 / 500 ms · per-word drop interval 450 / 200 ms · settle 300 / 250 ms · kernelHold 2000 / 700 ms · exit fade 400 / 400 ms. Kept in one constants block for tuning.

**Reduced motion.** Via the existing `usePrefersReducedMotion()` hook: skip the staged collapse and crossfade directly from full phrase to clean kernel; the holds still apply (shortened) so the message stays legible.

**Boot integration (`ExplorerContainer`).** Add a `booted` flag. While `!booted`, render `LoadingScreen` as a fixed overlay over the (warming) explorer; reveal on its `onComplete`. `abbreviated = hasSeenPrimer()` (reuse `lib/primer`, read after mount — SSR-safe, the same deferral the primer gating already uses). The first-visit primer now opens **on `onComplete`** rather than on mount (returning visitors get no primer); the `?intro` / `NEXT_PUBLIC_FORCE_INTRO` override still forces it, after the loader. Corpus switching is unchanged and leaves `booted` true.

**Replay shortcut (implementation concern, no design frame).** A document-level keydown for **Shift+Cmd+L** (Shift+Ctrl+L on Windows) resets `booted=false` to replay the full ceremony — **available in production**, not dev-gated. It must `preventDefault()` (Cmd+L focuses the browser address bar). On replay the cache is already loaded, so `loaded` is immediately true and the timeline runs straight through to the exit.

**SSR / determinism.** The server render is the full phrase (`hold` state), identical on the client (no hydration mismatch); the abbreviated/reduced decisions change only timing, not the initial DOM. A `data-phase` attribute on the root exposes the phase, and a `data-dropped` attribute lists the words removed so far, for deterministic e2e capture.

**Boot-control query params (test + dev affordance, no design frame — like the `?intro` primer override).** Because the loader sits in front of everything, it must be steerable deterministically:
- `?boot=skip` — skip the loader entirely (mount the explorer immediately). **Every non-loading e2e spec (onboarding, corpus-selection, compression) must navigate with `?boot=skip`** so the ceremony does not block their assertions; this is the only change required to the existing suites.
- `?boot=manual` — mount the loader but suspend the timers; the machine advances one named state per call to a `window.__boot.next()` hook (attached only in this mode). This lets the loading spec capture each keyframe with **no timing race** (the mid-collapse snapshot in particular is otherwise a ~450 ms window).
- `?boot=stall` — run the full timeline but hold `loaded=false` forever, so the screen rests on the kernel (used to verify the rest-until-loaded behaviour).

These are deterministic, persisted-flag-free overrides; they never mutate `localStorage` and are inert without the param.

### Testing & Definition of Done

The DoD is **both layers of the e2e suite passing** for the Loading epic, the same two-oracle split the rest of the app uses (`process.md` Step 7):

- **Unit** (`LoadingScreen.test.tsx`, fake timers): full phrase + superscripts + coral kernel render; hard-cut drop order (`a → we → you → threw`); rests-on-kernel until `loaded` flips; abbreviated timeline is faster; reduced-motion path crossfades (no intermediate drops); `onComplete` fires after the exit fade. Plus an `ExplorerContainer` test for the replay shortcut and the primer-opens-on-`onComplete` sequencing.
- **Layer 1 — Playwright** (`e2e/loading.spec.ts`): behaviour against the two `## Loading` Gherkin stories, capturing viewport screenshots into `e2e/__screens__/loading/` via the `?boot=manual` step hook at the states that map to Figma frames:
  - `loading-full` → node `84-833` (full annotated phrase)
  - `loading-collapse` → node `84-861` (mid-collapse: `threw⁷ surprisal²⁰ party¹⁸`)
  - `loading-kernel-clean` → node `84-877` (clean coral `surprisal party`, superscripts gone)
  - `loading-abbreviated` → node `84-885` (returning-visitor end state)

  (The kernel-with-superscripts *rest* state has no design frame, so it is asserted behaviourally only — not captured for Layer 2.) The new spec runs in CI alongside the existing suites.
- **Layer 2 — figma-alignment** (advisory skill, run locally with the Figma MCP): pairs each captured shot above with its frame and writes `e2e/loading-alignment.md`. **DoD requires every pair to read `Aligned` or `Minor differences` — no `Notable differences`** (any genuine drift either fixed in the runtime or, if the frame is stale, noted for frame correction).

**Traceability.** A `Loading` epic is added to `figma-sources.yaml` (`page: "84-4"`, `epic_dir: "loading"`) mapping the two stories and the four ui nodes above, with real `shot` names (the screenshots exist once Layer 1 runs).
