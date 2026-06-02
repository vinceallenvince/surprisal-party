# User Scenarios
Gherkin-style user scenarios for the Compression-Prediction Explorer.

## Corpus Selection

### As a user, I land in the explorer with a corpus already loaded

The application opens directly into the explorer view with a default corpus loaded — there is no separate landing list to choose from first. The one navigation affordance is a small, dim corpus-picker icon at the top-left of the content row.

```gherkin
Given I navigate to the application
When the application renders
Then the explorer view is shown with three regions: a header, a middle column, and a right strip
And a default corpus is already loaded in the middle column
And the slider is positioned at the far left
And the kernel tokens — the highest-surprisal, load-bearing words — are highlighted within the text
And the right strip is empty
And the header reads "stored 100% · predicted 0% · conserved 100%"
And a small, dim corpus-picker icon sits at the top-left of the content row
```

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
When I click the icon again, click the scrim, or press Esc
Then the drawer collapses and the explorer is unobscured
```

### As a user, selecting a corpus loads it fresh

Choosing a corpus fetches its precomputed static cache — surprisal scores, span boundaries, reconstructions, and fidelity scores generated offline at build time — and resets the explorer view. The runtime makes no language-model calls.

```gherkin
Given the corpus picker is open
When I select a corpus from the list
Then the application fetches the precomputed static cache for that corpus
And the drawer collapses
And the slider snaps back to the far left (UNCOMPRESSED)
And the middle column displays the full source text of the corpus
And the kernel tokens are highlighted within the text
And the right strip is empty
And the header resets to "stored 100% · predicted 0% · conserved 100%"
```

## Compression and Reconstruction

### As a user, I can compress the corpus by dragging the slider rightward

Dragging the slider rightward raises a surprisal threshold. Tokens below the threshold leave the middle column and migrate as word tiles to the right strip, where they pack into a growing mass. In the middle column, removed spans collapse out of view; their position is marked only by a thin seam between the surviving tokens on either side. A seam shows no text by default.

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
And the header updates so that stored falls, predicted rises, and the conserved total stays at 100%
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
And the header updates so that stored rises, predicted falls, and the conserved total stays at 100%
```

### As a user, I can peek at a reconstruction by hovering a seam

A seam hides the model's reconstruction of the span removed at that position. There is no floating card. Hovering a seam does two things at once: the predicted text expands inline at the seam, and a fixed reconstruction inspector at the bottom of the middle column fills with the actual source text and the fidelity score.

```gherkin
Given the middle column contains one or more seams
When I hover a seam
Then the seam expands in place to show the model's predicted text for the removed span, inline in dim monospace
And the fixed reconstruction inspector at the bottom of the middle column shows the actual source text and the fidelity score
And the inspector's reserved height means no surrounding content reflows
When I move the cursor off the seam
Then the inline predicted text collapses back to a seam
And the inspector clears
```

### As a user, I can pin a reconstruction open to keep inspecting it

So the user can read a reconstruction without holding the cursor in place, clicking a seam pins its reveal — the inline predicted text and the inspector contents stay in place until unpinned. Pinning is single: activating another seam (by hover, click, or arrow key) replaces what is shown rather than stacking multiple reveals.

```gherkin
Given a seam is expanded under my cursor
When I click the seam
Then the inline predicted text and the inspector contents stay in place after I move my cursor away
When I activate another seam
Then the new seam's reveal replaces the pinned one rather than stacking alongside it
When I click the pinned seam again or press Esc
Then it collapses back into a seam and the inspector clears
```

### As a user, I can walk through the seams with the arrow keys

Hovering thin seams with the cursor is fiddly, so the primary way to step through the corpus's gaps is the arrow keys. They drive a single shared "active seam" state — the same state hover sets — moving through the seams in story order. The slider is mouse-only, so the arrow keys never conflict with it.

```gherkin
Given the middle column contains one or more seams
And no seam is currently active
When I press the Right arrow key
Then the first seam becomes active, expanding its predicted text inline and filling the inspector with actual text and fidelity
When I press the Right arrow key again
Then the previous seam collapses and the next seam in story order becomes active
When I press the Left arrow key
Then the current seam collapses and the previous seam in story order becomes active
And pressing Left on the first seam or Right on the last seam does nothing (no wrap-around)
And when the active seam is not comfortably in view the middle column auto-scrolls smoothly to bring it into view
When I press Esc
Then the active seam clears
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

### As a user, I see the slider's two regimes reflected in what happens on screen

The slider has a lossless region on the left and a lossy region on the right, conveyed by a subtle track gradient rather than explicit regime labels. In the lossless region, words leave the page but reconstructions are verbatim and information barely moves. In the lossy region, whole clauses fade, reconstructions become paraphrases, and information migrates in bulk.

```gherkin
Given I am dragging the slider through the lossless region
Then the middle column shrinks slightly as predictable words leave
And the header's predicted percentage rises slowly relative to the words removed
And when I activate a seam, the inspector shows a fidelity score close to 1.00

Given I am dragging the slider through the lossy region
Then the middle column shrinks rapidly as whole clauses leave
And the header's predicted percentage rises steeply
And the seams cover larger spans relative to surviving source tokens
And when I activate a seam, the inspector shows a fidelity score below 1.00
```

### As a user, I can compress the corpus to its kernel

At the slider's far-right position, only the kernel tokens — the highest-surprisal, load-bearing words — remain in the middle column. The seams between them hide the model's retelling of the whole corpus, generated from the kernel alone. The user activates a seam to reveal it.

```gherkin
Given I drag the slider to the far-right position
Then only the kernel tokens remain visible in the middle column
And the right strip contains the maximum density of migrated word tiles
And the header shows the maximum predicted percentage and the conserved total remains at 100%

When I activate a seam between kernel tokens
Then its predicted text expands inline to show the model's reconstruction of the corpus from the kernel alone
And the inspector shows the actual source text and the fidelity score
```
