'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { archiveProject, setProjectStatus, unarchiveProject } from '@/actions/projects';
import { friendlyMessage } from '@/lib/utils/errors';

const NEXT_TOGGLE: Record<string, { label: string; status: 'active' | 'on_hold' }> = {
  active: { label: 'Pause', status: 'on_hold' },
  on_hold: { label: 'Resume', status: 'active' },
};

type Props = {
  projectId: string;
  currentStatus: string;
  archived: boolean;
};

export function ProjectActions({ projectId, currentStatus, archived }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = NEXT_TOGGLE[currentStatus];

  function onToggle() {
    if (!next) return;
    startTransition(async () => {
      const r = await setProjectStatus({ id: projectId, status: next.status });
      if (!r.ok) alert(friendlyMessage(r.error));
      router.refresh();
    });
  }

  function onComplete() {
    startTransition(async () => {
      const r = await setProjectStatus({ id: projectId, status: 'completed' });
      if (!r.ok) alert(friendlyMessage(r.error));
      router.refresh();
    });
  }

  function onArchiveToggle() {
    startTransition(async () => {
      const r = archived
        ? await unarchiveProject({ id: projectId })
        : await archiveProject({ id: projectId });
      if (!r.ok) alert(friendlyMessage(r.error));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!archived && next ? (
        <Button variant="secondary" onClick={onToggle} disabled={pending}>
          {next.label}
        </Button>
      ) : null}
      {!archived && currentStatus !== 'completed' ? (
        <Button variant="secondary" onClick={onComplete} disabled={pending}>
          Mark complete
        </Button>
      ) : null}
      <Button variant="text" onClick={onArchiveToggle} disabled={pending}>
        {archived ? 'Unarchive' : 'Archive'}
      </Button>
    </div>
  );
}
