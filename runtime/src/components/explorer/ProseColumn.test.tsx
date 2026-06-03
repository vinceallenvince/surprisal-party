import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProseColumn, pickRevealed } from './ProseColumn';
import type { ProseItem } from '@/lib/tale-render';

// jsdom has no Audio or scrollTo; stub them so the keyboard walk runs.
beforeAll(() => {
  vi.stubGlobal(
    'Audio',
    class {
      preload = '';
      currentTime = 0;
      play = vi.fn().mockResolvedValue(undefined);
    },
  );
  Element.prototype.scrollTo = vi.fn();
});

/**
 * Step 4 render check for the prose column.
 *
 * The CSS `transition-colors` crossfade is not observable in jsdom (no layout,
 * no computed transitions). What we lock down is the rendered content: survivor
 * words (with their kernel styling) and a single collapsed seam marker appear
 * in source order.
 */

const items: ProseItem[] = [
  { kind: 'word', index: 0, text: 'Once', separator: ' ', isKernel: true },
  { kind: 'word', index: 1, text: 'upon', separator: ' ', isKernel: false },
  {
    kind: 'seam',
    gapIds: [3, 4],
    predictedText: 'a wicked',
    actualText: 'a fierce',
    fidelity: 0.78,
    separator: ' ',
  },
  { kind: 'word', index: 7, text: 'wolf.', separator: '', isKernel: true },
];

describe('ProseColumn (Step 4 render)', () => {
  it('renders each survivor word in source order', () => {
    render(<ProseColumn items={items} streamKey={0} revealCount={2} selectFraction={1} />);
    expect(screen.getByText('Once')).toBeInTheDocument();
    expect(screen.getByText('upon')).toBeInTheDocument();
    expect(screen.getByText('wolf.')).toBeInTheDocument();
  });

  it('marks kernel words coral and leaves non-kernel words prose-grey', () => {
    render(<ProseColumn items={items} streamKey={0} revealCount={2} selectFraction={1} />);
    expect(screen.getByText('Once')).toHaveClass('text-kernel');
    expect(screen.getByText('wolf.')).toHaveClass('text-kernel');
    const upon = screen.getByText('upon');
    expect(upon).not.toHaveClass('text-kernel');
    expect(upon).toHaveClass('text-prose');
  });

  it('renders one collapsed seam marker for the gap run', () => {
    const { container } = render(<ProseColumn items={items} streamKey={0} revealCount={2} selectFraction={1} />);
    // One pipe per collapsed run (the predicted-text span is separate).
    const pipes = container.querySelectorAll('[data-seam-pipe]');
    expect(pipes).toHaveLength(1);
  });

  it('fades the prose in at UNCOMPRESSED (streamKey 0) but not when compressed', () => {
    // The fade class is present only at the far-left position; it toggles off
    // for any compressed position, so returning to 0 re-adds it and replays.
    const { container, rerender } = render(
      <ProseColumn items={items} streamKey={0} revealCount={2} selectFraction={1} />,
    );
    expect(container.querySelector('p.whitespace-pre-wrap')).toHaveClass(
      'prose-fade-in',
    );
    rerender(
      <ProseColumn items={items} streamKey={1} revealCount={2} selectFraction={1} />,
    );
    expect(container.querySelector('p.whitespace-pre-wrap')).not.toHaveClass(
      'prose-fade-in',
    );
  });
});

/**
 * Step 5 keyboard-walk behaviour. Two seams so we can exercise next/prev and the
 * no-wrap edges. The inspector shows the active seam's actual text + fidelity.
 */
const twoSeamItems: ProseItem[] = [
  { kind: 'word', index: 0, text: 'Once', separator: ' ', isKernel: true },
  {
    kind: 'seam',
    gapIds: [1],
    predictedText: 'a small',
    actualText: 'a little',
    fidelity: 0.91,
    separator: ' ',
  },
  { kind: 'word', index: 3, text: 'girl', separator: ' ', isKernel: false },
  {
    kind: 'seam',
    gapIds: [5],
    predictedText: 'walked',
    actualText: 'wandered',
    fidelity: 0.42,
    separator: '',
  },
];

describe('ProseColumn (Step 5 keyboard walk)', () => {
  function key(k: string) {
    fireEvent.keyDown(document, { key: k });
  }

  it('shows the empty inspector hint when no seam is active', () => {
    render(<ProseColumn items={twoSeamItems} streamKey={1} revealCount={0} selectFraction={1} />);
    expect(
      screen.getByText('Press an arrow key to walk the seams'),
    ).toBeInTheDocument();
  });

  it('Right activates the first seam and fills the inspector', () => {
    render(<ProseColumn items={twoSeamItems} streamKey={1} revealCount={0} selectFraction={1} />);
    key('ArrowRight');
    expect(screen.getByText('a little')).toBeInTheDocument();
    expect(screen.getByText('0.91')).toBeInTheDocument();
    expect(screen.getByText('Actual')).toBeInTheDocument();
    expect(screen.getByText('Fidelity')).toBeInTheDocument();
  });

  it('Right again advances to the next seam', () => {
    render(<ProseColumn items={twoSeamItems} streamKey={1} revealCount={0} selectFraction={1} />);
    key('ArrowRight');
    key('ArrowRight');
    expect(screen.getByText('wandered')).toBeInTheDocument();
    expect(screen.getByText('0.42')).toBeInTheDocument();
  });

  it('Right on the last seam is a no-op (no wrap-around)', () => {
    render(<ProseColumn items={twoSeamItems} streamKey={1} revealCount={0} selectFraction={1} />);
    key('ArrowRight');
    key('ArrowRight');
    key('ArrowRight'); // already on the last seam
    expect(screen.getByText('wandered')).toBeInTheDocument();
    expect(screen.queryByText('a little')).not.toBeInTheDocument();
  });

  it('Left steps back to the previous seam', () => {
    render(<ProseColumn items={twoSeamItems} streamKey={1} revealCount={0} selectFraction={1} />);
    key('ArrowRight');
    key('ArrowRight');
    key('ArrowLeft');
    expect(screen.getByText('a little')).toBeInTheDocument();
  });

  it('Esc clears the active seam back to the empty inspector', () => {
    render(<ProseColumn items={twoSeamItems} streamKey={1} revealCount={0} selectFraction={1} />);
    key('ArrowRight');
    key('Escape');
    expect(
      screen.getByText('Press an arrow key to walk the seams'),
    ).toBeInTheDocument();
  });

  it('suspends the walk while a modal dialog is open, and resumes when it closes', () => {
    // The real arrow-key isolation: ProseColumn's document-level listener bails
    // whenever an `[aria-modal="true"]` element is present (e.g. the onboarding
    // primer). This is the robust replacement for relying on a child's
    // stopPropagation, which can't stop a co-located document listener in the
    // App Router. (Reproduces the production topology a stopPropagation test
    // could not: a sibling document listener that fires regardless.)
    render(<ProseColumn items={twoSeamItems} streamKey={1} revealCount={0} selectFraction={1} />);
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);

    key('ArrowRight');
    // Walk suppressed: no seam activates; the inspector still shows the hint.
    expect(
      screen.getByText('Press an arrow key to walk the seams'),
    ).toBeInTheDocument();
    expect(screen.queryByText('a little')).not.toBeInTheDocument();

    document.body.removeChild(modal);
    // Modal gone → the walk resumes on the next arrow.
    key('ArrowRight');
    expect(screen.getByText('a little')).toBeInTheDocument();
  });
});

describe('pickRevealed (multi-word preference)', () => {
  // 4 multi-word seams + 4 single-word, interleaved with words. With fraction 1
  // the pool is all 8 and OVERSELECT (2×4=8) covers them, so for count 4 every
  // pick must be a multi-word seam regardless of the shuffle.
  function seam(predictedText: string): ProseItem {
    return { kind: 'seam', gapIds: [0], predictedText, actualText: predictedText, fidelity: 0.5, separator: ' ' };
  }
  const word = (text: string): ProseItem => ({ kind: 'word', index: 0, text, separator: ' ', isKernel: false });
  const multiThenSingle: ProseItem[] = [
    word('w'), seam('a b'), word('w'), seam('c d'), word('w'), seam('e f'),
    word('w'), seam('g h'), word('w'), seam('p'), word('w'), seam('q'),
    word('w'), seam('r'), word('w'), seam('s'),
  ];

  it('chooses only multi-word seams when count fits the multi-word supply', () => {
    const chosen = pickRevealed(multiThenSingle, 4, 1);
    expect(chosen).toHaveLength(4);
    for (const i of chosen) {
      const it = multiThenSingle[i];
      expect(it.kind).toBe('seam');
      expect(it.kind === 'seam' && it.predictedText.trim().split(/\s+/).length).toBeGreaterThan(1);
    }
  });

  it('tops up with single-word seams when count exceeds the multi-word supply', () => {
    const chosen = pickRevealed(multiThenSingle, 6, 1);
    expect(chosen).toHaveLength(6);
    const multiCount = chosen.filter((i) => {
      const it = multiThenSingle[i];
      return it.kind === 'seam' && it.predictedText.trim().split(/\s+/).length > 1;
    }).length;
    expect(multiCount).toBe(4); // all four multi-word, plus two single-word
  });

  it('always includes a seam from the first three (even when multi-word are later)', () => {
    // First three seams (list indices 0,1,2) are single-word; the satisfying
    // multi-word seams are all later, so the multi-word preference would skip
    // the top — the first-three guarantee must pull one in.
    const items: ProseItem[] = [
      seam('x'), seam('y'), seam('z'),
      seam('a b'), seam('c d'), seam('e f'), seam('g h'), seam('i j'),
    ];
    // Run several times since selection is random; the guarantee must always hold.
    for (let n = 0; n < 30; n++) {
      const chosen = pickRevealed(items, 2, 1);
      expect(chosen).toHaveLength(2);
      expect(chosen.some((i) => i <= 2)).toBe(true);
    }
  });
});
