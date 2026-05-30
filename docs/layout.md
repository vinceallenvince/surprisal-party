# Homepage Layout Brief

A self-contained brief for an AI design tool (v0, Figma Make, Cursor design mode, etc.) to generate a prototype layout for the Compression-Prediction Explorer's homepage. Paste the relevant sections into your design tool of choice.

---

## What the app does

The **Compression-Prediction Explorer** is an interactive demonstration that compression and prediction are the same thing. The user reads a familiar fairy tale (Little Red Riding Hood, Hansel and Gretel, etc.) and drags a single slider. As the slider moves to the right, the predictable words of the story fade out and migrate to a side panel; the words that survive are the ones a predictor could not have guessed. By the time the slider reaches the far right, only a handful of "kernel" words remain — the irreducible information of the story.

The user is meant to *feel* the equivalence with their hand, not read about it. There is no tutorial, no copy explaining the mechanic. The slider is the argument.

Audience: design-fluent adults reading a familiar story. The project is exploratory and atmospheric — closer to a digital essay than a productivity tool.

---

## Homepage — three-region layout

The homepage is a single page. No nav, no footer, no marketing chrome. The whole viewport is occupied by three horizontally-arranged regions, plus a thin header and a slider control at the bottom.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HEADER                                                                  │
│  Tale title (small) · stored 100% · predicted 0% · conserved 100%        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                       ┌──┤
│                                                                       │  │
│                  MIDDLE COLUMN — the tale text                        │ R│
│                                                                       │ I│
│  Once upon a time there was a dear little girl who was loved by       │ G│
│  everyone who looked at her, but most of all by her grandmother...    │ H│
│                                                                       │ T│
│  Surviving words appear in body type. Removed-and-collapsed spans     │  │
│  are marked by a small inline "seam" affordance (a thin dot, a tiny   │ S│
│  vertical hair) between adjacent surviving words. Kernel words —      │ T│
│  the highest-surprisal load-bearing words — are visually highlighted  │ R│
│  in a warm accent color from position 0 onward.                       │ I│
│                                                                       │ P│
│                                                                       │  │
│                                                                       │  │
├──────────────────────────────────────────────────────────────────────────┤
│  [───────────●──────────────────────────────────]                        │
│  SLIDER (5 fixed positions, slightly notched track)                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Header (thin, ~48–64 px)

A horizontal strip at the top with three pieces of information, evenly weighted:

- Tale title on the far left, small and quiet (e.g. "Little Red Riding Hood").
- A center group showing the running readout — **`stored X%`**, **`predicted Y%`**, **`conserved 100%`**. These three numbers are the project's anti-magic guarantee: the total never changes; stored falls and predicted rises as the slider moves.
- A small theme/info control on the far right (optional — secondary).

### Middle column (the body)

The body of the tale, rendered as continuous prose. Width should be comfortably readable (~65–75 characters). This is where the user spends their attention. Three things happen visually in this region as the slider changes:

1. **Words that survive a position stay in body type**, reading naturally.
2. **Removed words "collapse"** — the prose closes up around them and a thin **seam** marks where the gap was. A seam is *not* an inline card; it's a small affordance (dot, short vertical hair, faint underline-of-nothing) inviting the user to hover.
3. **Kernel words are highlighted in a warm accent** (amber / soft orange / muted gold) from the very first frame. Their highlight intensifies subtly as the slider deepens, but they're visible from position 0 so the user can see the backbone of the story before they begin compressing.

When a user hovers a seam, a small **reconstruction card** opens in place inline. It shows three lines of content: the model's predicted text, the actual text, and a fidelity score (a number 0.00–1.00). On click the card locks open until clicked again.

### Right strip (~120–180 px wide, vertical)

A separated panel along the right side. This is the **conservation visualization** — it holds the migrated word tiles.

- Rendered in **fixed-width font** (Geist Mono or similar). The aesthetic should feel like data: tight grid, slight luminance shift from the body.
- As words leave the middle column they appear here as small tile-shaped blocks, packed tightly. The mass grows visibly as the slider moves right.
- This region is **not meant to be read word-by-word**. It's meant to be perceived as bulk — "this much text has migrated."

### Slider (full width, ~64–80 px tall)

A single horizontal control along the bottom. Five fixed positions marked by faint notches on the track. The thumb is generous and clearly draggable. Optionally, the track itself can show a faint gradient or label hinting at the two regimes — *lossless* on the left half, *lossy* on the right half — though words are not necessary; a hue or weight shift is enough.

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

**Plus one interaction state**, designed once over any of the above:

### State 6 — Seam expanded
A user has hovered or clicked a seam. A small **reconstruction card** is open inline within the middle column. The card shows:

- The model's **predicted** text for the missing span (one or two lines)
- The **actual** text from the source (one or two lines)
- A **fidelity** score (small, right-aligned, e.g. `0.83`)

The card is unobtrusive — bordered or background-tinted, no shadows that float it dramatically above the page. It expands the line; surrounding prose flows around it.

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
- **Seams:** dim accent — a thin punctuation-like dot in a slightly lighter shade than body, or a hairline rule.
- **Right strip tiles:** body-text color but at lower opacity (faded), reinforcing "this is no longer being read."
- **Slider track and thumb:** quiet greys with a subtle accent on the thumb so it stays findable.

### Responsiveness — important constraint
- **Target desktop and tablet only.** Minimum supported width ~1024 px.
- **The layout does NOT need to work on phones.** Below ~1024 px, showing a static message "best viewed on a desktop" is acceptable.
- Above 1024 px, the layout should scale gracefully up to ultra-wide displays. The middle column has a maximum text width (~75ch); extra horizontal space is absorbed by the side strip and by margins.

### Motion (for the prototype, just suggest)
- When the slider moves, words **migrate** from middle to right strip with a smooth motion (think drift, not vanish-and-pop). The eye should be able to track a word leaving.
- When a seam expands, the inline card opens with a small height transition.
- No bouncy or playful easing. The vibe is calm, almost contemplative.

---

## Sample text content (use this to populate the design)

Use this fragment from *Little Red Riding Hood* (Grimm) for the body. Words shown in **bold** are kernel words and should be in the accent color.

> Once upon a time there was a dear little girl who was loved by everyone who looked at her, but most of all by her **grandmother**, and there was nothing that she would not have given to the child. Once she gave her a little cap of **red** velvet, which suited her so well that she would never wear anything else; so she was always called Little Red-Cap.

For the right strip's migrated tiles at state 4, populate with around 50–80 small word-shaped blocks: short common words (`the`, `and`, `was`, `a`, `who`, `that`, `she`, `her`, etc.) packed tightly in a grid.

For the seam-expanded card content (state 6), use this example:

- **Predicted:** "had a kind mother who"
- **Actual:** "was loved by everyone who"
- **Fidelity:** `0.31`

---

## What I don't need from the prototype

- Tale-selection screen (a separate, low-priority surface).
- About / how-it-works / explainer pages — the mechanic is the argument; copy is anti-pattern.
- Auth, accounts, settings, sharing.
- Loading states beyond a basic skeleton (the JSON is static and tiny).
- Animation polish or micro-interactions beyond the broad strokes called out above.

The goal is to see how the **three-region layout breathes across the five compression states**, and how the **seam-expanded card** sits inside the middle column. Everything else can come later.
