import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompressionSlider } from './CompressionSlider';

/**
 * Step 3 interaction tests for the compression slider.
 *
 * The pointer→stop math itself is unit-tested on `pointerToStopIndex`
 * (`tale-render.test.ts`); these tests cover the wiring: a click on the track
 * and a drag both resolve a clientX against the track's box and call `onChange`
 * with the nearest stop, and the control exposes correct slider ARIA.
 *
 * jsdom implements neither layout, the pointer-capture API, nor a PointerEvent
 * constructor, so we polyfill PointerEvent (over MouseEvent, which carries
 * clientX), stub the track's bounding box (track spans clientX 0..400), and
 * stub the capture methods.
 */

function getTrack(): HTMLElement {
  return screen.getByRole('slider');
}

// jsdom lacks a PointerEvent constructor; fireEvent.pointer* then falls back to
// a coordinate-less Event. Polyfill it over MouseEvent so clientX survives, and
// carry pointerId through (MouseEventInit ignores it).
class PointerEventPolyfill extends MouseEvent {
  pointerId: number;
  constructor(type: string, params: PointerEventInit = {}) {
    super(type, params);
    this.pointerId = params.pointerId ?? 0;
  }
}

beforeEach(() => {
  // @ts-expect-error — assigning the polyfill onto the jsdom global.
  globalThis.PointerEvent = PointerEventPolyfill;
  // Pointer capture is a no-op in jsdom; provide the methods the component
  // calls. hasPointerCapture returns true so move events are treated as drags.
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => true);
  // Track box: left 0, width 400 → clientX/400 is the track fraction.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 400,
    bottom: 8,
    width: 400,
    height: 8,
    toJSON: () => ({}),
  } as DOMRect);
});

describe('CompressionSlider ARIA', () => {
  it('advertises a slider with the selected stop label', () => {
    render(<CompressionSlider selectedIndex={2} onChange={vi.fn()} />);
    const track = getTrack();
    expect(track).toHaveAttribute('aria-valuemin', '0');
    expect(track).toHaveAttribute('aria-valuemax', '4');
    expect(track).toHaveAttribute('aria-valuenow', '2');
    expect(track).toHaveAttribute('aria-valuetext', '50%');
  });

  it('labels the far-left and far-right stops by name', () => {
    const { rerender } = render(
      <CompressionSlider selectedIndex={0} onChange={vi.fn()} />,
    );
    expect(getTrack()).toHaveAttribute('aria-valuetext', 'UNCOMPRESSED');
    rerender(<CompressionSlider selectedIndex={4} onChange={vi.fn()} />);
    expect(getTrack()).toHaveAttribute('aria-valuetext', 'MAX COMPRESSED');
  });
});

describe('CompressionSlider click', () => {
  it('snaps a track click to the nearest stop and reports the new index', () => {
    const onChange = vi.fn();
    render(<CompressionSlider selectedIndex={0} onChange={onChange} />);
    // clientX 400 → fraction 1.0 → stop 4 (MAX COMPRESSED).
    fireEvent.pointerDown(getTrack(), { pointerId: 1, clientX: 400 });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('snaps a mid-track click to the nearest interior stop', () => {
    const onChange = vi.fn();
    render(<CompressionSlider selectedIndex={0} onChange={onChange} />);
    // clientX 200 → fraction 0.5 → stop 2 (50%).
    fireEvent.pointerDown(getTrack(), { pointerId: 1, clientX: 200 });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('does not re-fire when the click resolves to the current stop', () => {
    const onChange = vi.fn();
    render(<CompressionSlider selectedIndex={2} onChange={onChange} />);
    // clientX 200 → stop 2, already selected → no change.
    fireEvent.pointerDown(getTrack(), { pointerId: 1, clientX: 200 });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('CompressionSlider drag', () => {
  it('snaps to nearest stops as the pointer is dragged (discrete swap)', () => {
    const onChange = vi.fn();
    render(<CompressionSlider selectedIndex={0} onChange={onChange} />);
    const track = getTrack();
    // Begin drag at the far left (stay on stop 0 → no call yet), then move.
    fireEvent.pointerDown(track, { pointerId: 1, clientX: 0 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 100 }); // 0.25 → stop 1
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 300 }); // 0.75 → stop 3
    expect(onChange).toHaveBeenNthCalledWith(1, 1);
    expect(onChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('ignores pointer movement when no drag is in progress', () => {
    const onChange = vi.fn();
    // hasPointerCapture false → a stray move (no active drag) is ignored.
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    render(<CompressionSlider selectedIndex={0} onChange={onChange} />);
    fireEvent.pointerMove(getTrack(), { pointerId: 1, clientX: 400 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
