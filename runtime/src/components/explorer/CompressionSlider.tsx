'use client';

import { useCallback, useRef } from 'react';
import { pointerToStopIndex, positionToThumbPct } from '@/lib/tale-render';

/**
 * Bottom compression slider — maps to frame 28-163 node 28:202 (Container).
 *
 * A gradient track (cool lossless -> warm lossy) with five evenly-spaced
 * notches, the thumb pinned to the selected stop, and five labels beneath.
 *
 * Step 3 makes it interactive — but **mouse/pointer only**, by design. A click
 * on the track or a drag of the thumb snaps to the nearest of the five stops
 * and calls `onChange` with that index (controlled component; the parent owns
 * the selected position). The swap is discrete: there is no free-floating
 * thumb and no tweening — the thumb jumps to the resolved stop.
 *
 * Keyboard is intentionally NOT bound here: the arrow keys drive the seam walk,
 * and wiring them to the slider would conflict. The slider is therefore
 * mouse/pointer-only and NOT keyboard-focusable (no `tabIndex`) — a focusable
 * control that ignores the arrow keys would only show a misleading focus ring.
 * ARIA still advertises it as a slider (`role="slider"` + value/text) so its
 * state is legible to assistive tech; full keyboard operability is deferred
 * (Phase 3) per the design's mouse-only operation model.
 *
 * The track is inset to align with the prose column: it is flanked by a 64px
 * spacer (matching the corpus rail) on the left and a 256px spacer (matching
 * the predicted strip) on the right, mirroring nodes 28:203 / 28:223.
 */

const STOPS = [
  { label: 'UNCOMPRESSED', mobileLabel: 'UNCOMPRESSED', align: 'start' as const },
  { label: '25%', mobileLabel: null, align: 'center' as const },
  { label: '50%', mobileLabel: null, align: 'center' as const },
  { label: '75%', mobileLabel: null, align: 'center' as const },
  { label: 'MAX COMPRESSED', mobileLabel: 'MAX', align: 'end' as const },
];

const STOP_COUNT = STOPS.length;
const MAX_INDEX = STOP_COUNT - 1;

function labelPositionClass(align: 'start' | 'center' | 'end'): string {
  if (align === 'start') return 'left-0';
  if (align === 'end') return 'right-0';
  // center stops are positioned entirely by the inline style below
  return '';
}

type CompressionSliderProps = {
  /** Currently selected stop index (0–4). */
  selectedIndex: number;
  /** Called with the nearest stop index when the user clicks or drags. */
  onChange: (index: number) => void;
};

export function CompressionSlider({
  selectedIndex,
  onChange,
}: CompressionSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const thumbPct = positionToThumbPct(selectedIndex, STOP_COUNT);

  // Resolve a clientX against the track's box to the nearest stop, then notify
  // the parent only when the resolved stop actually changes.
  const snapFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      if (rect.width === 0) return;
      const fraction = (clientX - rect.left) / rect.width;
      const next = pointerToStopIndex(fraction, STOP_COUNT);
      if (next !== selectedIndex) onChange(next);
    },
    [onChange, selectedIndex],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Mouse/pen/touch pointers only; capture so a drag keeps tracking even
      // when the cursor leaves the track. Pointer move while captured drags.
      event.currentTarget.setPointerCapture(event.pointerId);
      snapFromClientX(event.clientX);
    },
    [snapFromClientX],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Only track movement once a drag is in progress (pointer captured).
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      snapFromClientX(event.clientX);
    },
    [snapFromClientX],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  return (
    <div className="w-full border-t border-seam">
      <div className="flex items-start pt-6 pb-8 md:pt-[49px] md:pb-12">
        <div className="hidden h-12 w-16 shrink-0 md:block" />
        <div className="min-w-0 grow px-8 md:px-4">
          {/* Track — the pointer interaction surface. Padded hit-area via the
              wrapper below so thin track is easy to grab. */}
          <div
            ref={trackRef}
            className="slider-track relative h-2 w-full cursor-pointer touch-none rounded-full"
            role="slider"
            aria-label="Compression level"
            aria-valuemin={0}
            aria-valuemax={MAX_INDEX}
            aria-valuenow={selectedIndex}
            aria-valuetext={STOPS[selectedIndex]?.label}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Notches at 0 / 25 / 50 / 75 / 100% */}
            {[0, 25, 50, 75, 100].map((pct) => (
              <div
                key={pct}
                className="absolute top-[-4px] h-4 w-0.5 -translate-x-1/2 rounded-full bg-notch"
                style={{ left: `${pct}%` }}
              />
            ))}
            {/* Thumb pinned to the selected stop. */}
            <div
              className="absolute top-[-10px] size-7 -translate-x-1/2 rounded-full border-2 border-notch bg-thumb shadow-lg"
              style={{ left: `${thumbPct}%` }}
              role="presentation"
            />
          </div>
          {/* Labels */}
          <div className="relative mt-6 h-4 w-full">
            {STOPS.map((stop, i) => (
              <p
                key={stop.label}
                className={`absolute top-0 text-xs whitespace-nowrap text-faint ${labelPositionClass(stop.align)} ${stop.mobileLabel === null ? 'hidden md:block' : ''}`}
                style={
                  stop.align === 'center'
                    ? { left: `${i * 25}%`, transform: 'translateX(-50%)' }
                    : undefined
                }
              >
                {stop.mobileLabel !== null ? (
                  <>
                    <span className="md:hidden">{stop.mobileLabel}</span>
                    <span className="hidden md:inline">{stop.label}</span>
                  </>
                ) : (
                  stop.label
                )}
              </p>
            ))}
          </div>
        </div>
        <div className="hidden h-12 w-64 shrink-0 md:block" />
      </div>
    </div>
  );
}
