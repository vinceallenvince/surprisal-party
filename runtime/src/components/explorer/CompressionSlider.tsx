/**
 * Bottom compression slider — maps to frame 28-163 node 28:202 (Container).
 *
 * A gradient track (cool lossless -> warm lossy) with five evenly-spaced
 * notches, the thumb positioned at `thumbPct` (default far left,
 * UNCOMPRESSED), and five labels beneath. Static / non-interactive — the
 * thumb only *reflects* the rendered position visually; wiring (drag,
 * state-swap) arrives in Step 3.
 *
 * The track is inset to align with the prose column: it is flanked by a 64px
 * spacer (matching the corpus rail) on the left and a 256px spacer (matching
 * the predicted strip) on the right, mirroring nodes 28:203 / 28:223.
 */

const STOPS = [
  { label: 'UNCOMPRESSED', align: 'start' as const },
  { label: '25%', align: 'center' as const },
  { label: '50%', align: 'center' as const },
  { label: '75%', align: 'center' as const },
  { label: 'MAX COMPRESSED', align: 'end' as const },
];

function labelPositionClass(align: 'start' | 'center' | 'end'): string {
  if (align === 'start') return 'left-0';
  if (align === 'end') return 'right-0';
  // center stops are positioned entirely by the inline style below
  return '';
}

type CompressionSliderProps = {
  /** Thumb position as a percentage along the track (0–100). */
  thumbPct?: number;
};

export function CompressionSlider({ thumbPct = 0 }: CompressionSliderProps) {
  return (
    <div className="w-full border-t border-seam">
      <div className="flex items-start pt-[49px] pb-12">
        <div className="h-12 w-16 shrink-0" />
        <div className="min-w-0 grow px-4">
          {/* Track */}
          <div className="slider-track relative h-2 w-full rounded-full">
            {/* Notches at 0 / 25 / 50 / 75 / 100% */}
            {[0, 25, 50, 75, 100].map((pct) => (
              <div
                key={pct}
                className="absolute top-[-4px] h-4 w-0.5 -translate-x-1/2 rounded-full bg-notch"
                style={{ left: `${pct}%` }}
              />
            ))}
            {/* Thumb positioned to reflect the rendered position (static) */}
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
                className={`absolute top-0 text-xs whitespace-nowrap text-faint ${labelPositionClass(stop.align)}`}
                style={
                  stop.align === 'center'
                    ? { left: `${i * 25}%`, transform: 'translateX(-50%)' }
                    : undefined
                }
              >
                {stop.label}
              </p>
            ))}
          </div>
        </div>
        <div className="h-12 w-64 shrink-0" />
      </div>
    </div>
  );
}
