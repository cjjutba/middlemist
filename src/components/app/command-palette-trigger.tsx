'use client';

import { Search } from 'lucide-react';
import { useCommandPalette } from './command-palette-provider';

/**
 * Top-nav search button. Opens the command palette via context (the
 * provider also installs the global Cmd+K / Ctrl+K shortcut).
 */
export function CommandPaletteTrigger() {
  const { open } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open command palette"
      className="rounded-pill border-hairline bg-surface-soft text-muted hover:bg-surface-card hover:text-ink hidden h-9 w-[240px] items-center gap-2 border px-3 text-[13px] transition-colors sm:flex"
    >
      <Search className="h-4 w-4" />
      <span>Search or jump to…</span>
      <span className="border-hairline-soft bg-canvas text-muted-soft ml-auto rounded-sm border px-1.5 py-0.5 text-[11px] font-medium">
        ⌘K
      </span>
    </button>
  );
}
