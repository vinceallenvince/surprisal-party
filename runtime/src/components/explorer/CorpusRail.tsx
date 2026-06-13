import { LayoutGrid } from 'lucide-react';

/**
 * Left corpus-picker rail — maps to frame 28-163 node 28:182 (Container) with
 * its 64px-wide column and the dim picker icon (node 28:183) near the top.
 *
 * The icon is the corpus-picker drawer's summon affordance (Step 6): clicking
 * it toggles the drawer. `aria-expanded` reflects the drawer's open state and
 * `aria-haspopup="dialog"` advertises that it opens a dialog. The parent owns
 * the open/closed state and passes `expanded` + `onToggle`.
 */
export function CorpusRail({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="hidden h-full w-16 shrink-0 justify-center border-r border-seam pt-12 md:flex">
      <button
        type="button"
        aria-label="Open corpus picker"
        aria-haspopup="dialog"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex size-9 items-center justify-center p-2 text-faint hover:text-muted"
      >
        <LayoutGrid className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
