# Process

How this project got built, captured for a later write-up. The throughline: **design up front, validate with code, then design the UX in detail once the technique was proven** — and let working software drive the design back, first a prototype and then the runtime itself.

## The sequence

1. **Brainstorm the core concept.** Establish the central claim — that compression and prediction are the same measurable mechanic, not a metaphor — and the demonstration that makes it felt: a single slider that fades predictable words and relocates their information to a predictor. → [`abstract.md`](./abstract.md)

2. **Write user scenarios.** Translate the concept into Gherkin-style scenarios describing what the user does and sees. → [`user-scenarios.md`](./user-scenarios.md)

3. **Write the implementation plan.** Phase the build, starting with the offline pipeline (surprisal scoring + reconstruction) before any UI. → [`implementation-plan.md`](./implementation-plan.md)

   > Steps 1–3 were authored together as one up-front design package (the initial commit), then put to the test by code rather than treated as three separately-dated milestones.

4. **Execute the pre-UX steps to prove feasibility.** Build the pipeline (tokenization reconciliation, surprisal scoring, gap reconstruction, a versioned JSON cache) and run it end-to-end on real fairy tales. This is where the project's main technical risk lived — the choice of reference model churned before it settled:

   - Claude → OpenAI `gpt-5.4-mini` → local **Qwen2.5-7B-Instruct** (both stages)
   - then trialed **Qwen3-8B** in Phase 1 and **reverted** to Qwen2.5-7B.

   That model-selection loop *is* the feasibility story: it proved the surprisal-plus-reconstruction pipeline was viable and pinned down the model that could carry it. → pipeline output: [`../pipeline/output/`](../pipeline/output/)

5. **Write the layout plan.** Only after the technique was proven, specify the UX/UI in detail — the three-region layout, the slider, seams, the conservation readout — as a self-contained brief for an AI design tool. → [`prototyping-layout.md`](./prototyping-layout.md)

6. **Prototype with Figma Make, then refine back.** Use the layout brief to prompt Figma Make into a working prototype, then let the prototype drive refinements to both the layout plan and the user scenarios (e.g. dropping the floating reconstruction "cards" in favor of an inline seam reveal plus a fixed inspector, adding the corpus picker, and adding arrow-key seam navigation). → [`prototyping-layout.md`](./prototyping-layout.md), [`user-scenarios.md`](./user-scenarios.md)

   This step is a loop — prompt Figma Make, critique the prototype, refine the briefs, re-prompt — and it ends by distilling the prototype into a durable design reference. Two Figma artifacts are in play, and the distinction is the whole point:

   - **Figma Make prototype** — interactive and code-backed; exercises the *flow*. Good for feeling the mechanic, but it regenerates and is not a stable reference.
   - **Figma Design flat frames** — static screens in the `Surprisal — Web` file, one per scenario/state. These are the durable, MCP-readable reference the runtime is coded against and checked against.

   **Definition of Done (Step 6):**

   1. The interactive prototype covers the full UX flow — all five compression states, the seam reveal, the keyboard walk, and the corpus picker.
   2. A static Figma Design frame exists for each key screen/state in the `Surprisal Party — Design` Figma Design file.
   3. Every frame maps to a named user scenario — traceable in both directions.
   4. Frames and their layers are sensibly named so the Figma MCP (`get_design_context`, `get_screenshot`) returns usable specs rather than anonymous `Text` nodes.
   5. [`prototyping-layout.md`](./prototyping-layout.md) and [`user-scenarios.md`](./user-scenarios.md) are reconciled with what the frames actually show — no known drift.

7. **Build the runtime in coordination with Figma Design.** Implement each user scenario in the Next.js runtime, using the static Figma frames as the coding reference rather than reinventing the UI. → [`implementation-plan.md`](./implementation-plan.md)

   - Pull per-screen design context through the Figma MCP as the coding spec for each scenario.
   - Drive the build with the `nextjs-coding-agent` / `nextjs-code-reviewer` loop (looping until the reviewer signs off).
   - **Visual conformance gate:** Claude Code launches Playwright to screenshot the running app per scenario and compares it against the corresponding static Figma frame (pulled via the MCP).

   **Definition of Done (Step 7):** every user scenario is implemented such that its behavior matches its Gherkin *and* its rendered screen matches its Figma frame, with reviewer sign-off across the board.

8. **Bridge the runtime back to Figma Design via Figma Make.** In practice the runtime doesn't stay pinned to the frames: live, in-app iteration pushes it ahead of them (the four-step interactive primer, the "Predicted" → "Removed" relabel and one-decimal readout, the two-way seam ↔ removed-tile linking, the About rewrite, …). Rather than redrawing frames by hand, use **Figma Make as the bridge**, running the loop in reverse — runtime → prototype → frames. → [`figma-make-realignment-prompts.md`](./figma-make-realignment-prompts.md)

   The mechanic that makes this work: the Figma Design frames were originally *pasted* out of the Figma Make prototype, so re-prompting the prototype to match the runtime and re-pasting keeps a single visual lineage.

   - Have **Claude Code author the targeted, versioned prompts** — it already holds the runtime and scenarios in context, so it can translate each change into Figma Make's terms (exact copy, colors, behavior) that Figma Make can't pull from our codebase. Keep them in [`figma-make-realignment-prompts.md`](./figma-make-realignment-prompts.md).
   - Run them in **small batches**: calibrate on low-risk text/label changes before committing to larger interactive rebuilds (e.g. the primer).
   - Once a screen looks right, copy its elements into the matching Figma Design frame and keep [`figma-sources.yaml`](./figma-sources.yaml) in sync (map new scenarios, correct stale node ids).

   **Definition of Done (Step 8):** the Figma Design frames reflect the shipped runtime — every diverged screen regenerated via a recorded Figma Make prompt and re-pasted, with `figma-sources.yaml` updated (new scenarios mapped, stale node ids fixed) and no known runtime ↔ frame drift.

## Timeline

The work spanned **2026-05-24 → 2026-05-31** (commit dates):

- **05-24 → 05-25** — feasibility: the offline pipeline and the reference-model churn (step 4).
- **05-30** — the layout brief (step 5), after the pipeline was proven.
- **05-31 onward** — prototype-driven refinements to layout and scenarios (step 6, in progress).
- **Next** — distill the prototype into traced Figma Design frames (close out step 6), then the runtime build-out checked against those frames (step 7, pending).
- **Then** — as the runtime advanced ahead of the frames through live iteration, bridge it back to Figma Design with Figma Make prompts (step 8).

## A note for the write-up

[`abstract.md`](./abstract.md) still describes the original "reconstruction card" interaction. That mechanic was superseded during step 6 by the inline-reveal-at-seam plus fixed-inspector design. The abstract is a *conceptual* document, not a UX spec, so the divergence is intentional — but if it's quoted, note that its card framing is pre-prototype and the shipped interaction differs.
