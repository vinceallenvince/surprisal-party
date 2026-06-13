# Figma Make prompts — new screens

A versioned set of **Figma Make prompts** for building screens that are **new**
to the Design file (designed ahead of the runtime), as opposed to
[`figma-make-realignment-prompts.md`](./figma-make-realignment-prompts.md),
which drags *stale* frames back into line with a runtime that moved ahead.

The source of truth for these prompts is [`user-scenarios.md`](./user-scenarios.md);
each prompt translates a scenario into instructions Figma Make can act on without
our codebase context. We build the visuals in the **Figma Make** prototype first,
then copy the resulting elements into the Figma **Design** file as frames and map
them in [`figma-sources.yaml`](./figma-sources.yaml). The Design frames then guide
the runtime implementation.

## Workflow

1. Open the Figma Make prototype.
2. Paste **one** prompt below into Figma Make and let it edit the prototype.
3. Check the result against the prompt's **Acceptance** list.
4. Once a screen looks right, capture the called-out keyframe states and paste them
   into the Figma **Design** file as new frames under the screen's page; record
   their node ids in [`figma-sources.yaml`](./figma-sources.yaml).
5. Tick the prompt's checkbox here.

Run the prompts in order — they build on each other, starting with a low-risk
static frame to calibrate how Figma Make handles this screen's look before adding
animation.

## Conventions (state these to Figma Make as needed)

- **Coral accent ("kernel"):** `#ff6b6b` — the kernel / surviving high-surprisal
  words. **Ground:** dark, near-black background. **Prose text:** near-white.
  **Muted/faint:** dim greys for secondary text and superscripts.
- **Viewport:** the desktop/tablet experience is the default (min width ~1024px);
  a **mobile** view-only variant targets a single-handset width (~390px) — see the
  **Mobile** section below. Each prompt states the width it targets. Clean
  sans-serif (Geist).
- **Superscript surprisal treatment:** a small, dim number trailing each word —
  the same footnote-marker styling used in the onboarding primer's step 2
  (`how³ much⁵ a¹ word⁸ surprises¹² a¹ predictor²⁰`).

---

## Loading

The loading screen replaces the bare "Loading corpus…" skeleton shown while the
selected corpus's (>1 MB) JSON cache fetches. Instead of a spinner it **performs
the app's own compression mechanic** on a welcome phrase, collapsing it to its
kernel as the load progresses. See the **Loading** scenarios in
[`user-scenarios.md`](./user-scenarios.md).

The phrase and its hand-authored surprisal values (highest two are the kernel):

| Word | `we` | `threw` | `you` | `a` | `surprisal` | `party` |
|---|---|---|---|---|---|---|
| Surprisal | 2 | 7 | 3 | 1 | **20** | **18** |

- **Kernel (coral):** `surprisal`, `party`.
- **Removal order** as the threshold rises (ascending surprisal): `a` → `we` →
  `you` → `threw`, leaving `surprisal party`.

### [ ] L1. Loading screen — the static look (calibration)

> Build a full-screen **loading screen** for a desktop web app (min width
> ~1024px). Use a dark, near-black background ("ground"). There is **no header,
> no buttons, no spinner, no progress bar, and no percentage** — just one line of
> text, centered both horizontally and vertically.
>
> The line is the phrase **"we threw you a surprisal party"**. After each word,
> set its **surprisal value** as a small **superscript** number — dimmer and about
> half-size, raised like a footnote marker — giving:
> **we² threw⁷ you³ a¹ surprisal²⁰ party¹⁸**.
>
> Render the two highest-surprisal words — **"surprisal"** and **"party"** — in the
> coral accent **#ff6b6b** (they are the "kernel"). The other four words are
> near-white; every superscript number is a dim grey. Use a clean sans-serif
> (Geist or similar) at a large reading size (~28–32px), with the superscripts
> smaller and raised.
>
> This is a static frame for now — just get the background, color, centering, type,
> and superscript treatment right.
>
> Add a **dev-mode keyboard shortcut** to (re)trigger the loading screen on demand:
> pressing **Shift + Cmd + L** (Shift + Ctrl + L on Windows) shows the loading
> screen from its initial full-phrase state, on top of whatever is currently
> displayed. This is so the screen can be replayed for review without reloading the
> prototype; later prompts' animation should replay from this trigger too.

**Acceptance:** centered phrase on dark ground; `surprisal` + `party` coral, others
near-white; each word trailed by its dim superscript value; no spinner / bar / %;
**Shift + Cmd + L** shows the loading screen from its initial state.
**Capture as Design frame:** the full-phrase state ("loading-full").

### [ ] L2. Loading screen — staged collapse driven by a simulated load

> Animate the loading screen so it **compresses the phrase to its kernel** as a
> simulated load runs. Treat a load-progress value (0 → 100%) as a rising
> **surprisal threshold**: a word survives only while its surprisal value is at or
> above the threshold.
>
> **Simulate the load:** start a progress value at 0 and advance it to 100% over
> about **3 seconds** (this stands in for fetching a file). Drive the threshold
> from that progress.
>
> **Choreography** (with minimum timings so the effect always reads):
> 1. **Hold** the full phrase **we² threw⁷ you³ a¹ surprisal²⁰ party¹⁸** for ~**2
>    seconds** before anything changes.
> 2. As the threshold rises, **remove the words below it one at a time, in
>    ascending order of surprisal: first "a"¹, then "we"², then "you"³, then
>    "threw"⁷.** Each removal is a **hard cut** — the word *and its superscript*
>    disappear instantly, with **no fade** — and the surviving words immediately
>    **close up and re-center**. Space the removals about **0.4–0.5s** apart.
> 3. End on the kernel **surprisal²⁰ party¹⁸**, still centered and still coral.
>
> Keep the phrase centered on both axes throughout. Do not throttle or pause the
> simulated progress; if it completes before the removals finish, just let the
> remaining removals play out and rest on the kernel.

**Acceptance:** full phrase holds ~2s; words vanish (with superscripts) by hard cut
in order `a, we, you, threw`; survivors re-center each time; ends on coral
`surprisal²⁰ party¹⁸`; phrase stays centered.
**Capture as Design frame:** a mid-collapse state (e.g. after `a` and `we` are gone:
`threw⁷ you³ surprisal²⁰ party¹⁸`) and the kernel-with-superscripts state
("loading-collapse", "loading-kernel").

### [ ] L3. Loading screen — completion handoff, returning-visitor variant, reduced motion

> Finish the loading sequence and add its two completion paths.
>
> **Post-load (first visit):** once only the kernel **surprisal²⁰ party¹⁸** remains
> and the simulated load has completed, **fade out the superscript numbers** (over
> ~300ms). Then **collapse the two words together** to reclaim the horizontal space
> the superscript numbers left behind — `surprisal` and `party` slide closer so the
> spacing reads as a normal two-word phrase — leaving a clean, centered coral
> **"surprisal party"**. **Hold** that for ~**2 seconds**, then **fade the whole
> screen out** (~400ms) to reveal a placeholder app screen behind it (a plain dark
> frame is a fine handoff target).
>
> **Returning visitor (abbreviated):** add a variant that plays the same
> phrase-to-kernel compression but **faster** — a shorter opening hold (~0.5s),
> quicker removals, and a shorter kernel hold — then fades straight to the
> placeholder app screen.
>
> **Reduced motion:** if the user's system prefers reduced motion, replace the
> staged collapse entirely with a single **crossfade** from the full phrase directly
> to the clean coral **"surprisal party"** kernel.

**Acceptance:** superscripts fade, then the two words collapse together to reclaim
the space, leaving a clean centered coral `surprisal party`; kernel holds ~2s;
screen fades out to a placeholder; an abbreviated variant runs noticeably faster;
reduced-motion path is a plain crossfade to the kernel.
**Capture as Design frame:** the clean coral `surprisal party` kernel
("loading-kernel-clean").

### [ ] L4. Loading screen — mobile responsive

> Make the loading screen **responsive down to a single-handset width** (~390px,
> portrait) without changing its behaviour — the same phrase-to-kernel compression,
> the same removal order, the same completion/abbreviated/reduced-motion paths from
> L1–L3 all still apply. Only the **layout** adapts:
>
> - **Scale the type down** so the phrase is comfortable on a narrow screen
>   (~**18–22px** reading size, with proportionally smaller superscripts), keeping
>   the dark ground, the coral **#ff6b6b** kernel, and the near-white prose.
> - **Allow the phrase to wrap** to two or three lines when it doesn't fit on one;
>   keep the whole block **centered on both axes**, and keep the superscripts
>   attached to their words across the wrap.
> - As words are hard-cut, the survivors still **close up and re-center** — across
>   however many lines remain — so the block re-centers and **reflows toward a single
>   line** as it collapses, ending on a centered coral **"surprisal party"** kernel
>   (which fits on one line).
>
> Nothing else changes: no spinner, bar, or percentage; no header or buttons. This is
> the same screen, just fluid.

**Acceptance:** at ~390px the phrase wraps and stays centered with readable type and
attached superscripts; the collapse still removes `a, we, you, threw` and re-centers
the survivors, reflowing toward one line; ends on a centered coral `surprisal party`;
no spinner / bar / % and no header at any width.
**Capture as Design frames:** the three states at mobile width — the wrapped
full-phrase ("loading-full"), a mid-collapse ("loading-collapse"), and the clean
coral kernel ("loading-kernel-clean").

> **Status:** the three mobile Loading frames already exist in the Design file on
> the **Loading** page (393×852, in a row beneath their desktop counterparts:
> nodes `101-32`, `101-2`, `101-18`) and are mapped in
> [`figma-sources.yaml`](./figma-sources.yaml). They are the formatting reference
> for the other mobile frames: a `ui_mobile:` sibling row, same page, x-aligned
> under each desktop frame, same look at ~390px width.

---

## Doc follow-ups (not Figma Make prompts) — Loading

- Add a **"Loading"** page to the Figma Design file and, once its frames exist, map
  the two Loading stories from [`user-scenarios.md`](./user-scenarios.md) in
  [`figma-sources.yaml`](./figma-sources.yaml) (new `epic: "Loading"`,
  `epic_dir: "loading"`), with the captured keyframe node ids. Use `shot: null`
  until the runtime loading screen exists and the Playwright suite captures
  `runtime/e2e/__screens__/loading/` screenshots.
- The runtime loading screen replaces the null-guard skeleton in
  `runtime/src/components/explorer/ExplorerContainer.tsx`; build it against the
  captured Design frames.

---

## Mobile (view-only explorer)

These prompts build the **mobile** variant of the explorer. The mobile build is a
deliberately **view-only compression** experience — see the **`@mobile`** scenarios
in [`user-scenarios.md`](./user-scenarios.md) and the parallel `ui_mobile` lists in
[`figma-sources.yaml`](./figma-sources.yaml). Relative to desktop, mobile **keeps**
the slider → compress → kernel mechanic and shows seams as plain gap marks, and
**drops**:

- the right "Removed" strip and migrated word-tiles,
- the seam reveal (no predicted text expands inline),
- the reconstruction inspector row,
- the header metrics readout (`stored / removed / avg fidelity`) and its info icon,
- the arrow-key walk and the click-a-removed-word affordance.

The onboarding **primer is unchanged** in content on mobile but reflows to the
narrow width, so it has its **own six mobile frames** (one per step) on the
Onboarding page — already built (nodes `101-64`, `101-114`, `101-166`, `101-268`,
`101-340`, `101-396`) and mapped in [`figma-sources.yaml`](./figma-sources.yaml). It
is not re-prototyped here.

**Note — these frames already exist.** The designer authors a `ui_mobile` frame
wherever the mobile *rendering* differs, even for stories whose *behaviour* is
shared. **All** mobile Design frames are now built and mapped in
[`figma-sources.yaml`](./figma-sources.yaml) — Loading, the Onboarding primer, the
corpus picker / load / About, and the five Compression ↔ Prediction states
(`113-6`, `113-63`, `113-113`, `113-169`, `113-206`). The prompts below (M1–M4) are
therefore kept as the **build spec and reference**, not net-new authoring work; use
them to drive the eventual mobile runtime against the existing frames.

**Mobile conventions (state these to Figma Make):** a **single-handset width**,
~**390 × 844** (iPhone-class), portrait. Same look as the desktop explorer — dark
near-black ground, near-white prose, coral **#ff6b6b** kernel words, clean
sans-serif (Geist) — just reflowed to one narrow column with **no right strip and
no metrics**. If the existing Make prototype already holds the desktop explorer,
**duplicate it and adapt** rather than rebuilding, so type, spacing, and colour
match (paste the desktop explorer in as a visual reference if needed).

Run these in order: a static shell first to calibrate the narrow layout, then the
slider mechanic, then decompression, then the corpus picker.

### [ ] M1. Mobile explorer — static shell, uncompressed (calibration)

> Build a **mobile-width** (~390 × 844, portrait) **view-only** version of the
> text-compression explorer, on a dark near-black ground. Match the look of the
> existing desktop explorer (near-white prose, coral **#ff6b6b** for the highlighted
> "kernel" words, Geist or similar), reflowed into **one narrow column**.
>
> Layout, top to bottom:
> 1. A compact **header row**: a small, dim **corpus-picker icon** at the top-left;
>    the **corpus title** centered or left-aligned beside it; and a small **info
>    icon** to the right of the title (it re-opens the onboarding primer). There is
>    **no metrics readout** — do **not** show "stored / removed / avg fidelity"
>    anywhere.
> 2. The **content column**: the full source prose of a sample corpus (a few short
>    paragraphs of a fairy tale is fine), wrapping naturally to the narrow width,
>    with a handful of **kernel words rendered in coral #ff6b6b** scattered through
>    the text.
> 3. A horizontal **compression slider** pinned at the bottom, full-width with comfy
>    touch padding, its track labelled from **UNCOMPRESSED** (far left) to **MAX**
>    (far right). Start the handle at the far left.
>
> There is **no right-hand strip, no word-tiles area, and no inspector row** — this
> is a single column plus header plus slider. Static frame only (no animation yet);
> just get the narrow reflow, header without metrics, colour, and type right.

**Acceptance:** single narrow column on dark ground; header has corpus-picker icon +
title + info icon and **no metrics**; prose wraps with some coral kernel words; a
full-width touch slider sits at the bottom at UNCOMPRESSED; **no right strip and no
inspector** anywhere.
**Capture as Design frame:** the uncompressed mobile explorer. This is the same
view as Corpus Selection's `load-new-corpora` mobile frame (node `105-60`), which
already exists — no separate onboarding "landing" frame is needed.

### [ ] M2. Mobile explorer — compress by dragging the slider rightward

> Make the bottom slider **touch-draggable**, and wire it to compress the prose
> **in place** as it moves right. Treat the slider position as a rising **surprisal
> threshold**: a word stays only while its surprisal is at or above the threshold.
>
> As the handle moves **rightward**:
> - Words below the threshold **leave the column** and the surviving words **close
>   up**, so the column visibly **shrinks**.
> - Each removed span leaves a **thin seam** — a small, quiet gap marker — between
>   the surviving tokens on either side. A seam **shows no text** and is **not
>   tappable**; nothing expands or reveals on mobile.
> - **Kernel words (coral #ff6b6b) always remain** on the page.
> - At the **far-right** position only the **kernel words** remain, separated by
>   seams.
>
> Removed words do **not** migrate anywhere — there is no strip — they simply
> collapse out. Do **not** add any metrics, fidelity score, predicted text, or
> inspector. The reflow can be instant or a quick crossfade; no elaborate layout
> animation needed.

**Acceptance:** dragging the slider right removes sub-threshold words in place;
column shrinks; thin non-interactive seams mark the gaps; coral kernel words persist;
far-right leaves only kernel words + seams; no tiles / metrics / reveal / inspector
appear at any point.
**Capture as Design frames:** a **light** compression state ("compress-light"), a
**heavy** compression state ("compress-heavy"), and the **far-right kernel-only**
state ("kernel").

### [ ] M3. Mobile explorer — decompress by dragging the slider leftward

> Make the same slider work in **reverse**. As the handle moves **leftward** the
> threshold lowers: **seams reopen** and their underlying **source words reappear**
> in the column between the surrounding survivors, and the **column expands** back
> toward the full prose. Moving fully left restores the complete, uncompressed text.
> No tiles return (there is no strip), and no metrics update (there are none).

**Acceptance:** dragging left reopens seams into their original source words; the
column grows back; full-left restores the complete prose; nothing else (strip,
metrics, inspector) appears.
**Capture as Design frames:** a **partially-compressed** state to step back from
("decompress-before") and the **less-compressed** result after stepping left
("decompress-after").

### [ ] M4. Mobile corpus picker — open and load a corpus fresh

> Add the **corpus picker** to the mobile explorer. Tapping the corpus-picker icon
> opens a panel as an **overlay with a scrim** over the explorer — on this narrow
> width make it a **full-width sheet** (slide in from the left edge or up from the
> bottom), headed **"CORPORA"**. It lists a few corpora, each with a **title** and a
> small **meta line**, with the currently-loaded one **marked**, and a quiet
> **"About"** link at the bottom below a divider. Tapping the scrim closes it.
>
> When a corpus is **selected**: close the sheet, **reset the slider to the far left
> (UNCOMPRESSED)**, and show that corpus's **full source prose** in the single
> column with its **kernel words in coral**. There is **no right strip to empty and
> no metrics to reset** — just the fresh, uncompressed single column.

**Acceptance:** corpus-picker icon opens a full-width "CORPORA" sheet over a scrim
with a marked current corpus and an "About" link; selecting a corpus closes the
sheet, snaps the slider to UNCOMPRESSED, and loads that corpus's full prose with
coral kernel words in the single column; no strip/metrics involved.
**Capture as Design frame:** the freshly-loaded corpus in the mobile explorer
("load-new-corpora").

---

## Doc follow-ups (not Figma Make prompts) — Mobile

- The mobile keyframes map to the epics' **`ui_mobile`** lists in
  [`figma-sources.yaml`](./figma-sources.yaml), and **all node ids are now filled in**
  — Loading (`loading-full`, `loading-collapse`, `loading-kernel-clean`), Onboarding
  primer (the six step shots), Corpus Selection (`open-corpora-menu`,
  `load-new-corpora`, `about-modal`), and Compression ↔ Prediction (`compress-light`,
  `compress-heavy`, `kernel`, `decompress-before`, `decompress-after`). All mobile
  Design frames live on the **same epic pages** as their desktop counterparts. The
  mobile screenshots Layer 1 will capture go to
  `runtime/e2e/__screens__/<epic_dir>/mobile/<shot>.png`.
- These frames are the visual oracle for the eventual **mobile runtime build** and a
  **mobile Playwright project** (a second project in `runtime/playwright.config.ts`
  at the ~390-wide viewport writing into the `mobile/` screenshot subdir). Both are
  follow-on work, not part of this prompt set.
