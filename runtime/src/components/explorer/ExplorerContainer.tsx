'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExplorerShell } from './ExplorerShell';
import { renderPosition } from '@/lib/tale-render';
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
 * Step 3 lifts the slider's selected position into this container: a single
 * `selectedPositionIndex` (0–4, default 0 = UNCOMPRESSED) drives both the
 * re-derived `renderPosition` output and the controlled slider. Position swaps
 * are instantaneous (no animation — that is Step 4).
 *
 * Loading / error handling is intentionally minimal — a null-guard skeleton.
 * Full loading / error / slow-network states are Phase 3.
 */

const TALE_SLUG = 'little-red-riding-hood';

export function ExplorerContainer() {
  const [cache, setCache] = useState<TaleCache | null>(null);
  // Default to UNCOMPRESSED (far left, index 0). The slider is the only writer.
  const [selectedPositionIndex, setSelectedPositionIndex] = useState(0);

  const handlePositionChange = useCallback((index: number) => {
    setSelectedPositionIndex(index);
  }, []);

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

  // Clamp defensively in case a cache ever ships fewer positions than the
  // slider's five stops; the derivation is re-run per selected index.
  const positionIndex = Math.min(
    selectedPositionIndex,
    cache.positions.length - 1,
  );
  const rendered = renderPosition(cache, positionIndex);

  return (
    <ExplorerShell
      corpusTitle={cache.metadata.title}
      rendered={rendered}
      selectedIndex={positionIndex}
      onPositionChange={handlePositionChange}
    />
  );
}
