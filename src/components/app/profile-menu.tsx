'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { logout } from '@/actions/auth';

type Props = {
  user: { email: string; name: string };
};

/**
 * Profile dropdown menu in the top nav.
 *
 * Avatar circle (initials) → opens a dropdown with email + Settings + Sign out.
 * Per docs/design/component-patterns.md {component.dropdown-menu}: white canvas,
 * hairline border, rounded-md, items in body-md. Click-outside to close.
 */
export function ProfileMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initials =
    user.name
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || user.email.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-label="Open profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="bg-surface-card text-ink hover:bg-surface-strong flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-medium transition-colors"
      >
        {initials}
      </button>
      {open && (
        <div
          role="menu"
          className="border-hairline bg-canvas absolute right-0 mt-2 w-56 rounded-md border py-1 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
        >
          <div className="px-3 py-2">
            <p className="text-ink text-[14px] font-medium">{user.name || 'Account'}</p>
            <p className="text-muted mt-0.5 text-[13px]">{user.email}</p>
          </div>
          <div className="border-hairline-soft my-1 border-t" />
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="text-ink hover:bg-surface-soft block rounded-sm px-3 py-2 text-[14px] transition-colors"
          >
            Settings
          </Link>
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="text-ink hover:bg-surface-soft w-full rounded-sm px-3 py-2 text-left text-[14px] transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
