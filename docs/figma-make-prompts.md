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
- The app is **desktop-only** (min width ~1024px). Clean sans-serif (Geist).
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

---

## Doc follow-ups (not Figma Make prompts)

- Add a **"Loading"** page to the Figma Design file and, once its frames exist, map
  the two Loading stories from [`user-scenarios.md`](./user-scenarios.md) in
  [`figma-sources.yaml`](./figma-sources.yaml) (new `epic: "Loading"`,
  `epic_dir: "loading"`), with the captured keyframe node ids. Use `shot: null`
  until the runtime loading screen exists and the Playwright suite captures
  `runtime/e2e/__screens__/loading/` screenshots.
- The runtime loading screen replaces the null-guard skeleton in
  `runtime/src/components/explorer/ExplorerContainer.tsx`; build it against the
  captured Design frames.
