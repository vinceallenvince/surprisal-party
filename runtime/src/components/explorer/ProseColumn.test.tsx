import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProseColumn } from './ProseColumn';
import type { ProseItem } from '@/lib/tale-render';

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
  { kind: 'seam', gapIds: [3, 4], predictedText: 'a wicked', separator: ' ' },
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
