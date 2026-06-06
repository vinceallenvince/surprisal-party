# User Scenarios
Gherkin-style user scenarios for Surprisal Party.

## Loading

### As a visitor, the loading screen compresses a welcome phrase to its kernel

While the corpus cache loads, the app does not show a spinner — it performs its own mechanic. A welcome phrase, "we threw you a surprisal party", is centered on the dark ground with each word's surprisal value set as a small superscript, and the two highest-surprisal words — "surprisal" and "party" — already in the coral kernel highlight. The loading progress acts as a rising surprisal threshold: as it climbs, the predictable words fall away in ascending order of surprisal, hard-cut from the line so the survivors close up, until only the kernel "surprisal party" remains — the irreducible phrase the loader was always heading toward. Timing is floored so the mechanic always reads even on a fast connection: the full phrase holds briefly before the collapse begins, and the kernel holds briefly after the cache has loaded before the screen fades away. The collapse never throttles the actual fetch; if the cache is still loading when the words run out, the screen simply rests on the kernel until it arrives. The progress is never shown as a number or a bar — the collapsing phrase is the only indicator.

```gherkin
Given I am a first-time visitor and the corpus cache has not finished loading
When the application starts to load
Then the explorer is not yet shown
And a welcome phrase "we threw you a surprisal party" is centered on the dark ground
And each word carries its surprisal value as a small superscript: we² threw⁷ you³ a¹ surprisal²⁰ party¹⁸
And the highest-surprisal words, "surprisal" and "party", are shown in the coral kernel highlight
And no spinner, percentage, or progress bar is shown
And the full phrase holds for a short minimum time before anything collapses
When loading progresses
Then the surprisal threshold rises and the words below it are hard-cut from the line in ascending order of surprisal — first "a", then "we", then "you", then "threw"
And the surviving words close up and re-center after each removal
And if the cache is still loading when only the kernel remains, the phrase rests on "surprisal party" until it finishes
When the cache has finished loading
Then the superscript values fade away, leaving a clean coral "surprisal party"
And the kernel holds for a short minimum time
And the loading screen then fades out and the onboarding primer is shown over the explorer
```

### As a returning visitor, the loading screen is brief

A visitor who has already seen the primer does not need the full ceremony. The same phrase-to-kernel compression plays, but abbreviated — a shorter opening hold, quicker removals, and a shorter kernel hold — and on completion the screen fades straight into the explorer rather than the primer. The same localStorage record that suppresses the primer for a returning visitor selects this abbreviated loader. A reduced-motion preference replaces the staged collapse with a simple crossfade to the kernel.

```gherkin
Given I have previously seen and dismissed the primer
When the application loads
Then the same welcome phrase compresses to its "surprisal party" kernel, but with a shorter collapse and shorter holds
And when loading finishes the screen fades directly into the explorer with the default corpus loaded
And the onboarding primer is not shown
And if I have requested reduced motion, the staged collapse is replaced by a simple crossfade to the coral "surprisal party" kernel
```

## Onboarding

### As a first-time visitor, I am shown a one-time primer on surprisal

On a visitor's first load, a large modal gates the explorer with a short, four-step primer that teaches both halves of the mechanic on the primer's own definition sentence. The first step defines *surprisal*, the second annotates the sentence with each word's surprisal, and the third hands the visitor a small threshold slider so they raise the threshold themselves and watch the predictable words fall away until only the kernel survives. The fourth step runs it in reverse: from the lone surviving kernel a "predict" button reconstructs the sentence — lossily — showing the predicted words beside the actual text and a fidelity score below 1.0. The visitor must move the slider (step three) and trigger the prediction (step four) before they can finish. Each step's content fades in as they advance, and the explorer behind the scrim cannot be touched until the modal is dismissed (via "Done" on the last step, or Esc / a scrim click from any step).

```gherkin
Given I am a first-time visitor with no record of having seen the primer
When the application loads
Then a large modal appears centered over the explorer, which is dimmed behind a scrim
And the explorer behind it cannot be interacted with until the modal is dismissed
And the first step defines the term: "surprisal = how much a word surprises a predictor", with the line "predictable words carry little information, surprising words carry a lot"
When I advance to the second step
Then the same sentence is shown with each word's surprisal value, and the highest-surprisal word ("predictor") is marked as the kernel in coral
When I advance to the third step
Then a threshold slider appears beneath the sentence, marked with its threshold stops
And I cannot advance until I move the slider
When I raise the threshold with the slider
Then words below the threshold fade out and the sentence contracts, until at the highest threshold only the kernel word "predictor" remains
When I advance to the fourth step
Then the lone kernel word "predictor" is shown, with a "predict the uncompressed text" button
And the "Done" button is disabled until I trigger the prediction
When I click the predict button
Then the removed words are reconstructed inline as a lossy prediction, shown beside the actual text and a fidelity score below 1.0
And the "Done" button becomes enabled
When I dismiss the modal
Then it closes and the application records that the primer has been seen
And I land in the explorer, which shows three regions: a header, a middle column, and a right strip
And the default corpus is loaded in the middle column with its kernel tokens highlighted
And the slider is at UNCOMPRESSED and the corpus drawer is collapsed
And the right strip is empty
And the header reads "stored 100.0% · removed 0.0% · avg fidelity —" (no words removed yet, so there is nothing to score)
And a small, dim corpus-picker icon sits at the top-left of the content row
```

### As a returning visitor, I am not shown the primer again

Once the primer has been seen it never reappears on its own. A returning visitor lands directly in the explorer, and can re-summon the primer from a small info icon to the right of the corpus title in the header if they want it.

```gherkin
Given I have previously seen and dismissed the primer
When the application loads
Then no modal is shown
And I land directly in the explorer with the default corpus loaded
And a small info icon sits to the right of the corpus title in the header
When I click the info icon
Then the primer modal reappears at its first step
And working through it again, or dismissing it, returns me to the explorer unchanged
```

### As a user, I can learn what the header metrics mean

The header readout — stored / removed / avg fidelity — has a small info icon immediately to its left. Clicking it opens a brief explainer modal, styled like the onboarding primer, that defines each of the three metrics for anyone who wants to know exactly what the numbers mean.

```gherkin
Given I am in the explorer view
When I click the info icon immediately to the left of the header metrics
Then a modal opens centered over the explorer, which is dimmed behind a scrim
And it lists the three metrics — stored, removed, and avg fidelity — each with a concise definition
When I dismiss the modal via its "Close" button, the scrim, or Esc
Then the modal closes and I return to the explorer unchanged
```

## Corpus Selection

### As a user, I can open the corpus picker to switch corpora

Switching between corpora is handled by a collapsed-by-default left-edge drawer summoned by the corpus-picker icon. The drawer slides in as an overlay with a scrim; the middle column does not reflow behind it.

```gherkin
Given I am in the explorer view
When I click the corpus-picker icon
Then a panel slides in from the left edge as an overlay, headed "CORPORA"
And a subtle scrim dims the prose behind it without removing it
And the middle column does not reflow
And I see a vertical list of corpora, each with a title and a small meta line
And the currently-loaded corpus is marked
And a quiet "About" link sits at the bottom of the drawer, below a divider and separated from the corpus list
When I click the scrim or press Esc
Then the drawer collapses and the explorer is unobscured
```

### As a user, selecting a corpus loads it fresh

Choosing a corpus fetches its precomputed static cache — surprisal scores, span boundaries, reconstructions, and fidelity scores generated offline at build time — and resets the explorer view. Everything on screen is rendered from that cache.

```gherkin
Given the corpus picker is open
When I select a corpus from the list
Then the application fetches the precomputed static cache for that corpus
And the drawer collapses
And the slider snaps back to the far left (UNCOMPRESSED)
And the middle column displays the full source text of the corpus
And the kernel tokens are highlighted within the text
And the right strip is empty
And the header resets to "stored 100.0% · removed 0.0% · avg fidelity —"
```

### As a user, I can read more about the project from the drawer

The About link at the bottom of the drawer opens a modal with a deeper, opt-in account of the project and a link out to the author's site. It is a modal, like the onboarding primer, but with room for more copy.

```gherkin
Given the corpus picker is open
When I click the "About" link at the bottom of the drawer
Then a modal opens centered over the explorer, which is dimmed behind a scrim
And the modal describes what the project is and why it exists
And the modal contains a link to the author's personal site for the detailed write-up
And that link shows its destination and opens in a new browser tab
When I dismiss the modal via its button, the scrim, or Esc
Then the modal closes and I return to the drawer
```

## Compression and Reconstruction

### As a user, I can compress the corpus by dragging the slider rightward

Dragging the slider rightward raises a surprisal threshold. Tokens below the threshold leave the middle column and migrate as word tiles to the right "Removed" strip, where they pack into a growing mass. In the middle column, removed spans collapse out of view; their position is marked only by a thin seam between the surviving tokens on either side. A seam shows no text by default.

```gherkin
Given I have a corpus loaded in the explorer view
And the slider is at the far left
When I drag the slider rightward
Then the surprisal threshold rises
And tokens below the threshold leave the middle column
And those tokens migrate as fixed-width word tiles into the right strip
And the right strip's tiles pack together as a dense mass
And the middle column visibly shrinks as removed spans collapse out of view
And each collapsed span is marked by a thin seam between the surviving tokens on either side
And each seam shows no text by default
And the kernel tokens remain highlighted and on the page
And the header updates so that stored falls, removed rises, and the avg-fidelity score falls (the freshly-removed words are harder to predict)
```

### As a user, I can decompress the corpus by dragging the slider leftward

Dragging the slider leftward lowers the surprisal threshold. Word tiles return from the right strip to their original positions in the middle column, and seams disappear as their underlying source text reappears between the surrounding survivors.

```gherkin
Given the slider is at some position other than the far left
When I drag the slider leftward
Then the surprisal threshold lowers
And word tiles migrate from the right strip back into the middle column at their original positions
And seams disappear as their underlying source tokens reappear
And the middle column visibly expands
And the header updates so that stored rises, removed falls, and the avg-fidelity score rises (only the most predictable words remain removed)
```

### As a user, I can walk through the seams with the arrow keys

The arrow keys are the way to step through the corpus's gaps. They drive a single shared "active seam" state, moving through the seams in story order: the active seam expands the model's predicted text inline (dimmed, in the reading type) and fills the fixed reconstruction inspector at the bottom of the middle column with the actual source text and fidelity score; advancing collapses the previous seam and opens the next. The inspector's height is always reserved so nothing reflows. As the active seam moves, the removed words it covers are highlighted in the right "Removed" strip, so the connection between a gap and the words pulled from it is visible. Reveals in the middle column are keyboard-driven; the right strip's tiles are a separate, explicitly clickable affordance (see below). The slider is mouse-only. Each step plays a short, soft click sound so stepping through the predicted words feels tactile, respecting the user's reduced-motion / sound preferences.

```gherkin
Given the middle column contains one or more seams
And no seam is currently active
When I press the Right arrow key
Then the first seam becomes active, expanding its predicted text inline and filling the inspector with actual text and fidelity
And a short "advance" click sound plays
When I press the Right arrow key again
Then the previous seam collapses and the next seam in story order becomes active
And the "advance" click sound plays again
When I press the Left arrow key
Then the current seam collapses and the previous seam in story order becomes active
And a distinct "back" click sound plays
And pressing Left on the first seam or Right on the last seam does nothing (no wrap-around) and plays no sound
And when the active seam is not comfortably in view the middle column auto-scrolls smoothly to bring it into view
And the removed words belonging to the active seam are highlighted in the right strip
And no click sound plays when there is no seam to move to, or when the user has opted out of UI sounds
When I press Esc
Then the active seam clears
And the right strip's highlight clears
```

> Audio assets: the click sounds live at `runtime/public/audio/click1.mp3` (advance) and `runtime/public/audio/click2.mp3` (back), served statically and preloaded so the feedback is instant.

### As a user, I can click a removed word to reveal its seam

The right strip is linked to the seams the other way too: each removed-word tile is clickable, and clicking it activates the seam that word belongs to — the same shared "active seam" the arrow keys drive. The tiles are the *actual* removed words (the ground truth); the model's *prediction* for that gap is what the activated seam reveals in the middle column. Hovering a tile gives a quiet rollover (its text brightens) so it reads as interactive.

```gherkin
Given I have compressed the corpus so the right strip holds removed-word tiles
When I hover over a tile
Then the tile's text brightens to signal it is interactive
When I click a tile
Then the seam that removed word belongs to becomes the active seam
And that seam expands its predicted text inline and fills the reconstruction inspector
And if the seam is not comfortably in view the middle column auto-scrolls to bring it into view
And the tiles belonging to that seam are highlighted
And from there the arrow keys continue the walk from that seam
```

### As a user, I am nudged to discover the arrow-key walk

The arrow-key affordance is not obvious, so the first time the slider moves past UNCOMPRESSED a small, quiet hint appears above the first seam. It is a nudge, not a tutorial, and it gets out of the way as soon as the user engages.

```gherkin
Given the slider is at the far left (UNCOMPRESSED)
When I move the slider to any position past UNCOMPRESSED for the first time this session
Then a small hint bubble appears hovering just above the first seam with concise copy like "Use arrow keys"
When I press an arrow key, press Esc, or after a few seconds elapse
Then the hint dismisses
And the hint does not reappear once I have stepped through a seam this session
```

### As a user, I can see prediction fidelity fall as I compress

As the slider moves rightward the removed words get harder to rebuild: near the left their reconstructions are essentially verbatim, and toward the right they become looser paraphrases. The header's avg-fidelity readout tracks this continuously, and activating any seam replaces the inspector's placeholder prompt with that gap's actual source words and its fidelity score.

```gherkin
Given the slider is near the left
Then the header's avg fidelity stays high (near 1.00)
When I activate a seam
Then the inspector's placeholder prompt is replaced by the gap's actual words and a fidelity score close to 1.00
And the seam's predicted text reads as near-verbatim

Given the slider is dragged well toward the right
Then the header's avg fidelity drops well below 1.00
And the seams cover larger spans relative to the surviving tokens
When I activate a seam
Then the inspector's placeholder prompt is replaced by the gap's actual words and a fidelity score below 1.00
And the seam's predicted text reads as a paraphrase
```

### As a user, I can compress the corpus to its kernel

At the slider's far-right position, only the kernel tokens — the highest-surprisal, load-bearing words — remain in the middle column. The seams between them hide the model's retelling of the whole corpus, generated from the kernel alone. The user activates a seam to reveal it.

```gherkin
Given I drag the slider to the far-right position
Then only the kernel tokens remain visible in the middle column
And the right strip contains the maximum density of migrated word tiles
And the header shows the maximum removed percentage and the lowest avg-fidelity score (the reconstructions are at their most lossy)

When I activate a seam between kernel tokens
Then its predicted text expands inline to show the model's reconstruction of the corpus from the kernel alone
And the inspector shows the actual source text and the fidelity score
```
