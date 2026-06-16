# Compression-Prediction Explorer

> **Candidate name: _Surprisal Party_** — the leading working title. The pun is deliberate and the tone is ironic: a festive, low-stakes name draped over a heavy information-theoretic core. The contrast *is* the point — it keeps the project from taking itself too seriously, and the calm, contemplative interface deliberately subverts the name rather than matching it. (Possible corpora that lean into the irony: scripts from *Bob's Burgers* episodes alongside the fairy tales — familiar, dialogue-dense text the user can verify by recognition.)

## Overview
The Compression-Prediction Explorer is a text-based interactive demonstration that the equivalence between compression and prediction is not a metaphor but a measurable mechanic. Users explore familiar fairy tales through a single interaction: a slider that fades the predictable words from the story and replaces them, in place, with the predictor's reconstruction of what was removed. The user watches information *move* from the page into the predictor — never destroyed, only relocated — and feels the duality with their own hand.

## Conceptual Framing
The information-theoretic core, made concrete:

- Every token in a story has a measurable **surprisal** under a reference language model — its information content in bits, `−log₂ p(token | context)`.
- The story's total information is the sum of those surprisals, and is fixed for a given story and model.
- A token can be safely removed exactly when a predictor can recover it. Low-surprisal tokens are predictable; high-surprisal tokens are not.

The slider operates on this directly. Dragging right raises a surprisal threshold; tokens below it fade from the page and are replaced by **reconstruction cards** — the model's regeneration of those tokens. The fade and the reconstructions are produced by the *same* model, so they are two readings of one object: what the model finds predictable, and what the model predicts. There is no separate authoring track. The mechanic is the model, in both directions.

Surprisal is context-dependent: information is paid where it is first introduced and is free thereafter. The first appearance of "red" in *Little Red Riding Hood* — when the cap is introduced — is high-surprisal and survives deep compression. The "red" inside the title, one sentence later, is near-zero surprisal and fades almost immediately, because the predictor can recover it from prior context. The slider exposes this structure the moment the user begins to drag.

Fairy tales are the chosen substrate because the user already knows them end to end. When a reconstruction card replaces a removed span, the user can verify it by recognition alone — they do not need to trust the model, they can check it. Familiarity does the de-magic-ing.

## What the User Sees
- **Header** — a running readout: *stored X% · predicted Y% · conserved 100%*. As the slider moves, *stored* falls and *predicted* rises; the total never changes.
- **Middle column** — the story, as a single continuous reading surface. Surviving source tokens appear verbatim and close together; removed spans collapse out of view and are marked only by a thin **seam** between the surviving tokens on either side. Hovering a seam peeks the reconstruction open; clicking locks it open to reveal predicted text, actual text, and fidelity score. Reconstruction cards are therefore opt-in: the middle column visibly *shrinks* as the user compresses, and the user pulls open whichever seams they want to inspect. Kernel tokens — the highest-surprisal, load-bearing words — are highlighted from position 0, so the user sees the backbone of the story before they begin to compress it.
- **Right strip** — the conservation visualization. Faded word tiles physically migrate from the middle column into a fixed-width packed mass on the right. The strip is not meant to be read word-by-word; it is meant to be seen as bulk. Total tiles never change; only their location does.

## Two Regimes of the Slider
- **Lighter region (left).** Predictable function words and short phrases fade. The middle column reads as the story, lightly tightened. Reconstructions are *close paraphrases* rather than verbatim — the model recovers each gap from the surviving context alone, so even here it usually differs from the original by a word or two and fidelity sits well below 1.00. Words leave the page but little information moves: the user is watching redundancy compress.
- **Lossy region (right).** Whole clauses and episodes fade. Reconstructions become looser paraphrases and condensations, the gaps cover larger spans, and fidelity falls further — but the retelling stays recognizable against the source. The predictor is now doing real inferential work, and the conservation readout shows information migrating in bulk.

The handoff between regions is a gradient, visible in the header's avg-fidelity number as it falls, and can be marked on the slider track itself.

> **A note on fidelity expectations.** An earlier draft of this section expected near-verbatim reconstructions (fidelity ≈ 1.00) on the left. Measurement showed otherwise: because reconstruction is done from the *surviving* text only (never peeking at the removed words) and the removed words at low thresholds are tiny function words, the model paraphrases rather than reproduces, so fidelity is well under 1.00 across the whole slider and is highest — not perfect — at the left. This is the honest behavior of the compression↔prediction mechanic, and the number is presented as a measure of loss, not a target to maximize.

## Determinism and Variability
V1 is fully deterministic: every reconstruction the user sees was generated once at build time and is loaded from a static cache at runtime. The runtime makes no language-model calls. Dragging the slider produces identical behavior across users, sessions, and reloads — because the mechanic *is* the argument, and the mechanic must be stable.

Variability can be introduced later without disturbing that stability. Where the gaps appear is fixed; only what fills them can change. The design space has three increasingly capable tiers:

| Tier | Reconstruction source | Latency | Per-user cost | Architecture |
|---|---|---|---|---|
| **A — Fully deterministic** *(v1)* | One cached reconstruction per gap | Instant | None | Static site |
| **B — Cached variants** | 3–5 cached alternatives per gap; one chosen per session or per card-open | Instant | None | Static site |
| **C — Live generation** | Language-model call per card expand | ~500–1000 ms | Yes | Static + thin serverless endpoint |

Tier B is a one-step escalation from A — regenerate the cache with N reconstructions per gap and pick at runtime; the architecture is unchanged. Tier C trades static-site simplicity for the sense of live thinking and is appropriate only if A and B prove too predetermined in use.

## Scope (v1)
- **Corpus:** 10–15 well-known fairy tales in full literary form (Grimm, Andersen, and equivalents), roughly 1,500–3,000 words each, chosen for cross-cultural familiarity.
- **Mechanism:** surprisal scoring, span-level reconstruction, and fidelity scoring are performed once per tale at **build time** by a single reference language model and shipped as a static JSON cache. The runtime fetches that cache when the tale is selected and makes no language-model calls of its own.
- **Interaction:** the slider performs threshold lookup on cached state — fast, deterministic, identical every time.
- **Interface:** header, middle column, right strip, plus a tale-selection screen.

## Out of Scope (For Now)
- **User-supplied text.** The corpus is curated so all scoring and reconstruction can be precomputed; live input is a future capability.
- **Live generation during slider interaction.** Everything the slider reveals is precomputed and cached at selection time.
- **Generalization or implication cards.** Earlier sketches included cards that extrapolated *beyond* the story — morals, generalizations to adjacent domains. These were dropped because they cannot be verified against the source. Every artifact on screen must have a verifiable provenance.
- **Domains beyond fairy tales.** Other substrates (research papers, song lyrics, code) are candidates for future versions but each introduces variation better deferred.
- **External verification.** All fidelity is measured against the source text itself, not against outside evidence.

## Design Principles
- **The mechanic is the argument.** The slider does not explain the compression-prediction equivalence; it performs it. If the app needed an explainer panel saying "notice how compression relates to prediction," the mechanic has failed.
- **One model, both directions.** A single language model scores surprisal (driving the fade) and reconstructs removed spans (filling the cards). The two outputs cannot drift apart because they share a source. This is the anti-magic guarantee.
- **Conservation, not destruction.** Information is never thrown away; it moves from page to predictor. The header readout and the tile migration make this visible.
- **Verifiable by familiarity.** Fairy tales are chosen so the user can check the model's reconstructions by recognition, without needing to trust a metric.
- **Pre-generation over live generation.** All scoring and reconstruction is computed once per tale at build time and shipped as a static cache; the slider only reads cached state in the user's browser. The control must feel physical.
- **Curate tightly before scaling.** A small, well-known corpus is more convincing than a large, unfamiliar one.
