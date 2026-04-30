import Link from 'next/link';
import { Bell, Search } from 'lucide-react';
import { auth } from '@/lib/auth';
import { ProfileMenu } from './profile-menu';
import { MobileNavTrigger } from './mobile-nav';

/**
 * Top navigation bar for the authenticated app shell.
 *
 * Per docs/design/component-patterns.md {component.top-nav}:
 *   64px tall, canvas, hairline-soft bottom border.
 *   Three regions: wordmark left, command palette trigger center,
 *   notification bell + profile menu right.
 *
 * The Cmd+K trigger is INERT in 3A — wired up in 3E. Per
 * docs/design/component-patterns.md the trigger is a pill
 * (rounded-pill) ~240px wide with a leading search icon.
 *
 * The notification bell is INERT in 3A. Audit-log-derived notifications
 * arrive in week 13.
 */
export async function TopNav() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <header className="border-hairline-soft bg-canvas border-b">
      <nav className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-2">
          <MobileNavTrigger />
          <Link
            href="/dashboard"
            className="font-display text-ink text-[18px] font-semibold tracking-[-0.3px]"
          >
            middlemist
          </Link>
        </div>

        <button
          type="button"
          disabled
          aria-label="Open command palette"
          className="rounded-pill border-hairline bg-surface-soft text-muted hidden h-9 w-[240px] cursor-not-allowed items-center gap-2 border px-3 text-[13px] opacity-70 sm:flex"
        >
          <Search className="h-4 w-4" />
          <span>Search or jump to…</span>
          <span className="border-hairline-soft bg-canvas text-muted-soft ml-auto rounded-sm border px-1.5 py-0.5 text-[11px] font-medium">
            ⌘K
          </span>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="border-hairline bg-canvas text-ink hover:bg-surface-soft relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
          >
            <Bell className="h-4 w-4" />
          </button>
          <ProfileMenu user={{ email: session.user.email ?? '', name: session.user.name ?? '' }} />
        </div>
      </nav>
    </header>
  );
}
