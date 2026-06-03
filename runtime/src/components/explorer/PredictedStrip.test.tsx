import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PredictedStrip } from './PredictedStrip';
import type { RemovedTile } from '@/lib/tale-render';

const tiles: RemovedTile[] = [
  { index: 1, text: 'upon', surprisal: 3.0, gapId: 0 },
  { index: 2, text: 'a', surprisal: 0.1, gapId: 0 },
  { index: 5, text: 'wolf', surprisal: 2.0, gapId: 3 },
];

describe('PredictedStrip', () => {
  it('renders each removed word as a clickable button', () => {
    render(<PredictedStrip tiles={tiles} onTileActivate={vi.fn()} />);
    for (const tile of tiles) {
      const btn = screen.getByText(tile.text);
      expect(btn.tagName).toBe('BUTTON');
      expect(btn).toHaveAttribute('type', 'button');
    }
  });

  it('shows the migrated word count in the heading', () => {
    render(<PredictedStrip tiles={tiles} onTileActivate={vi.fn()} />);
    expect(screen.getByText('Removed (3 words)')).toBeInTheDocument();
  });

  it("calls onTileActivate with the tile's gap id on click", () => {
    const onTileActivate = vi.fn();
    render(<PredictedStrip tiles={tiles} onTileActivate={onTileActivate} />);
    fireEvent.click(screen.getByText('wolf'));
    expect(onTileActivate).toHaveBeenCalledTimes(1);
    expect(onTileActivate).toHaveBeenCalledWith(3);
  });

  it('carries the hover-white rollover class on each tile', () => {
    render(<PredictedStrip tiles={tiles} onTileActivate={vi.fn()} />);
    expect(screen.getByText('upon')).toHaveClass('hover:text-prose');
  });

  it('highlights tiles whose gap id is in activeGapIds', () => {
    render(
      <PredictedStrip
        tiles={tiles}
        onTileActivate={vi.fn()}
        activeGapIds={[0]}
      />,
    );
    // Both gap-0 tiles ("upon", "a") are active; the gap-3 tile ("wolf") is not.
    const upon = screen.getByText('upon');
    expect(upon).toHaveAttribute('data-active', 'true');
    expect(upon).toHaveClass('bg-kernel/25', 'text-prose');
    expect(screen.getByText('a')).toHaveAttribute('data-active', 'true');
    const wolf = screen.getByText('wolf');
    expect(wolf).toHaveAttribute('data-active', 'false');
    expect(wolf).toHaveClass('bg-seam/40', 'text-faint');
  });
});
