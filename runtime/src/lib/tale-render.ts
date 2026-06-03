/**
 * Pure derivation from a {@link TaleCache} + a slider position into the
 * render-ready data the explorer components consume.
 *
 * Determinism contract (per `runtime/CLAUDE.md`): same cache + same position
 * index in → same output out. No randomness, no time, no reordering — words
 * and gaps are emitted in stable index order.
 *
 * What it produces for one position:
 *   - `proseItems`  — survivor words and seam markers, in source order.
 *     Whitespace: only a real paragraph break (a blank line / `\n\n`) between
 *     two surviving words renders as a break. A single newline is treated as
 *     source line-wrapping and becomes a space, and any separator touching a
 *     removed span collapses to a space — so removed spans close up without
 *     forcing a line break. Past ~50% removed, paragraph breaks are dropped too
 *     (see `keepParagraphs`), so the sparse survivors form a continuous
 *     constellation rather than tall vertical voids.
 *   - `removedTiles` — the words that migrated to the right strip (the union
 *     of this position's `gaps[].word_indices`), in source order.
 *   - `readout` — stored / predicted / conserved percentages for the header.
 *
 * Step 2 renders one fixed position; Step 3 will call this per position.
 */

import type { PositionEntry, TaleCache, WordEntry } from '@/types/tale-cache';

/** A surviving word rendered as inline prose. */
export type ProseWordItem = {
  kind: 'word';
  index: number;
  /** `core + trailing_punct` — equals `source[char_start..char_end]`. */
  text: string;
  /**
   * Separator that follows this word: `'\n\n'` only for a real paragraph
   * break between two survivors; otherwise a single space (single line-wrap
   * newlines and gap-adjacent separators both collapse to a space).
   */
  separator: string;
  /** True when this word is in `kernel_word_indices` (coral highlight). */
  isKernel: boolean;
};

/**
 * A collapsed run, rendered as a single static thin seam between survivors.
 * A run of removed words with no surviving word between them — whether one
 * gap or several adjacent gaps — collapses into ONE seam, so deep compression
 * shows a single pipe rather than `| | |`.
 */
export type ProseSeamItem = {
  kind: 'seam';
  /** Every gap id in this collapsed run, in source order (≥ 1). */
  gapIds: number[];
  /** The model's predicted text for this collapsed run (gaps joined in order). */
  predictedText: string;
  /**
   * The actual source text this run replaced (the gaps' `actual_text` joined in
   * order). Shown in the reconstruction inspector when the seam is active.
   */
  actualText: string;
  /**
   * Reconstruction fidelity for this run, rounded to 2 decimals. For a
   * multi-gap run it is the unweighted average of the constituent gaps'
   * fidelities (each gap is one model reconstruction, so they weigh equally).
   */
  fidelity: number;
  /** Separator that follows the seam — always collapsed (never a newline). */
  separator: string;
};

export type ProseItem = ProseWordItem | ProseSeamItem;

/** A removed word, rendered as a faded mono tile in the right strip. */
export type RemovedTile = {
  index: number;
  /** `core + trailing_punct`. */
  text: string;
  surprisal: number;
};

export type HeaderReadout = {
  /** round(stored_bits / total_bits * 100). */
  storedPct: number;
  /** round(predicted_bits / total_bits * 100). */
  predictedPct: number;
  /** Always 100 — bits are conserved (stored + predicted == total). */
  conservedPct: number;
};

export type RenderedPosition = {
  position: PositionEntry;
  proseItems: ProseItem[];
  removedTiles: RemovedTile[];
  readout: HeaderReadout;
};

function wordText(word: WordEntry): string {
  return word.core + word.trailing_punct;
}

/** The literal source text between this word's end and the next word's start. */
function separatorAfter(
  source: string,
  words: WordEntry[],
  arrayPos: number,
): string {
  const word = words[arrayPos];
  const next = words[arrayPos + 1];
  if (!next) return '';
  return source.slice(word.char_end, next.char_start);
}

/**
 * A blank line in the source — two newlines separated only by horizontal
 * whitespace. This marks a real paragraph break; a *single* newline is just
 * source line-wrapping and is treated as a space.
 */
const PARAGRAPH_BREAK = /\n[^\S\n]*\n/;

/** Empty stays empty (end of text); any non-empty separator becomes a space. */
function spaceUnlessEmpty(sep: string): string {
  return sep === '' ? '' : ' ';
}

/**
 * Separator between two surviving words: a real paragraph break renders as
 * `'\n\n'`; everything else (single line-wrap newline, runs of spaces)
 * collapses to a single space.
 */
function survivorSeparator(sep: string): string {
  return PARAGRAPH_BREAK.test(sep) ? '\n\n' : spaceUnlessEmpty(sep);
}

/** Array position of the next non-empty-core word at or after `from`, or -1. */
function nextRenderableIndex(words: WordEntry[], from: number): number {
  for (let j = from; j < words.length; j++) {
    if (!words[j].is_empty_core) return j;
  }
  return -1;
}

/**
 * Pick the cached position to render in Step 2: the middle entry,
 * `positions[Math.floor(positions.length / 2)]`. For the 5-position LRRH
 * cache this is index 2 — the ~50%-words-removed, threshold≈0.9 state, which
 * matches the "compress rightward" mid-slider frame.
 */
export function midPositionIndex(cache: TaleCache): number {
  return Math.floor(cache.positions.length / 2);
}

/**
 * The thumb percentage (0–100) for a given position index across `stopCount`
 * evenly-spaced stops: position i sits at `i / (stopCount - 1)` of the track.
 * With a single stop the thumb pins to the start.
 */
export function positionToThumbPct(index: number, stopCount: number): number {
  if (stopCount <= 1) return 0;
  return (index / (stopCount - 1)) * 100;
}

/**
 * Snap a pointer position along the track to the nearest discrete stop index.
 *
 * Step 3 commits to discrete state-swap (no free-floating thumb): a click or
 * drag anywhere on the track resolves to the closest of `stopCount` evenly
 * spaced stops. `fraction` is the pointer's position along the track in
 * `[0, 1]` (clamped here, since a drag can run past either end). Returns an
 * index in `[0, stopCount - 1]`.
 */
export function pointerToStopIndex(fraction: number, stopCount: number): number {
  if (stopCount <= 1) return 0;
  const clamped = Math.min(1, Math.max(0, fraction));
  return Math.round(clamped * (stopCount - 1));
}

/**
 * The "active seam" ordinal — an index into the position's seams in story
 * order, or `null` when no seam is active. The arrow-key walk moves this value.
 */
export type ActiveSeam = number | null;

/**
 * Next active-seam ordinal on a Right press, given the current value and the
 * number of seams. From cleared (`null`) the first seam (0) activates. There is
 * **no wrap-around**: Right on the last seam is a no-op (returns the same value).
 * With zero seams it stays `null`. Returns the unchanged input on a no-op so the
 * caller can detect "real move vs edge" by reference/equality.
 */
export function seamNextIndex(current: ActiveSeam, seamCount: number): ActiveSeam {
  if (seamCount <= 0) return null;
  if (current === null) return 0;
  return current < seamCount - 1 ? current + 1 : current;
}

/**
 * Previous active-seam ordinal on a Left press. Left on the first seam (0) is a
 * no-op (returns 0, not `null` — Left never clears). From cleared (`null`) Left
 * is a no-op. With zero seams it stays `null`.
 */
export function seamPrevIndex(current: ActiveSeam, seamCount: number): ActiveSeam {
  if (seamCount <= 0) return null;
  if (current === null) return null;
  return current > 0 ? current - 1 : current;
}

/** Build the render-ready view for one position of a cache. */
export function renderPosition(
  cache: TaleCache,
  positionIndex: number,
): RenderedPosition {
  const position = cache.positions[positionIndex];
  const { source, words, kernel_word_indices } = cache;

  const kernelSet = new Set(kernel_word_indices);

  // Paragraph breaks read as prose structure while most of the text survives,
  // but once the page is mostly gaps each paragraph keeps only a word or two and
  // the preserved blank lines become large, strange vertical voids. So we only
  // honour paragraph breaks while < half the words are removed; past that the
  // surviving words close up into a continuous "constellation".
  const keepParagraphs = position.words_removed <= position.words_remaining;

  // Map every removed word index to the gap it belongs to, so we can emit a
  // single seam per gap at the gap's first surviving boundary.
  const wordToGapId = new Map<number, number>();
  for (const gap of position.gaps) {
    for (const wi of gap.word_indices) {
      wordToGapId.set(wi, gap.id);
    }
  }

  // Whitespace rule: a newline (paragraph break) is honored ONLY between two
  // surviving words. Any separator touching a removed span collapses to a
  // single space, so a collapsed gap "absorbs" its own line breaks and the
  // surviving prose closes up — no line break renders before or after a seam.
  // The seam's own separator is taken from the gap's LAST word (its right
  // boundary into the next survivor), then collapsed.
  const gapTrailingSep = new Map<number, string>();
  const gapPredicted = new Map<number, string>();
  const gapActual = new Map<number, string>();
  const gapFidelity = new Map<number, number>();
  for (const gap of position.gaps) {
    const last = Math.max(...gap.word_indices);
    gapTrailingSep.set(gap.id, separatorAfter(source, words, last));
    gapPredicted.set(gap.id, gap.predicted_text);
    gapActual.set(gap.id, gap.actual_text);
    gapFidelity.set(gap.id, gap.fidelity);
  }

  const proseItems: ProseItem[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Empty-core entries (stray quote marks etc.) exist only to keep word
    // indices stable across consumers; they are never rendered as prose.
    if (word.is_empty_core) continue;

    const rawSep = separatorAfter(source, words, i);
    const gapId = wordToGapId.get(word.index);

    if (gapId !== undefined) {
      // Removed word. Collapse a run of removed words into ONE seam — whether
      // the same gap or several adjacent gaps with no surviving word between
      // them — so deep compression shows a single pipe, not "| | |". The seam
      // accumulates every gap id in the run (Step 5 reveal will use them) and
      // its trailing separator tracks the latest gap's right boundary. It
      // never carries a newline.
      const sep = spaceUnlessEmpty(gapTrailingSep.get(gapId) ?? rawSep);
      const predicted = gapPredicted.get(gapId) ?? '';
      const actual = gapActual.get(gapId) ?? '';
      const prev = proseItems[proseItems.length - 1];
      if (prev && prev.kind === 'seam') {
        if (prev.gapIds[prev.gapIds.length - 1] !== gapId) {
          prev.gapIds.push(gapId);
          prev.predictedText = prev.predictedText
            ? `${prev.predictedText} ${predicted}`
            : predicted;
          prev.actualText = prev.actualText
            ? `${prev.actualText} ${actual}`
            : actual;
        }
        prev.separator = sep;
      } else {
        proseItems.push({
          kind: 'seam',
          gapIds: [gapId],
          predictedText: predicted,
          actualText: actual,
          // Single-gap fidelity for now; multi-gap runs are averaged below.
          fidelity: gapFidelity.get(gapId) ?? 0,
          separator: sep,
        });
      }
      continue;
    }

    // Survivor: a real paragraph break is honored only between two surviving
    // words; collapse to a space when the next word is removed (no break going
    // into a seam) — and single line-wrap newlines always become spaces.
    const nextPos = nextRenderableIndex(words, i + 1);
    const nextRemoved =
      nextPos !== -1 && wordToGapId.has(words[nextPos].index);
    const separator =
      nextRemoved || !keepParagraphs
        ? spaceUnlessEmpty(rawSep)
        : survivorSeparator(rawSep);

    proseItems.push({
      kind: 'word',
      index: word.index,
      text: wordText(word),
      separator,
      isKernel: kernelSet.has(word.index),
    });
  }

  // Fidelity per seam: the unweighted mean of its gaps' fidelities, rounded to
  // 2 decimals (the precision the inspector shows). Each gap is a separate model
  // reconstruction, so they weigh equally regardless of span length. Done as a
  // post-pass because a run's gap membership is only final once the loop closes.
  for (const item of proseItems) {
    if (item.kind !== 'seam') continue;
    const mean =
      item.gapIds.reduce((sum, id) => sum + (gapFidelity.get(id) ?? 0), 0) /
      item.gapIds.length;
    item.fidelity = Math.round(mean * 100) / 100;
  }

  // Removed tiles: the union of this position's gap word_indices, in source
  // order, excluding empty-core entries (no glyphs to show as a tile).
  const wordByIndex = new Map<number, WordEntry>();
  for (const w of words) wordByIndex.set(w.index, w);

  const removedIndices = new Set<number>();
  for (const gap of position.gaps) {
    for (const wi of gap.word_indices) removedIndices.add(wi);
  }

  const removedTiles: RemovedTile[] = [...removedIndices]
    .sort((a, b) => a - b)
    .map((wi) => wordByIndex.get(wi))
    .filter((w): w is WordEntry => w !== undefined && !w.is_empty_core)
    .map((w) => ({ index: w.index, text: wordText(w), surprisal: w.surprisal }));

  const total = cache.metadata.total_bits;
  const readout: HeaderReadout = {
    storedPct: total > 0 ? Math.round((position.stored_bits / total) * 100) : 0,
    predictedPct:
      total > 0 ? Math.round((position.predicted_bits / total) * 100) : 0,
    conservedPct: 100,
  };

  return { position, proseItems, removedTiles, readout };
}
