import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProseColumn } from './ProseColumn';
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
    render(<ProseColumn items={items} streamKey={0} revealCount={2} />);
    expect(screen.getByText('Once')).toBeInTheDocument();
    expect(screen.getByText('upon')).toBeInTheDocument();
    expect(screen.getByText('wolf.')).toBeInTheDocument();
  });

  it('marks kernel words coral and leaves non-kernel words prose-grey', () => {
    render(<ProseColumn items={items} streamKey={0} revealCount={2} />);
    expect(screen.getByText('Once')).toHaveClass('text-kernel');
    expect(screen.getByText('wolf.')).toHaveClass('text-kernel');
    const upon = screen.getByText('upon');
    expect(upon).not.toHaveClass('text-kernel');
    expect(upon).toHaveClass('text-prose');
  });

  it('renders one collapsed seam marker for the gap run', () => {
    const { container } = render(<ProseColumn items={items} streamKey={0} revealCount={2} />);
    // One pipe per collapsed run (the predicted-text span is separate).
    const pipes = container.querySelectorAll('[data-seam-pipe]');
    expect(pipes).toHaveLength(1);
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
    render(<ProseColumn items={twoSeamItems} streamKey={1} revealCount={0} />);
    expect(
      screen.getByText('Press an arrow key to walk the seams'),
    ).toBeInTheDocument();
  });

  it('Right activates the first seam and fills the inspector', () => {
    render(<ProseColumn items={twoSeamItems} streamKey={1} revealCount={0} />);
    key('ArrowRight');
    expect(screen.getByText('a little')).toBeInTheDocument();
    expect(screen.getByText('0.91')).toBeInTheDocument();
    expect(screen.getByText('Actual')).toBeInTheDocument();
    expect(screen.getByText('Fidelity')).toBeInTheDocument();
  });

  it('Right again advances to the next seam', () => {
    render(<ProseColumn items={twoSeamItems} streamKey={1} revealCount={0} />);
    key('ArrowRight');
    key('ArrowRight');
    expect(screen.getByText('wandered')).toBeInTheDocument();
    expect(screen.getByText('0.42')).toBeInTheDocument();
  });

  it('Right on the last seam is a no-op (no wrap-around)', () => {
    render(<ProseColumn items={twoSeamItems} streamKey={1} revealCount={0} />);
    key('ArrowRight');
    key('ArrowRight');
    key('ArrowRight'); // already on the last seam
    expect(screen.getByText('wandered')).toBeInTheDocument();
    expect(screen.queryByText('a little')).not.toBeInTheDocument();
  });

  it('Left steps back to the previous seam', () => {
    render(<ProseColumn items={twoSeamItems} streamKey={1} revealCount={0} />);
    key('ArrowRight');
    key('ArrowRight');
    key('ArrowLeft');
    expect(screen.getByText('a little')).toBeInTheDocument();
  });

  it('Esc clears the active seam back to the empty inspector', () => {
    render(<ProseColumn items={twoSeamItems} streamKey={1} revealCount={0} />);
    key('ArrowRight');
    key('Escape');
    expect(
      screen.getByText('Press an arrow key to walk the seams'),
    ).toBeInTheDocument();
  });
});
