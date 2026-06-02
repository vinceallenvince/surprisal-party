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
 *     forcing a line break.
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

/** A collapsed gap, rendered as a static thin seam between survivors. */
export type ProseSeamItem = {
  kind: 'seam';
  /** The gap's stable id within its position. */
  gapId: number;
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

/** Build the render-ready view for one position of a cache. */
export function renderPosition(
  cache: TaleCache,
  positionIndex: number,
): RenderedPosition {
  const position = cache.positions[positionIndex];
  const { source, words, kernel_word_indices } = cache;

  const kernelSet = new Set(kernel_word_indices);

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
  for (const gap of position.gaps) {
    const last = Math.max(...gap.word_indices);
    gapTrailingSep.set(gap.id, separatorAfter(source, words, last));
  }

  const proseItems: ProseItem[] = [];
  let lastEmittedGapId: number | null = null;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Empty-core entries (stray quote marks etc.) exist only to keep word
    // indices stable across consumers; they are never rendered as prose.
    if (word.is_empty_core) continue;

    const rawSep = separatorAfter(source, words, i);
    const gapId = wordToGapId.get(word.index);

    if (gapId !== undefined) {
      // Removed word: emit one seam for the run of words in this gap, the
      // first time we encounter the gap. Subsequent words in the same gap
      // collapse into that single seam. The seam never carries a newline.
      if (gapId !== lastEmittedGapId) {
        proseItems.push({
          kind: 'seam',
          gapId,
          // Adjacent to a removed span → always a space (never a break).
          separator: spaceUnlessEmpty(gapTrailingSep.get(gapId) ?? rawSep),
        });
        lastEmittedGapId = gapId;
      }
      continue;
    }

    // Survivor: a real paragraph break is honored only between two surviving
    // words; collapse to a space when the next word is removed (no break going
    // into a seam) — and single line-wrap newlines always become spaces.
    const nextPos = nextRenderableIndex(words, i + 1);
    const nextRemoved =
      nextPos !== -1 && wordToGapId.has(words[nextPos].index);
    const separator = nextRemoved
      ? spaceUnlessEmpty(rawSep)
      : survivorSeparator(rawSep);

    lastEmittedGapId = null;
    proseItems.push({
      kind: 'word',
      index: word.index,
      text: wordText(word),
      separator,
      isKernel: kernelSet.has(word.index),
    });
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
