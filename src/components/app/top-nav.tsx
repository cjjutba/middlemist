import Link from 'next/link';
import { Bell } from 'lucide-react';
import { auth } from '@/lib/auth';
import { CommandPaletteTrigger } from './command-palette-trigger';
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
 * Cmd+K trigger wired up in 3E via CommandPaletteProvider context.
 *
 * The notification bell is still INERT — audit-log-derived notifications
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

        <CommandPaletteTrigger />

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
