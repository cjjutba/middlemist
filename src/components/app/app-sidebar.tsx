'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Briefcase,
  Calendar,
  Clock,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * App Shell sidebar.
 *
 * Per docs/design/layout-patterns.md and docs/design/component-patterns.md:
 *   220px wide, canvas, hairline right border.
 *   Sections: Workspace (Today, Dashboard), Records (Clients, Projects,
 *   Proposals, Invoices), Tracking (Time), Settings.
 *   Section captions: caption typography (13px, weight 500), uppercase
 *   tracked, muted-soft.
 *   Item: 8 × 12 padding, Inter 500 14px, body color, rounded-md, with a
 *   16px Lucide icon.
 *   Active item: surface-card background, ink text.
 *
 * Hidden below md (the MobileNav drawer takes over). The full
 * three-state responsive (220px → 60px icon rail at md → drawer below md)
 * is queued for a polish pass; v1 ships with the simpler two-state.
 */

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/today', label: 'Today', icon: Calendar },
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Records',
    items: [
      { href: '/clients', label: 'Clients', icon: Users },
      { href: '/projects', label: 'Projects', icon: Briefcase },
      { href: '/proposals', label: 'Proposals', icon: FileText },
      { href: '/invoices', label: 'Invoices', icon: Receipt },
    ],
  },
  {
    label: 'Tracking',
    items: [{ href: '/time', label: 'Time', icon: Clock }],
  },
  {
    label: 'Settings',
    items: [{ href: '/settings', label: 'Settings', icon: Settings }],
  },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SectionGroup({
  section,
  pathname,
  onNavigate,
}: {
  section: NavSection;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div>
      {section.label ? (
        <p className="text-muted-soft px-3 pb-1.5 text-[13px] font-medium tracking-wider uppercase">
          {section.label}
        </p>
      ) : null}
      <ul className="space-y-0.5">
        {section.items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                {...(onNavigate ? { onClick: onNavigate } : {})}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] font-medium transition-colors',
                  active
                    ? 'bg-surface-card text-ink'
                    : 'text-body hover:bg-surface-soft hover:text-ink',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The sidebar's nav body. Reused by both desktop sidebar and mobile drawer. */
export function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-6">
      {SECTIONS.map((section) => (
        <SectionGroup
          key={section.label ?? 'unlabeled'}
          section={section}
          pathname={pathname}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ))}
    </nav>
  );
}

/** Desktop sidebar wrapper. Hidden below md. */
export function AppSidebar() {
  return (
    <aside className="border-hairline bg-canvas hidden h-[calc(100vh-4rem)] w-[220px] flex-shrink-0 border-r md:block">
      <SidebarBody />
    </aside>
  );
}
