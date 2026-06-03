import { describe, it, expect } from 'vitest';
import {
  midPositionIndex,
  pointerToStopIndex,
  positionToThumbPct,
  renderPosition,
  seamNextIndex,
  seamPrevIndex,
} from './tale-render';
import type { TaleCache } from '@/types/tale-cache';

/**
 * A tiny synthetic cache exercising the derivation rules:
 *   - word 0 "Once" survives (kernel)
 *   - words 1,2 form gap 0 ("upon a") — collapse to one seam
 *   - word 3 "time" survives, with a trailing-punct period
 *   - word 4 is an empty-core quote mark — never rendered
 * source mirrors `core + trailing_punct` per word with single-space separators.
 */
function makeCache(): TaleCache {
  return {
    schema_version: '0.1.0',
    metadata: {
      title: 'Test Tale',
      source_file: 'x.txt',
      model_id: 'test',
      generated_at: '2026-01-01T00:00:00Z',
      total_bits: 100,
      word_count: 4,
      token_count: 4,
    },
    // "Once upon a time. '"  — offsets must match char_start/char_end below.
    source: "Once upon a time. '",
    words: [
      { index: 0, core: 'Once', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 0, char_end: 4, surprisal: 0.0 },
      { index: 1, core: 'upon', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 5, char_end: 9, surprisal: 3.0 },
      { index: 2, core: 'a', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 10, char_end: 11, surprisal: 0.1 },
      { index: 3, core: 'time', trailing_punct: '.', is_terminal_punct: true, is_empty_core: false, char_start: 12, char_end: 17, surprisal: 2.0 },
      { index: 4, core: '', trailing_punct: "'", is_terminal_punct: false, is_empty_core: true, char_start: 18, char_end: 19, surprisal: 0.0 },
    ],
    kernel_word_indices: [0],
    positions: [
      {
        index: 0,
        threshold: 0,
        words_remaining: 4,
        words_removed: 0,
        stored_bits: 100,
        predicted_bits: 0,
        gaps: [],
      },
      {
        index: 1,
        threshold: 1,
        words_remaining: 2,
        words_removed: 2,
        stored_bits: 75,
        predicted_bits: 25,
        gaps: [
          {
            id: 0,
            start_word_index: 1,
            end_word_index: 2,
            word_indices: [1, 2],
            actual_text: 'upon a',
            predicted_text: 'in a',
            fidelity: 0.5,
          },
        ],
      },
    ],
  };
}

describe('midPositionIndex', () => {
  it('returns floor(length/2)', () => {
    expect(midPositionIndex(makeCache())).toBe(1);
  });
});

describe('renderPosition', () => {
  it('renders all survivors as words at position 0', () => {
    const r = renderPosition(makeCache(), 0);
    const words = r.proseItems.filter((i) => i.kind === 'word');
    // empty-core word 4 is excluded
    expect(words.map((w) => (w.kind === 'word' ? w.text : ''))).toEqual([
      'Once',
      'upon',
      'a',
      'time.',
    ]);
    expect(r.proseItems.some((i) => i.kind === 'seam')).toBe(false);
    expect(r.removedTiles).toHaveLength(0);
  });

  it('collapses a multi-word gap into a single seam', () => {
    const r = renderPosition(makeCache(), 1);
    const kinds = r.proseItems.map((i) => i.kind);
    // Once <seam> time.  -> word, seam, word
    expect(kinds).toEqual(['word', 'seam', 'word']);
    const seams = r.proseItems.filter((i) => i.kind === 'seam');
    expect(seams).toHaveLength(1);
    expect(seams[0].kind === 'seam' && seams[0].gapIds).toEqual([0]);
  });

  it('collapses adjacent gaps (no survivor between) into one seam', () => {
    // "A b c d" — A(0) and d(3) survive; b(1) and c(2) are removed as TWO
    // separate adjacent gaps. With no survivor between them they must render
    // as a single seam carrying both gap ids, not "| |".
    const cache: TaleCache = {
      schema_version: '0.1.0',
      metadata: { title: 'Adj', source_file: 'x', model_id: 't', generated_at: '2026-01-01T00:00:00Z', total_bits: 100, word_count: 4, token_count: 4 },
      source: 'A b c d',
      words: [
        { index: 0, core: 'A', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 0, char_end: 1, surprisal: 0.0 },
        { index: 1, core: 'b', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 2, char_end: 3, surprisal: 3.0 },
        { index: 2, core: 'c', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 4, char_end: 5, surprisal: 3.0 },
        { index: 3, core: 'd', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 6, char_end: 7, surprisal: 0.5 },
      ],
      kernel_word_indices: [0],
      positions: [
        { index: 0, threshold: 1, words_remaining: 2, words_removed: 2, stored_bits: 50, predicted_bits: 50,
          gaps: [
            { id: 0, start_word_index: 1, end_word_index: 1, word_indices: [1], actual_text: 'b', predicted_text: 'x', fidelity: 0.5 },
            { id: 1, start_word_index: 2, end_word_index: 2, word_indices: [2], actual_text: 'c', predicted_text: 'y', fidelity: 0.5 },
          ] },
      ],
    };
    const r = renderPosition(cache, 0);
    expect(r.proseItems.map((i) => i.kind)).toEqual(['word', 'seam', 'word']);
    const seam = r.proseItems.find((i) => i.kind === 'seam');
    expect(seam?.kind === 'seam' && seam.gapIds).toEqual([0, 1]);
  });

  it('marks kernel words', () => {
    const r = renderPosition(makeCache(), 1);
    const once = r.proseItems.find(
      (i) => i.kind === 'word' && i.index === 0,
    );
    expect(once?.kind === 'word' && once.isKernel).toBe(true);
  });

  it('emits removed words as tiles in index order, excluding empty cores', () => {
    const r = renderPosition(makeCache(), 1);
    expect(r.removedTiles.map((t) => t.text)).toEqual(['upon', 'a']);
  });

  it('preserves literal source separators after survivors', () => {
    const r = renderPosition(makeCache(), 0);
    const words = r.proseItems.filter((i) => i.kind === 'word');
    // single spaces between, '' after the last rendered word (empty-core
    // word 4 is skipped but the separator after "time." is source[17..18]=' ')
    expect(words.map((w) => (w.kind === 'word' ? w.separator : ''))).toEqual([
      ' ',
      ' ',
      ' ',
      ' ',
    ]);
  });

  it('collapses a paragraph break adjacent to a gap (no newline after a seam)', () => {
    // "A b c\n\nd e" — words: A(0) b(1) c(2) d(3) e(4). Gap [1,2] ("b c") is
    // followed by a paragraph break in the source ('\n\n' after word 2). Per
    // the whitespace rule, a break touching a removed span collapses: the seam
    // must NOT carry the newline, and no separator anywhere is a newline.
    const cache: TaleCache = {
      schema_version: '0.1.0',
      metadata: {
        title: 'Para Tale',
        source_file: 'x.txt',
        model_id: 'test',
        generated_at: '2026-01-01T00:00:00Z',
        total_bits: 100,
        word_count: 5,
        token_count: 5,
      },
      source: 'A b c\n\nd e',
      words: [
        { index: 0, core: 'A', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 0, char_end: 1, surprisal: 0.0 },
        { index: 1, core: 'b', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 2, char_end: 3, surprisal: 3.0 },
        { index: 2, core: 'c', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 4, char_end: 5, surprisal: 3.0 },
        { index: 3, core: 'd', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 7, char_end: 8, surprisal: 1.0 },
        { index: 4, core: 'e', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 9, char_end: 10, surprisal: 1.0 },
      ],
      kernel_word_indices: [0],
      positions: [
        {
          index: 0,
          threshold: 1,
          words_remaining: 3,
          words_removed: 2,
          stored_bits: 60,
          predicted_bits: 40,
          gaps: [
            {
              id: 0,
              start_word_index: 1,
              end_word_index: 2,
              word_indices: [1, 2],
              actual_text: 'b c',
              predicted_text: 'x y',
              fidelity: 0.5,
            },
          ],
        },
      ],
    };

    const r = renderPosition(cache, 0);
    const seam = r.proseItems.find((i) => i.kind === 'seam');
    // The gap's last word (word 2) is followed by '\n\n' in source; the seam
    // collapses it to a single space.
    expect(seam?.kind === 'seam' && seam.separator).toBe(' ');
    // And no separator anywhere is a newline.
    expect(
      r.proseItems.every((i) => !i.separator.includes('\n')),
    ).toBe(true);
  });

  it('collapses a single line-wrap newline between survivors to a space', () => {
    // "A\nb c" — the source is hard-wrapped, so a single '\n' falls between
    // survivors "A" and "b" mid-sentence. That is line-wrapping, not a
    // paragraph break, and must render as a space (no line break).
    const cache: TaleCache = {
      schema_version: '0.1.0',
      metadata: { title: 'W', source_file: 'x', model_id: 't', generated_at: '2026-01-01T00:00:00Z', total_bits: 100, word_count: 3, token_count: 3 },
      source: 'A\nb c',
      words: [
        { index: 0, core: 'A', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 0, char_end: 1, surprisal: 0.0 },
        { index: 1, core: 'b', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 2, char_end: 3, surprisal: 0.5 },
        { index: 2, core: 'c', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 4, char_end: 5, surprisal: 0.5 },
      ],
      kernel_word_indices: [0],
      positions: [
        { index: 0, threshold: 0, words_remaining: 3, words_removed: 0, stored_bits: 100, predicted_bits: 0, gaps: [] },
      ],
    };
    const r = renderPosition(cache, 0);
    const a = r.proseItems.find((i) => i.kind === 'word' && i.index === 0);
    expect(a?.kind === 'word' && a.separator).toBe(' ');
    expect(r.proseItems.every((i) => !i.separator.includes('\n'))).toBe(true);
  });

  it('preserves a paragraph break between two surviving words', () => {
    // "A\n\nb c" — A(0) b(1) c(2); gap [2] removes "c". A and b both survive
    // with a '\n\n' between them, so that break is preserved.
    const cache: TaleCache = {
      schema_version: '0.1.0',
      metadata: { title: 'P', source_file: 'x', model_id: 't', generated_at: '2026-01-01T00:00:00Z', total_bits: 100, word_count: 3, token_count: 3 },
      source: 'A\n\nb c',
      words: [
        { index: 0, core: 'A', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 0, char_end: 1, surprisal: 0.0 },
        { index: 1, core: 'b', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 3, char_end: 4, surprisal: 0.5 },
        { index: 2, core: 'c', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 5, char_end: 6, surprisal: 3.0 },
      ],
      kernel_word_indices: [0],
      positions: [
        { index: 0, threshold: 1, words_remaining: 2, words_removed: 1, stored_bits: 70, predicted_bits: 30,
          gaps: [{ id: 0, start_word_index: 2, end_word_index: 2, word_indices: [2], actual_text: 'c', predicted_text: 'x', fidelity: 0.5 }] },
      ],
    };
    const r = renderPosition(cache, 0);
    const a = r.proseItems.find((i) => i.kind === 'word' && i.index === 0);
    expect(a?.kind === 'word' && a.separator).toBe('\n\n');
  });

  it('collapses a paragraph break before a gap', () => {
    // "A\n\nb c" — A(0) b(1) c(2); gap [1] removes "b". The '\n\n' after the
    // surviving "A" leads into a removed word, so it collapses to a space.
    const cache: TaleCache = {
      schema_version: '0.1.0',
      metadata: { title: 'P', source_file: 'x', model_id: 't', generated_at: '2026-01-01T00:00:00Z', total_bits: 100, word_count: 3, token_count: 3 },
      source: 'A\n\nb c',
      words: [
        { index: 0, core: 'A', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 0, char_end: 1, surprisal: 0.0 },
        { index: 1, core: 'b', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 3, char_end: 4, surprisal: 3.0 },
        { index: 2, core: 'c', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 5, char_end: 6, surprisal: 0.5 },
      ],
      kernel_word_indices: [0],
      positions: [
        { index: 0, threshold: 1, words_remaining: 2, words_removed: 1, stored_bits: 70, predicted_bits: 30,
          gaps: [{ id: 0, start_word_index: 1, end_word_index: 1, word_indices: [1], actual_text: 'b', predicted_text: 'x', fidelity: 0.5 }] },
      ],
    };
    const r = renderPosition(cache, 0);
    const a = r.proseItems.find((i) => i.kind === 'word' && i.index === 0);
    expect(a?.kind === 'word' && a.separator).toBe(' ');
  });

  it('drops paragraph breaks once more than half the words are removed', () => {
    // "A\n\nb c d e" — A(0) b(1) survive with a '\n\n' between them; c d e
    // (gap) are removed. words_removed (3) > words_remaining (2), so paragraph
    // breaks are dropped and A's separator collapses to a space (no tall void).
    const cache: TaleCache = {
      schema_version: '0.1.0',
      metadata: { title: 'P', source_file: 'x', model_id: 't', generated_at: '2026-01-01T00:00:00Z', total_bits: 100, word_count: 5, token_count: 5 },
      source: 'A\n\nb c d e',
      words: [
        { index: 0, core: 'A', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 0, char_end: 1, surprisal: 0.0 },
        { index: 1, core: 'b', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 3, char_end: 4, surprisal: 0.5 },
        { index: 2, core: 'c', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 5, char_end: 6, surprisal: 3.0 },
        { index: 3, core: 'd', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 7, char_end: 8, surprisal: 3.0 },
        { index: 4, core: 'e', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 9, char_end: 10, surprisal: 3.0 },
      ],
      kernel_word_indices: [0],
      positions: [
        { index: 0, threshold: 1, words_remaining: 2, words_removed: 3, stored_bits: 40, predicted_bits: 60,
          gaps: [{ id: 0, start_word_index: 2, end_word_index: 4, word_indices: [2, 3, 4], actual_text: 'c d e', predicted_text: 'x y z', fidelity: 0.5 }] },
      ],
    };
    const r = renderPosition(cache, 0);
    const a = r.proseItems.find((i) => i.kind === 'word' && i.index === 0);
    expect(a?.kind === 'word' && a.separator).toBe(' ');
    expect(r.proseItems.every((i) => !i.separator.includes('\n'))).toBe(true);
  });

  it('takes the seam separator from a single-word gap correctly', () => {
    // makeCache gap 0 is multi-word; here verify the single-word path.
    // "A b c" with a one-word gap [1] -> seam separator is source[3..4] = ' '.
    const cache: TaleCache = {
      schema_version: '0.1.0',
      metadata: {
        title: 'Single Tale',
        source_file: 'x.txt',
        model_id: 'test',
        generated_at: '2026-01-01T00:00:00Z',
        total_bits: 100,
        word_count: 3,
        token_count: 3,
      },
      source: 'A b c',
      words: [
        { index: 0, core: 'A', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 0, char_end: 1, surprisal: 0.0 },
        { index: 1, core: 'b', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 2, char_end: 3, surprisal: 3.0 },
        { index: 2, core: 'c', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 4, char_end: 5, surprisal: 1.0 },
      ],
      kernel_word_indices: [0],
      positions: [
        {
          index: 0,
          threshold: 1,
          words_remaining: 2,
          words_removed: 1,
          stored_bits: 70,
          predicted_bits: 30,
          gaps: [
            {
              id: 0,
              start_word_index: 1,
              end_word_index: 1,
              word_indices: [1],
              actual_text: 'b',
              predicted_text: 'x',
              fidelity: 0.5,
            },
          ],
        },
      ],
    };

    const r = renderPosition(cache, 0);
    const seam = r.proseItems.find((i) => i.kind === 'seam');
    expect(seam?.kind === 'seam' && seam.separator).toBe(' ');
  });

  it('derives a single-gap seam actualText and fidelity from the gap', () => {
    const r = renderPosition(makeCache(), 1);
    const seam = r.proseItems.find((i) => i.kind === 'seam');
    expect(seam?.kind === 'seam' && seam.actualText).toBe('upon a');
    expect(seam?.kind === 'seam' && seam.fidelity).toBe(0.5);
  });

  it('joins actualText and averages fidelity across an adjacent-gap run', () => {
    // Two adjacent gaps b(fid 0.5) and c(fid 0.9) with no survivor between them
    // collapse into one seam: actuals join in order, fidelity is the mean (0.70).
    const cache: TaleCache = {
      schema_version: '0.1.0',
      metadata: { title: 'Adj', source_file: 'x', model_id: 't', generated_at: '2026-01-01T00:00:00Z', total_bits: 100, word_count: 4, token_count: 4 },
      source: 'A b c d',
      words: [
        { index: 0, core: 'A', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 0, char_end: 1, surprisal: 0.0 },
        { index: 1, core: 'b', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 2, char_end: 3, surprisal: 3.0 },
        { index: 2, core: 'c', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 4, char_end: 5, surprisal: 3.0 },
        { index: 3, core: 'd', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 6, char_end: 7, surprisal: 0.5 },
      ],
      kernel_word_indices: [0],
      positions: [
        { index: 0, threshold: 1, words_remaining: 2, words_removed: 2, stored_bits: 50, predicted_bits: 50,
          gaps: [
            { id: 0, start_word_index: 1, end_word_index: 1, word_indices: [1], actual_text: 'b', predicted_text: 'x', fidelity: 0.5 },
            { id: 1, start_word_index: 2, end_word_index: 2, word_indices: [2], actual_text: 'c', predicted_text: 'y', fidelity: 0.9 },
          ] },
      ],
    };
    const r = renderPosition(cache, 0);
    const seam = r.proseItems.find((i) => i.kind === 'seam');
    expect(seam?.kind === 'seam' && seam.actualText).toBe('b c');
    expect(seam?.kind === 'seam' && seam.fidelity).toBe(0.7);
  });

  it('rounds an averaged fidelity to two decimals', () => {
    // fidelities 0.333 and 0.334 -> mean 0.3335 -> rounded 0.33.
    const cache: TaleCache = {
      schema_version: '0.1.0',
      metadata: { title: 'Rnd', source_file: 'x', model_id: 't', generated_at: '2026-01-01T00:00:00Z', total_bits: 100, word_count: 4, token_count: 4 },
      source: 'A b c d',
      words: [
        { index: 0, core: 'A', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 0, char_end: 1, surprisal: 0.0 },
        { index: 1, core: 'b', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 2, char_end: 3, surprisal: 3.0 },
        { index: 2, core: 'c', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 4, char_end: 5, surprisal: 3.0 },
        { index: 3, core: 'd', trailing_punct: '', is_terminal_punct: false, is_empty_core: false, char_start: 6, char_end: 7, surprisal: 0.5 },
      ],
      kernel_word_indices: [0],
      positions: [
        { index: 0, threshold: 1, words_remaining: 2, words_removed: 2, stored_bits: 50, predicted_bits: 50,
          gaps: [
            { id: 0, start_word_index: 1, end_word_index: 1, word_indices: [1], actual_text: 'b', predicted_text: 'x', fidelity: 0.333 },
            { id: 1, start_word_index: 2, end_word_index: 2, word_indices: [2], actual_text: 'c', predicted_text: 'y', fidelity: 0.334 },
          ] },
      ],
    };
    const r = renderPosition(cache, 0);
    const seam = r.proseItems.find((i) => i.kind === 'seam');
    expect(seam?.kind === 'seam' && seam.fidelity).toBe(0.33);
  });

  it('computes header readout from bits with conserved=100', () => {
    const r = renderPosition(makeCache(), 1);
    expect(r.readout).toEqual({
      storedPct: 75,
      predictedPct: 25,
      conservedPct: 100,
    });
  });
});

describe('positionToThumbPct', () => {
  it('spreads positions evenly across the track', () => {
    expect(positionToThumbPct(0, 5)).toBe(0);
    expect(positionToThumbPct(1, 5)).toBe(25);
    expect(positionToThumbPct(2, 5)).toBe(50);
    expect(positionToThumbPct(4, 5)).toBe(100);
  });

  it('pins to the start with a single stop', () => {
    expect(positionToThumbPct(0, 1)).toBe(0);
  });
});

describe('pointerToStopIndex', () => {
  it('snaps a fraction to the nearest of five stops', () => {
    expect(pointerToStopIndex(0, 5)).toBe(0);
    expect(pointerToStopIndex(0.1, 5)).toBe(0); // < halfway to stop 1 (.125)
    expect(pointerToStopIndex(0.2, 5)).toBe(1); // > halfway, rounds up
    expect(pointerToStopIndex(0.5, 5)).toBe(2);
    expect(pointerToStopIndex(0.6, 5)).toBe(2);
    expect(pointerToStopIndex(0.7, 5)).toBe(3);
    expect(pointerToStopIndex(1, 5)).toBe(4);
  });

  it('clamps a fraction that runs past either end of the track', () => {
    expect(pointerToStopIndex(-0.5, 5)).toBe(0);
    expect(pointerToStopIndex(1.5, 5)).toBe(4);
  });

  it('returns 0 for a single stop', () => {
    expect(pointerToStopIndex(0.9, 1)).toBe(0);
  });
});

describe('seamNextIndex (Right, no wrap)', () => {
  it('activates the first seam from cleared', () => {
    expect(seamNextIndex(null, 3)).toBe(0);
  });

  it('advances to the next seam', () => {
    expect(seamNextIndex(0, 3)).toBe(1);
    expect(seamNextIndex(1, 3)).toBe(2);
  });

  it('is a no-op on the last seam (no wrap-around)', () => {
    expect(seamNextIndex(2, 3)).toBe(2);
  });

  it('stays cleared when there are no seams', () => {
    expect(seamNextIndex(null, 0)).toBeNull();
  });
});

describe('seamPrevIndex (Left, no wrap)', () => {
  it('steps back to the previous seam', () => {
    expect(seamPrevIndex(2, 3)).toBe(1);
    expect(seamPrevIndex(1, 3)).toBe(0);
  });

  it('is a no-op on the first seam (Left never clears or wraps)', () => {
    expect(seamPrevIndex(0, 3)).toBe(0);
  });

  it('is a no-op from cleared', () => {
    expect(seamPrevIndex(null, 3)).toBeNull();
  });

  it('stays cleared when there are no seams', () => {
    expect(seamPrevIndex(null, 0)).toBeNull();
  });
});
