import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { act, render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { LoadingScreen } from './LoadingScreen';

// The component resolves its boot mode + kicks off its driver inside a rAF (run
// synchronously by the stub below), which sets state during the initial mount.
// Wrap the render in act so that setState is flushed cleanly.
function render(ui: ReactElement) {
  let result: ReturnType<typeof rtlRender>;
  act(() => {
    result = rtlRender(ui);
  });
  return result!;
}

/**
 * Loading-screen behaviour (the boot ceremony). Authority is the `## Loading`
 * section of `user-scenarios.md`.
 *
 * The state machine is timer-driven, so we use fake timers and step them
 * explicitly. The component also resolves its boot mode + kicks off its driver
 * inside a `requestAnimationFrame` after mount, so the helpers flush a rAF
 * before advancing the timers. jsdom lacks `matchMedia` and `rAF`; both are
 * stubbed. `data-phase` / `data-dropped` on the root are the deterministic
 * signals the e2e capture also keys on.
 */

let reduceMatches = false;

beforeAll(() => {
  // The reduced-motion hook reads matchMedia; default to no-preference and let
  // individual tests flip `reduceMatches` before render.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('reduce') ? reduceMatches : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

beforeEach(() => {
  reduceMatches = false;
  vi.useFakeTimers();
  // The driver kicks off inside a rAF; run it synchronously so the timeline
  // starts right after mount, then fake timers carry it.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  // Default boot mode (timed ceremony) — no ?boot= param.
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  // Flush any timers still queued by an in-flight timeline inside act so the
  // resulting setState doesn't warn about updates outside act after teardown.
  act(() => {
    vi.runOnlyPendingTimers();
  });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function root() {
  return document.querySelector('[data-loading-screen]') as HTMLElement;
}

/** Advance fake timers by `ms`, wrapped in act so state flushes. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('LoadingScreen — full ceremony', () => {
  it('renders the full annotated phrase with superscripts and a coral kernel', () => {
    render(
      <LoadingScreen loaded={false} abbreviated={false} onComplete={vi.fn()} />,
    );
    // All six words present at the hold.
    for (const w of ['we', 'threw', 'you', 'a', 'surprisal', 'party']) {
      expect(screen.getByText(w)).toBeInTheDocument();
    }
    // Surprisal superscripts.
    for (const n of ['2', '7', '3', '1', '20', '18']) {
      expect(screen.getByText(n)).toBeInTheDocument();
    }
    // The two kernel words carry the coral marker; non-kernel words do not.
    expect(root().querySelector('[data-token="surprisal"]')).toHaveAttribute(
      'data-kernel',
      'true',
    );
    expect(root().querySelector('[data-token="party"]')).toHaveAttribute(
      'data-kernel',
      'true',
    );
    expect(root().querySelector('[data-token="we"]')).toHaveAttribute(
      'data-kernel',
      'false',
    );
    // Starts on the held full phrase.
    expect(root()).toHaveAttribute('data-phase', 'hold');
    expect(root()).toHaveAttribute('data-dropped', '');
  });

  it('hard-cuts the words in ascending surprisal order: a → we → you → threw', () => {
    render(
      <LoadingScreen loaded={false} abbreviated={false} onComplete={vi.fn()} />,
    );
    // hold = 2000ms, then drops on a 450ms interval.
    advance(2000); // first drop fires at the end of hold
    expect(root()).toHaveAttribute('data-dropped', 'a');
    expect(screen.queryByText('a')).not.toBeInTheDocument();
    expect(screen.getByText('we')).toBeInTheDocument();

    advance(450);
    expect(root()).toHaveAttribute('data-dropped', 'a,we');
    expect(screen.queryByText('we')).not.toBeInTheDocument();

    advance(450);
    expect(root()).toHaveAttribute('data-dropped', 'a,we,you');
    expect(screen.queryByText('you')).not.toBeInTheDocument();

    advance(450);
    expect(root()).toHaveAttribute('data-dropped', 'a,we,you,threw');
    expect(screen.queryByText('threw')).not.toBeInTheDocument();

    // The kernel survives.
    expect(screen.getByText('surprisal')).toBeInTheDocument();
    expect(screen.getByText('party')).toBeInTheDocument();
  });

  it('rests on the kernel until `loaded` flips true, then settles', () => {
    const { rerender } = render(
      <LoadingScreen loaded={false} abbreviated={false} onComplete={vi.fn()} />,
    );
    // Run through the hold + all four drops + into the rest gate.
    advance(2000 + 450 * 4);
    expect(root()).toHaveAttribute('data-phase', 'rest');

    // While unloaded, keep resting on the kernel no matter how long.
    advance(5000);
    expect(root()).toHaveAttribute('data-phase', 'rest');

    // Flip loaded → the gate releases on the next poll → settle.
    act(() => {
      rerender(
        <LoadingScreen loaded={true} abbreviated={false} onComplete={vi.fn()} />,
      );
    });
    advance(100); // the 80ms poll picks up the flip
    expect(root()).toHaveAttribute('data-phase', 'settle');
    // Settle is ordered: the superscripts fade first (data-settle=fading), then
    // collapse (data-settle=collapsed) so the kernel words slide together.
    expect(root()).toHaveAttribute('data-settle', 'fading');
    advance(150); // settleFade elapses → width collapse begins
    expect(root()).toHaveAttribute('data-settle', 'collapsed');
  });

  it('fires onComplete after the exit fade', () => {
    const onComplete = vi.fn();
    render(
      <LoadingScreen loaded={true} abbreviated={false} onComplete={onComplete} />,
    );
    // hold + 4 drops + rest(immediately released, loaded=true) + settle + kernelHold + exit.
    advance(2000 + 450 * 4); // → rest, immediately settle (loaded already true)
    advance(100); // rest poll releases → settle (fade stage)
    expect(root()).toHaveAttribute('data-phase', 'settle');
    expect(root()).toHaveAttribute('data-settle', 'fading');
    advance(150); // settleFade → collapse stage
    expect(root()).toHaveAttribute('data-settle', 'collapsed');
    advance(150); // settleCollapse → kernelHold
    expect(root()).toHaveAttribute('data-phase', 'kernelHold');
    advance(2000); // kernelHold → exit
    expect(root()).toHaveAttribute('data-phase', 'exit');
    expect(onComplete).not.toHaveBeenCalled();
    advance(400); // exit fade → done + onComplete
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(root()).toHaveAttribute('data-phase', 'done');
  });
});

describe('LoadingScreen — abbreviated timeline', () => {
  it('reaches the rest gate faster than the full timeline', () => {
    render(
      <LoadingScreen loaded={false} abbreviated={true} onComplete={vi.fn()} />,
    );
    // Abbreviated: hold 500 + drops on 200ms.
    advance(500);
    expect(root()).toHaveAttribute('data-dropped', 'a');
    advance(200 * 3);
    expect(root()).toHaveAttribute('data-dropped', 'a,we,you,threw');
    advance(200); // last interval → rest
    expect(root()).toHaveAttribute('data-phase', 'rest');

    // The full timeline would still be mid-collapse at this elapsed time
    // (hold 2000 alone exceeds it), confirming abbreviated is faster.
  });
});

describe('LoadingScreen — reduced motion', () => {
  it('crossfades the full phrase straight to the clean kernel (no staged drops)', () => {
    reduceMatches = true;
    render(
      <LoadingScreen loaded={true} abbreviated={false} onComplete={vi.fn()} />,
    );
    // No intermediate single-word drop: still the full phrase during the hold.
    expect(root()).toHaveAttribute('data-dropped', '');
    expect(screen.getByText('we')).toBeInTheDocument();

    // After the hold, ALL droppable words are gone at once (crossfade), never
    // one-at-a-time, and the gate releases into settle (loaded already true).
    advance(2000);
    expect(root()).toHaveAttribute('data-dropped', 'a,we,you,threw');
    expect(screen.queryByText('we')).not.toBeInTheDocument();
    expect(screen.getByText('surprisal')).toBeInTheDocument();
    advance(100); // rest gate releases → settle
    expect(root()).toHaveAttribute('data-phase', 'settle');
  });
});

describe('LoadingScreen — ?boot=manual step hook', () => {
  it('advances exactly one named state per window.__boot.next() call', () => {
    window.history.replaceState({}, '', '/?boot=manual');
    const onComplete = vi.fn();
    render(
      <LoadingScreen loaded={true} abbreviated={false} onComplete={onComplete} />,
    );
    // Timers are suspended; the hook drives the machine. The rAF already ran
    // (synchronous stub), attaching the hook.
    expect(window.__boot).toBeTruthy();

    // Full phrase held; nothing dropped yet.
    expect(root()).toHaveAttribute('data-dropped', '');

    const next = () => act(() => window.__boot!.next());

    next(); // drop a
    expect(root()).toHaveAttribute('data-dropped', 'a');
    next(); // drop we
    expect(root()).toHaveAttribute('data-dropped', 'a,we');
    next(); // drop you
    next(); // drop threw
    expect(root()).toHaveAttribute('data-dropped', 'a,we,you,threw');
    next(); // rest
    expect(root()).toHaveAttribute('data-phase', 'rest');
    next(); // settle: fade stage
    expect(root()).toHaveAttribute('data-phase', 'settle');
    expect(root()).toHaveAttribute('data-settle', 'fading');
    next(); // settle: collapse stage (kernel words slide together)
    expect(root()).toHaveAttribute('data-settle', 'collapsed');
    next(); // kernelHold
    expect(root()).toHaveAttribute('data-phase', 'kernelHold');
    next(); // exit
    expect(root()).toHaveAttribute('data-phase', 'exit');
    next(); // done + onComplete
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(root()).toHaveAttribute('data-phase', 'done');
  });
});

describe('LoadingScreen — ?boot=stall', () => {
  it('runs the timeline but rests on the kernel forever (loaded pinned false)', () => {
    window.history.replaceState({}, '', '/?boot=stall');
    render(
      <LoadingScreen loaded={true} abbreviated={false} onComplete={vi.fn()} />,
    );
    advance(2000 + 450 * 4); // hold + all drops → rest
    expect(root()).toHaveAttribute('data-dropped', 'a,we,you,threw');
    expect(root()).toHaveAttribute('data-phase', 'rest');
    // Even though the prop says loaded, stall pins the gate false → stays at rest.
    advance(10000);
    expect(root()).toHaveAttribute('data-phase', 'rest');
  });
});
