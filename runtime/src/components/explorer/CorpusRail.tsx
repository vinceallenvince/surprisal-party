import { LayoutGrid } from 'lucide-react';

/**
 * Left corpus-picker rail — maps to frame 28-163 node 28:182 (Container) with
 * its 64px-wide column and the dim picker icon (node 28:183) near the top.
 *
 * Static for Step 1: the button is rendered but not wired (the drawer it opens
 * arrives in Step 7). The scenario calls for a "small, dim corpus-picker icon
 * at the top-left of the content row".
 */
export function CorpusRail() {
  return (
    <div className="flex h-full w-16 shrink-0 justify-center border-r border-seam pt-12">
      <button
        type="button"
        aria-label="Open corpus picker"
        className="flex size-9 items-center justify-center p-2 text-faint"
      >
        <LayoutGrid className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
