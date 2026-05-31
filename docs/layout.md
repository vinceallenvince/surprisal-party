# Homepage Layout Brief

A self-contained brief for an AI design tool (v0, Figma Make, Cursor design mode, etc.) to generate a prototype layout for the Compression-Prediction Explorer's homepage. Paste the relevant sections into your design tool of choice.

---

## What the app does

The **Compression-Prediction Explorer** is an interactive demonstration that compression and prediction are the same thing. The user reads a familiar text — a fairy tale like Little Red Riding Hood or Hansel and Gretel, or another short corpus — and drags a single slider. As the slider moves to the right, the predictable words of the story fade out and migrate to a side panel; the words that survive are the ones a predictor could not have guessed. By the time the slider reaches the far right, only a handful of "kernel" words remain — the irreducible information of the story.

The user is meant to *feel* the equivalence with their hand, not read about it. There is no tutorial, no copy explaining the mechanic. The slider is the argument.

Audience: design-fluent adults reading a familiar story. The project is exploratory and atmospheric — closer to a digital essay than a productivity tool.

---

## Homepage — three-region layout

The homepage is a single page. No nav, no footer, no marketing chrome. The whole viewport is occupied by three horizontally-arranged regions, plus a thin header and a slider control at the bottom.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HEADER                                                                  │
│  Corpus title (small) · stored 100% · predicted 0% · conserved 100%      │
├──────────────────────────────────────────────────────────────────────────┤
│ ▤                                                                     ┌──┤
│ ↑ corpus-picker icon (top-left; click to expand a left drawer)        │  │
│                  MIDDLE COLUMN — the corpus text                      │ R│
│                                                                       │ I│
│  Once upon a time there was a dear little girl who was loved by       │ G│
│  everyone who looked at her, but most of all by her grandmother...    │ H│
│                                                                       │ T│
│  Surviving words appear in body type. Removed-and-collapsed spans     │  │
│  are marked by a small inline "seam" affordance (a thin dot, a tiny   │ S│
│  vertical hair). Hovering a seam expands the predicted text inline    │ T│
│  and fills the inspector with actual text + fidelity. Kernel words —  │ R│
│  the highest-surprisal load-bearing words — are highlighted in amber. │ I│
│                                                                       │ P│
│                                                                       │  │
│  ACTUAL  was loved by everyone who      FIDELITY 0.31   <- inspector  │  │
├──────────────────────────────────────────────────────────────────────────┤
│  [───────────●──────────────────────────────────]                        │
│  SLIDER (5 fixed positions, slightly notched track)                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Header (thin, ~48–64 px)

A horizontal strip at the top with three pieces of information, evenly weighted:

- Corpus title on the far left, small and quiet (e.g. "Little Red Riding Hood").
- A center group showing the running readout — **`stored X%`**, **`predicted Y%`**, **`conserved 100%`**. These three numbers are the project's anti-magic guarantee: the total never changes; stored falls and predicted rises as the slider moves.
- A small theme/info control on the far right (optional — secondary).

### Middle column (the body)

The body of the corpus, rendered as continuous prose. Width should be comfortably readable (~65–75 characters). This is where the user spends their attention. Three things happen visually in this region as the slider changes:

1. **Words that survive a position stay in body type**, reading naturally.
2. **Removed words "collapse"** — the prose closes up around them and a thin **seam** marks where the gap was. A seam is *not* an inline card and shows no text by default; it's a small dim affordance (dot, short vertical hair, faint underline-of-nothing) between adjacent surviving words, inviting the user to hover. The prose physically shrinks as more spans collapse — that shrink *is* the felt sense of compression.
3. **Kernel words are highlighted in a warm accent** (amber / soft orange / muted gold) from the very first frame. Their highlight intensifies subtly as the slider deepens, but they're visible from position 0 so the user can see the backbone of the story before they begin compressing.

**Seam interaction — inline reveal + fixed inspector (no floating card):**

There is **no floating/inline reconstruction card** — an earlier version popped a card open at the seam, but it occluded the very prose the user was reading. Instead, hovering a seam does two things at once:

- **In place:** the model's **predicted text** for that collapsed span expands inline at the seam (the prose temporarily re-opens to show the guess in dim monospace). This is the only place predicted text appears in the prose; at rest the seam shows no text.
- **In the inspector:** a fixed **reconstruction inspector** (see below) fills in with the **actual** source text and the **fidelity** score (0.00–1.00) for that same span.

Both clear when the pointer leaves the seam. (Optional: clicking a seam *pins* the inspector + inline reveal so the user can read them without holding the hover; clicking again unpins.)

**Keyboard navigation — walk the reconstruction seam-by-seam.** Hovering thin seams with the cursor is fiddly, so the primary way to step through the story's gaps is the **arrow keys**, driving a single shared **"active seam"** state (the same state hover sets — the active seam expands its predicted text inline *and* fills the inspector with actual + fidelity).

- **Right arrow → next seam, Left arrow → previous seam**, one at a time. Advancing collapses the previous seam's reveal and expands the next, so the user reads one reconstructed gap, then the next, in story order.
- **Entry/exit:** from a cold start, the first Right-arrow activates the first seam; **Esc** clears the active seam. **No wrap-around** — Right on the last seam and Left on the first are no-ops.
- **Auto-scroll:** when the active seam isn't comfortably in view, the middle column scrolls smoothly to bring it into view (roughly centered), using the same calm easing as the rest of the motion.
- **Focus ownership (important):** arrow keys drive **seams only while the reading column has focus**. The slider also uses arrow keys (nudge between positions), so when the slider thumb has focus the arrows drive the *slider* instead. Clicking into the column gives it focus; clicking/tabbing to the slider hands arrows back. Scope this deliberately or the two controls will fight over the same keys.
- The active seam carries a quiet but unambiguous **focus indicator** (the expanded predicted text plus a subtle ring/underline) so the user always knows where they are in the walk.

**Reconstruction inspector.** A quiet, fixed, single-line readout living at the **bottom of the middle column** (above the slider), in monospace to match the data aesthetic. Its height is **always reserved** so the layout never jumps. At rest it is empty (or shows a faint hint). On seam hover it shows, on one line: `ACTUAL  <source text>     FIDELITY 0.94` — i.e. the two facts that *aren't* already visible inline (predicted is shown at the seam itself). It never overlaps the prose.

### Right strip (~120–180 px wide, vertical)

A separated panel along the right side. This is the **conservation visualization** — it holds the migrated word tiles.

- Rendered in **fixed-width font** (Geist Mono or similar). The aesthetic should feel like data: tight grid, slight luminance shift from the body.
- As words leave the middle column they appear here as small tile-shaped blocks, packed tightly. The mass grows visibly as the slider moves right.
- This region is **not meant to be read word-by-word**. It's meant to be perceived as bulk — "this much text has migrated."

### Corpus picker (collapsed-by-default left drawer)

The one piece of navigation on the page. Switching between corpora (fairy tales like Little Red Riding Hood and Hansel and Gretel today, other text types later) is handled by a left-edge drawer that is **collapsed by default** — preserving the "no chrome" feel — and summoned by a single small icon.

- **Collapsed state:** a small, dim, library-ish icon (stacked lines / books / grid — *not* a hamburger, which reads as generic app nav) sits at the **top-left of the content row**, in the left margin beside the middle column. It brightens on hover. That icon is the only persistent navigation affordance on the page.
- **Expanded state:** clicking the icon slides a panel in **from the left edge as an overlay**, with a subtle scrim that dims (but does not remove) the prose. The middle column **does not reflow** — the picker floats over it. Panel width ~280–360 px. The panel is headed by a quiet label, **CORPORA**.
- **Panel content:** a quiet vertical list of corpora. Each row is a **title** (body font) plus one small meta line (e.g. word count, or a one-line hook). The currently-loaded corpus is marked (amber title or a small accent dot). No thumbnails — this is a text essay, not a media library.
- **Dismiss:** clicking a corpus, clicking the icon again, clicking the scrim, or pressing Esc all collapse the drawer.
- **Switching resets the view.** Selecting a new corpus loads it fresh: the slider snaps back to UNCOMPRESSED, the header readout returns to `stored 100% / predicted 0% / conserved 100%`, and the right strip empties. Carrying a mid-compression state into a brand-new corpus would be incoherent.

Naming: the user-facing word is **"corpus" / "corpora"** — the app isn't limited to fairy tales (those are just the first corpus type), so the label stays neutral. Individual items may still be described as a "text" or "story" in prose where that reads naturally.

### Slider (full width, ~64–80 px tall)

A single horizontal control along the bottom. Five fixed positions marked by faint notches on the track. The thumb is generous and clearly draggable.

**Label the five positions like this**, in a single row beneath the track:

```
UNCOMPRESSED ........... 25% ........... 50% ........... 75% .......... MAX COMPRESSED
```

The two endpoint labels are the only place on the page where the word *compression* appears — they anchor what the slider does. The percentile notches in the middle describe the granularity of the steps in between. Do not stack a second tier of regime labels (LOSSLESS / LOSSY etc.) below — a single coherent line of labels is cleaner, and the regime change can be conveyed by a subtle gradient on the track (cool hue on the left, warm hue on the right) without needing words.

**Implementation note — one rule for positioning everything.** The thumb, the five notches, and the five labels all line up vertically at 0% / 25% / 50% / 75% / 100%. Use the **same rule** for all of them: position each element absolutely inside a `position: relative` container, set `left` to its percentage, and add `transform: translateX(-50%)` so the element's **center** sits on that percentage.

```css
.thumb, .notch, .label { position: absolute; transform: translateX(-50%); }
/* then set left per element: 0%, 25%, 50%, 75%, 100% */
```

Two things to know:

1. **Do NOT use a native `<input type="range">` thumb, and do NOT use flexbox `space-between` for the labels.** Both align elements by their *edges*, not their centers, so everything except the 50% mark drifts off its notch. Build a custom thumb (a div over a track div) instead.
2. **The 0% and 100% elements will hang half-off the track ends.** That is correct. Add horizontal padding to the container (at least half the thumb's width) so nothing gets clipped.

---

## States to design

For the prototype, generate the page at five states. The same three regions are visible in all of them; only their contents change.

### State 1 — Far left (`stored 100% / predicted 0%`)
Slider thumb at the left end. Middle column shows the full source text, no seams, kernel words highlighted in amber. Right strip is empty (or shows a thin baseline indicating it's ready to receive tiles).

### State 2 — Light compression (`stored ~97% / predicted ~3%`)
Slider thumb 1/4 of the way across. Middle column has shrunk slightly — short seams appear between common words. Right strip has a small handful of tiles packed at the top.

### State 3 — Moderate compression (`stored ~75% / predicted ~25%`)
Slider in the middle. Middle column is visibly shorter; seams are frequent and longer. Kernel words remain bright. Right strip is partially filled — maybe 25% of vertical space.

### State 4 — Deep compression (`stored ~30% / predicted ~70%`)
Slider 3/4 of the way across. Middle column shows mostly seams with kernel words lit between them — feels skeletal. Right strip is densely packed — most of its vertical space is full of tiles.

### State 5 — Kernel only (`stored ~5% / predicted ~95%`)
Slider at the far right. Middle column shows perhaps a dozen lit kernel words separated by seams; you can read it as a constellation, not as prose. Right strip is at maximum density.

**Plus two interaction states**, designed once over any of the above:

### State 6 — Active seam (inline reveal + inspector)
A seam is active — reached either by hovering it *or* by stepping to it with the arrow keys (see "Keyboard navigation" above). Two things happen simultaneously, with **no floating card**:

- **At the seam:** the model's **predicted text** for the collapsed span expands inline (dim monospace), temporarily re-opening the prose at that spot.
- **In the fixed inspector** at the bottom of the middle column: the **actual** source text and the **fidelity** score (e.g. `0.31`) fill in on a single quiet monospace line — `ACTUAL  was loved by everyone who     FIDELITY 0.31`.

Both clear when the pointer leaves the seam. The inspector's height is reserved at all times so nothing reflows. (Optional pinning: a click freezes both reveals until clicked again.)

### State 7 — Corpus picker expanded
A user has clicked the corpus-picker icon. The left drawer is slid in over the content, a subtle scrim dims the prose behind it, and a quiet vertical list of corpora (headed **CORPORA**) is shown — each a title plus a small meta line, with the current corpus marked. The slider, header, and right strip are still visible (dimmed) behind the scrim; the middle column has not reflowed. Show this over State 1 (uncompressed) for clarity.

---

## Visual direction

### Theme
**Dark by default.** No theme toggle visible in v1 (though one can sit in the header for completeness). Background should be deep but not pure black — closer to a near-black warm gray (~`#0d0d0e`) so the warm accent on kernel words feels integrated rather than alarming.

### Typography
- **Middle column body:** a clean variable-width font with strong readability (Geist Sans, Inter, or similar). Comfortable reading size, generous line-height — this is text the user reads.
- **Right strip tiles:** **fixed-width** monospace (Geist Mono, JetBrains Mono, IBM Plex Mono). Tight, gridded, data-feeling.
- **Header:** the same body font but smaller and quieter.

### Color
- **Body text:** soft cream / warm white (`#e8e3d8`-ish), not pure white.
- **Kernel highlight:** warm amber or muted gold (`#e6a851`-ish). Not red. Not yellow. Something that suggests "load-bearing" without screaming.
- **Seams:** dim accent — a thin punctuation-like dot in a slightly lighter shade than body, or a hairline rule. On hover the predicted-text peek appears; the seam itself shows no text by default.
- **Right strip tiles:** body-text color but at lower opacity (faded), reinforcing "this is no longer being read."
- **Slider track and thumb:** quiet greys with a subtle accent on the thumb so it stays findable.

### Responsiveness — important constraint
- **Target desktop and tablet only.** Minimum supported width ~1024 px.
- **The layout does NOT need to work on phones.** Below ~1024 px, showing a static message "best viewed on a desktop" is acceptable.
- Above 1024 px, the layout should scale gracefully up to ultra-wide displays. The middle column has a maximum text width (~75ch); extra horizontal space is absorbed by the side strip and by margins.

### Motion (for the prototype, just suggest)
- When the slider moves, words **migrate** from middle to right strip with a smooth motion (think drift, not vanish-and-pop). The eye should be able to track a word leaving.
- When a seam becomes active (hover or arrow key), the inline predicted text expands with a small height/width transition and the inspector line fades in; both reverse when it deactivates.
- When arrow-key navigation moves the active seam off-screen, the column auto-scrolls smoothly to bring it back into view (roughly centered) — calm, not snappy.
- No bouncy or playful easing. The vibe is calm, almost contemplative.

---

## Sample text content (use this to populate the design)

Use this fragment from *Little Red Riding Hood* (Grimm) for the body. Words shown in **bold** are kernel words and should be in the accent color.

> Once upon a time there was a dear little girl who was loved by everyone who looked at her, but most of all by her **grandmother**, and there was nothing that she would not have given to the child. Once she gave her a little cap of **red** velvet, which suited her so well that she would never wear anything else; so she was always called Little Red-Cap.

For the right strip's migrated tiles at state 4, populate with around 50–80 small word-shaped blocks: short common words (`the`, `and`, `was`, `a`, `who`, `that`, `she`, `her`, etc.) packed tightly in a grid.

For the seam reveal (state 6), use this example — predicted shows inline at the seam, actual + fidelity show in the inspector:

- **Predicted (inline):** "had a kind mother who"
- **Actual (inspector):** "was loved by everyone who"
- **Fidelity:** `0.31`

---

## What I don't need from the prototype

- About / how-it-works / explainer pages — the mechanic is the argument; copy is anti-pattern.
- Auth, accounts, settings, sharing.
- Loading states beyond a basic skeleton (the JSON is static and tiny).
- Animation polish or micro-interactions beyond the broad strokes called out above.

The goal is to see how the **three-region layout breathes across the five compression states**, and how the **seam reveal** (inline predicted text + fixed inspector) reads inside the middle column. Everything else can come later.
