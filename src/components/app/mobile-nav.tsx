'use client';

import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { SidebarBody } from './app-sidebar';

/**
 * Mobile-only sidebar drawer.
 *
 * Hamburger button (rendered inside TopNav) opens a left-edge slide-in
 * drawer containing the same nav items as the desktop sidebar. Click
 * outside or Escape closes. Hidden at md and above (the desktop sidebar
 * takes over).
 */
export function MobileNavTrigger() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="text-ink hover:bg-surface-soft flex h-9 w-9 items-center justify-center rounded-md md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            role="presentation"
            aria-hidden
            className="bg-surface-dark/40 absolute inset-0"
            onClick={() => setOpen(false)}
          />
          <div className="bg-canvas absolute top-0 left-0 h-full w-[280px]">
            <div className="border-hairline-soft flex h-16 items-center justify-between border-b px-6">
              <span className="font-display text-ink text-[18px] font-semibold tracking-[-0.3px]">
                middlemist
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="text-ink hover:bg-surface-soft flex h-9 w-9 items-center justify-center rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(100%-4rem)]">
              <SidebarBody onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
