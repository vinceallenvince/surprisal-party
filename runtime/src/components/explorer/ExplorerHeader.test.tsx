import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExplorerHeader } from './ExplorerHeader';

/**
 * Header wiring: the two ⓘ buttons. The one beside the title re-summons the
 * primer; the one immediately left of the metrics opens the metrics-explainer.
 */

function renderHeader(overrides: Partial<Parameters<typeof ExplorerHeader>[0]> = {}) {
  const props = {
    corpusTitle: 'Little Red Riding Hood',
    storedPct: 100,
    predictedPct: 0,
    avgFidelity: null,
    onShowPrimer: vi.fn(),
    onShowMetrics: vi.fn(),
    ...overrides,
  };
  render(<ExplorerHeader {...props} />);
  return props;
}

describe('ExplorerHeader', () => {
  it('renders the readout with avg fidelity as an em dash when null', () => {
    renderHeader({ storedPct: 100, predictedPct: 0, avgFidelity: null });
    expect(screen.getByText('100.0%')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows avg fidelity to two decimals when present', () => {
    renderHeader({ storedPct: 74, predictedPct: 26, avgFidelity: 0.18 });
    expect(screen.getByText('0.18')).toBeInTheDocument();
  });

  it('the title ⓘ re-summons the primer; the metrics ⓘ opens the metrics modal', () => {
    const onShowPrimer = vi.fn();
    const onShowMetrics = vi.fn();
    renderHeader({ onShowPrimer, onShowMetrics });

    fireEvent.click(screen.getByRole('button', { name: /about surprisal/i }));
    expect(onShowPrimer).toHaveBeenCalledTimes(1);
    expect(onShowMetrics).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /what the metrics mean/i }));
    expect(onShowMetrics).toHaveBeenCalledTimes(1);
    expect(onShowPrimer).toHaveBeenCalledTimes(1);
  });
});
