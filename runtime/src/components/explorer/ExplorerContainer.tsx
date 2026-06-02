'use client';

import { useEffect, useState } from 'react';
import { ExplorerShell } from './ExplorerShell';
import { midPositionIndex, renderPosition } from '@/lib/tale-render';
import {
  parseTaleCache,
  SUPPORTED_SCHEMA_VERSION,
  type TaleCache,
} from '@/types/tale-cache';

/**
 * Client-side data binding for the explorer (Step 2).
 *
 * Per `runtime/CLAUDE.md`, tale JSON is fetched in the browser from
 * `public/tales/<slug>.json` (static export — no server fetch). This is why
 * the data-bound layer is a client component. It fetches the one hardcoded
 * LRRH cache, validates it against the schema, then renders one fixed
 * mid-slider position into the shell. Corpus *switching* is out of scope
 * (Step 7); the slug is hardcoded here.
 *
 * Loading / error handling is intentionally minimal — a null-guard skeleton.
 * Full loading / error / slow-network states are Phase 3.
 */

const TALE_SLUG = 'little-red-riding-hood';

export function ExplorerContainer() {
  const [cache, setCache] = useState<TaleCache | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/tales/${TALE_SLUG}.json`);
      const json: unknown = await res.json();
      const parsed = parseTaleCache(json);
      if (parsed.schema_version !== SUPPORTED_SCHEMA_VERSION) {
        // The runtime can refuse caches it does not understand. Richer
        // version-mismatch UX is out of Step 2 scope.
        throw new Error(
          `Unsupported tale-cache schema_version "${parsed.schema_version}" ` +
            `(runtime supports ${SUPPORTED_SCHEMA_VERSION}).`,
        );
      }
      if (!cancelled) setCache(parsed);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Minimal null-guard skeleton until the cache resolves.
  if (!cache) {
    return (
      <div
        className="flex h-screen min-w-[1024px] items-center justify-center bg-ground text-faint"
        aria-busy="true"
      >
        <span className="text-sm">Loading corpus…</span>
      </div>
    );
  }

  const positionIndex = midPositionIndex(cache);
  const rendered = renderPosition(cache, positionIndex);

  // Thumb reflects the chosen position across the slider's evenly-spaced
  // stops: position i of N positions sits at i / (N - 1) of the track.
  const positionCount = cache.positions.length;
  const thumbPct =
    positionCount > 1 ? (positionIndex / (positionCount - 1)) * 100 : 0;

  return (
    <ExplorerShell
      corpusTitle={cache.metadata.title}
      rendered={rendered}
      thumbPct={thumbPct}
    />
  );
}
