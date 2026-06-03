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
responds before committing to the larger primer rebuild in the backlog.

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

### [ ] 1. Relabel "Predicted" → "Removed" + one-decimal readout

> In the explorer prototype, rename the right-hand column and its matching header
> metric from "Predicted" to "Removed", and show the percentages to one decimal.
>
> 1. The right column's heading currently reads **"Predicted (N words)"**. Change
>    it to **"Removed (N words)"**, keeping the same style and the live count.
> 2. The header readout (top-right) currently reads
>    **"stored X% · predicted Y% · conserved Z%"**. Change the middle label from
>    **"predicted"** to **"removed"** (keep the lowercase label / brighter value
>    styling).
> 3. Show all three percentages with **one decimal place**, e.g.
>    **"stored 29.0% · removed 71.0% · conserved 100.0%"**. Keep
>    `stored + removed = 100.0%` at every slider position, and `conserved` always
>    `100.0%`.
> 4. Don't change layout, colors, or any other copy.
>
> Context: these tiles are the actual words removed from the text; the model's
> predictions live in the middle-column seams — which is why "Removed" is the
> accurate label.

**Targets:** the right column heading + header readout on every explorer state.
**Design frames to refresh:** 28-163, 30-15994, 30-15995, 30-15997, 30-15999, 30-16001 (and the corpus-drawer frames 28-297 / 28-319).
**Also fix while here:** frame 30-15997 shows "conserved 8%" — a slip; conserved is always 100.0%.

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

## Backlog — flesh out after Batch 1 calibration

These are scoped but not yet written as full prompts; promote them once Batch 1
shows the results are usable. (Ask and I'll expand any into a full prompt.)

- **4-step interactive primer (largest item).** Replaces the current single-card
  primer (frame 28-80). Four steps, each fading in:
  1. Definition: "surprisal = how much a word surprises a predictor" (coral
     "surprisal") + "predictable words carry little information, surprising words
     carry a lot".
  2. Same sentence annotated with per-word surprisal superscripts
     (how³ much⁵ a¹ word⁸ surprises¹² a¹ predictor²⁰; "predictor" coral) + caption
     "the small number is each word's surprisal, its cost to a predictor".
  3. The sentence + a small threshold slider (stops 0, 2, 4, 7, 15); raising the
     threshold fades/contracts words below it until only "predictor" remains.
     "Next" is disabled until the slider moves.
  4. The lone coral "predictor" + "the higher the surprisal, the more lossy the
     prediction" + a "predict the uncompressed text" button that reveals
     "how often a word fools a predictor" (predicted words in white; "predictor"
     coral) with an **Actual** = "how much a word surprises a" and **Fidelity** =
     0.68 readout. "Done" is disabled until predict is clicked.
  Likely worth splitting into 2–3 Figma Make prompts.
- **Prose fade-in at UNCOMPRESSED.** When the slider returns to the far-left
  position and the full text is restored, the middle-column text gently fades in.
- **`figma-sources.yaml` follow-up.** Add the new scenario "As a user, I can click
  a removed word to reveal its seam" once frame 3 above exists; until then it's an
  unmapped/TODO entry.
