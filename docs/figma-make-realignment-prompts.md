# Figma Make prompts — realigning the prototype to the runtime

The Figma **Design** file (`PhmORZnicz8g3er2ZspqZl`, "Surprisal Party") was
produced by getting the **Figma Make** prototype into a state, copying its
elements, and pasting them into the Design file as frames. The runtime has since
moved well ahead of that prototype (see the divergences below), so the frames are
stale.

This file is a versioned set of **Figma Make prompts** that drive the prototype
back into line with the runtime. The runtime (`runtime/`) and
`docs/user-scenarios.md` are the source of truth; these prompts translate that
truth into instructions Figma Make can act on without our codebase context.

## Workflow

1. Open the Figma Make prototype.
2. Paste **one** prompt below into Figma Make and let it edit the prototype.
3. Check the result against the prompt's **Acceptance** list.
4. Once a screen looks right, copy its elements and paste into the Figma **Design**
   file as the frame it replaces; update that frame's node id in
   `docs/figma-sources.yaml` if it changes.
5. Tick the prompt's checkbox here.

Run **Batch 1 first** — it's small and low-risk, to calibrate how Figma Make
responds before committing to the larger primer rebuild in Batch 2.

## Conventions (state these to Figma Make as needed)

- **Coral accent ("kernel"):** `#ff6b6b` — used for kernel/surviving words, the
  active-seam highlight, the About title, and links.
- **Ground:** dark background. **Prose text:** near-white. **Muted/faint:** dim
  greys for secondary text.
- The app is desktop-only (min width ~1024px); three regions: header, middle
  prose column, right strip; a slider pinned at the bottom.
- A key framing the prototype currently gets wrong: the **right strip shows the
  actual words that were removed** (ground truth), **not** predictions. The
  model's *predictions* appear inside the middle-column **seams**.

---

## Batch 1 — calibration set (run these first)

### [ ] 1. Header readout — relabel, one decimal, and "conserved" → "avg fidelity"

> Update the explorer's header readout and the right-hand column heading.
>
> 1. The right column's heading currently reads **"Predicted (N words)"**. Change
>    it to **"Removed (N words)"**, keeping the same style and the live count.
> 2. The header readout (top-right) currently reads
>    **"stored X% · predicted Y% · conserved Z%"**. Make three changes:
>    - **Rename** the middle metric's label from **"predicted"** to **"removed"**
>      (keep the lowercase-label / brighter-value styling).
>    - Show **stored** and **removed** with **one decimal place**, e.g.
>      "stored 29.0% · removed 71.0%". Keep `stored + removed = 100.0%` at every
>      slider position.
>    - **Replace the third metric entirely.** Drop the constant **"conserved
>      100%"** and show **"avg fidelity"** instead — the average reconstruction
>      fidelity of the removed words at the current slider position, as a **0–1
>      score with two decimals** (e.g. "avg fidelity 0.25"). It **decreases** as
>      compression deepens (more, harder-to-predict words get removed). At the
>      far-left UNCOMPRESSED position there are no removed words, so show
>      **"avg fidelity —"** (an em dash).
> 3. Don't change layout, colors, or any other copy.
>
> Reference values (Little Red Riding Hood) for the five slider stops: avg
> fidelity reads **—** (uncompressed), then **0.22**, **0.14**, **0.09**, **0.02**.
> (These reflect the adopted **surviving-placeholder** reconstruction strategy —
> reconstruction from surviving context only — which is honestly lossier than the
> earlier original-window approach; see `abstract.md` "Two Regimes".)
>
> Context: the tiles are the actual words removed from the text; the model's
> *predictions* live in the middle-column seams — which is why "Removed" is the
> accurate label, and "avg fidelity" scores how well those seam predictions match
> the originals.

**Targets:** the right column heading + header readout on every explorer state.
**Design frames to refresh:** 28-163, 30-15994, 30-15995, 30-15997, 30-15999, 30-16001 (and the corpus-drawer frames 28-297 / 28-319).
**Note:** this supersedes the old "conserved" metric entirely — including the "conserved 8%" slip on frame 30-15997, which simply goes away once the third metric becomes avg fidelity.

### [ ] 2. Rebuild the About modal copy + title

> Update the **About** modal:
>
> - Change the title to **"Surprisal Party"**, rendered in the coral accent color
>   `#ff6b6b`.
> - Replace the body with two paragraphs:
>   - **Paragraph 1:** "Predictable words carry little information, surprising
>     words carry a lot. The text algorithm demonstrated here preserves words at
>     varying levels of compression based on their surprisal value. Drag the
>     slider to max compression and what stays is the irreducible kernel the model
>     could not have known. Hidden in between the compression seams are predictions
>     of neighboring words. The higher the compression, the more lossy the
>     predictions become."
>   - **Paragraph 2:** "Read the longer write-up at vinceallen.com" — where
>     **vinceallen.com** is a link in the coral accent color that opens in a new
>     browser tab.
> - Keep the centered-card-over-scrim layout and the **"Close"** button. Remove any
>   "Created by …" line.

**Targets:** the About modal.
**Design frame to refresh:** 29-467.

### [ ] 3. Make the "Removed" tiles interactive (hover + click-to-reveal + highlight)

> Make the right **"Removed"** column interactive and link it to the middle
> column's seams (both directions):
>
> 1. **Hover:** when the pointer is over a removed-word tile, brighten its text to
>    white.
> 2. **Click to reveal:** clicking a tile activates the seam in the middle column
>    that this word was removed from. That seam expands to show the model's
>    predicted text inline, and the reconstruction inspector at the bottom of the
>    middle column fills with the **Actual** source text and a **Fidelity** score.
>    If the seam is off-screen, scroll the middle column to bring it into view.
> 3. **Highlight on active seam:** whenever a seam is active — whether from
>    clicking a tile or walking the seams with the arrow keys — highlight the
>    removed-word tiles belonging to that seam with a coral-tinted background
>    (`#ff6b6b` at ~25% opacity) and white text.
>
> The tiles are the actual removed words; the predicted text appears in the seam,
> not on the tile. Don't change the column heading or overall layout.

**Targets:** the seam-walk / interaction state.
**Design frame to refresh:** 30-15997 (consider a second frame showing a tile-click-driven reveal).
**Note:** this is the prototype's first real two-way interaction — use it to gauge how faithfully Figma Make reproduces state-linked behavior before tackling the primer.

---

## Batch 2 — the four-step primer (run after Batch 1)

This replaces the current single-card primer (frame 28-80) with the runtime's
**four-step interactive primer**. It's the largest rebuild, so it's split into
three prompts — shell + the two static steps first, then the slider step, then
the prediction step. Run them in order; each builds on the previous.

The self-referential trick to preserve: the primer teaches surprisal by
compressing **its own definition sentence** — "how much a word surprises a
predictor" — and then predicting it back lossily.

### [ ] 4. Primer rebuild — modal shell + steps 1 & 2

> Replace the current single-card onboarding primer (the modal that reads
> "surprisal = how much a word surprises a predictor" with a "Got it" button)
> with a **four-step** modal. Use a large centered card (wider than the old one,
> ~840px) over the existing scrim; it stays dismissible by clicking the scrim or
> pressing Esc. A footer holds the navigation: a primary **"Next →"** on the
> right, and a **"← Back"** on the left from step 2 onward. Each step's content
> **fades in** when you arrive on it. Build steps 1 and 2 now (3 and 4 follow):
>
> - **Step 1:** a line reading **"surprisal = how much a word surprises a
>   predictor"** with the word **"surprisal"** in the coral accent `#ff6b6b`; below
>   it, a dimmer line: **"predictable words carry little information, surprising
>   words carry a lot"**. Footer: just "Next →".
> - **Step 2:** the same sentence with a small **superscript surprisal number**
>   after each word — **how³ much⁵ a¹ word⁸ surprises¹² a¹ predictor²⁰** — with the
>   word **"predictor"** in coral. Below it, a dimmer caption: **"the small number
>   is each word's surprisal, its cost to a predictor"**. Footer: "← Back" and
>   "Next →".

**Targets:** the onboarding primer (steps 1–2 of 4). **Design frame to refresh:** 28-80 (and add new frames for the extra steps).

### [ ] 5. Primer rebuild — step 3 (threshold slider compresses the sentence)

> Add **step 3** to the four-step primer. It shows the same annotated sentence
> (**how³ much⁵ a¹ word⁸ surprises¹² a¹ predictor²⁰**, "predictor" in coral) with a
> small horizontal **threshold slider** beneath it. The slider has five stops
> labeled **0, 2, 4, 7, 15** (a "surprisal threshold").
>
> A word stays only if its surprisal number is **≥ the current threshold**; words
> below the threshold **fade out and the sentence contracts** (closes up) as they
> leave. So: at 0 the whole sentence shows; at 2 the two "a"s drop; at 4 "how"
> also drops; at 7 "much" also drops; at 15 only **"predictor"** remains.
>
> Below, a dimmer caption: **"raise the threshold to compress the text. only the
> surprising words survive"**. The **"Next →"** button is **disabled until the user
> moves the slider** at least once. Footer: "← Back" and "Next →".

**Targets:** the onboarding primer (step 3 of 4). **Design frame:** new.

### [ ] 6. Primer rebuild — step 4 (predict the sentence back, lossily)

> Add **step 4** (the final step) to the four-step primer. It opens showing just
> the single word **"predictor"** in coral, left-aligned, with a dimmer line
> beneath: **"the higher the surprisal, the more lossy the prediction"**, and a
> button labeled **"predict the uncompressed text"**.
>
> When the button is clicked, **reveal a reconstruction** of the sentence: the
> words **"how often a word fools a"** fade in (in **white**) before "predictor"
> (which stays coral), forming **"how often a word fools a predictor"**. Also show
> a small readout with two labeled values: **Actual** = "how much a word surprises
> a" and **Fidelity** = "0.68" (small uppercase labels, brighter values).
>
> The **"Got it"** button is **disabled until the predict button has been
> clicked**. Footer: "← Back" and "Got it"; "Got it" closes the modal.
>
> (The point: step 3 compressed the sentence down to the kernel "predictor"; step
> 4 runs it backwards — predicting the removed words from the kernel — and the
> prediction is deliberately imperfect, which the fidelity score quantifies.)

**Targets:** the onboarding primer (step 4 of 4). **Design frame:** new.

---

## Batch 3 — remaining polish

### [ ] 7. Prose fade-in when returning to UNCOMPRESSED

> In the explorer, when the slider returns to its far-left (UNCOMPRESSED) position
> and the full text is restored in the middle column, **gently fade the whole
> middle-column text in** (a brief opacity fade, ~240ms). It should replay each
> time the slider comes back to the far left — not only on first load.

**Targets:** the middle-column prose at UNCOMPRESSED. **Design frame:** 28-163 (behavioral; the static frame is unaffected).

### [ ] 8. (Verify, then align) Arrow-key discovery hint

> First check the prototype's current hint. The runtime's arrow-key discovery hint
> is a small bubble reading **"← keys →"** centered just **above the first seam**,
> with a small downward caret/triangle on its bottom edge pointing at the seam. It
> appears the first time the slider moves past UNCOMPRESSED and dismisses on an
> arrow key, Esc, or after a few seconds. If the prototype's hint differs in copy
> or position, align it to this.

**Targets:** the arrow-key nudge. **Design frame to refresh:** 30-15999.

---

## Batch 4 — header metrics explainer

### [ ] 9. Metrics ⓘ icon + explainer modal

> Add a small **info (ⓘ) icon** in the header **immediately to the left of the
> metrics readout** (just before "stored"). Match the existing title ⓘ: same
> size, same muted color, and the same gap between the icon and the first metric
> as the gap between the corpus title and its own ⓘ.
>
> Clicking the icon opens a small **modal** that explains the three header
> metrics. Use the **same card/scrim/type treatment as the About and onboarding
> modals** (centered card over a dimming scrim, same width and padding, a "Close"
> button, dismiss via Close / scrim / Esc). The modal is **headingless** — no
> title — it goes straight into a definition list of the three terms. Each term
> is in the brighter text color, its explanation in the dimmer muted color:
>
> - **stored** — The share of the text's information still on the page, carried by
>   the surviving high-surprisal words.
> - **removed** — The share carried by the words taken out with text compression.
>   They must be predicted to rebuild the text. (stored + removed always total
>   100%)
> - **avg fidelity** — How closely the model's predictions of the removed words
>   match the originals (1.00 = exact). It decreases with compression, since
>   removed words become harder to predict.

**Targets:** the header (new metrics ⓘ) + a new explainer modal. **Design frames to refresh:** the explorer header frames (28-163, 30-15994, …) gain the icon; add a new frame for the modal.

---

## Doc follow-ups (not Figma Make prompts)

- After prompt 3 (removed-tile interactivity) has a frame, add the new scenario
  **"As a user, I can click a removed word to reveal its seam"** to
  [`figma-sources.yaml`](./figma-sources.yaml) with its `description`/`ui` node
  ids; until then it sits as an unmapped/TODO entry.
- The metrics ⓘ → explainer scenario ("As a user, I can learn what the header
  metrics mean") is written in [`user-scenarios.md`](./user-scenarios.md); once
  prompt 9 produces a frame, map it in [`figma-sources.yaml`](./figma-sources.yaml).
- As each batch lands in the Design file, correct any stale node ids in
  `figma-sources.yaml` and confirm every scenario still maps both directions
  (Step 6 DoD #3).
