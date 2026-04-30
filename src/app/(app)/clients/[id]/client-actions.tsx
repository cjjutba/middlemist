'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { archiveClient, deleteClient, unarchiveClient } from '@/actions/clients';
import { friendlyMessage } from '@/lib/utils/errors';

type Props = {
  clientId: string;
  archived: boolean;
};

export function ClientActions({ clientId, archived }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onArchiveToggle() {
    startTransition(async () => {
      const result = archived
        ? await unarchiveClient({ id: clientId })
        : await archiveClient({ id: clientId });
      if (!result.ok) {
        alert(friendlyMessage(result.error));
        return;
      }
      router.refresh();
    });
  }

  function onDelete() {
    if (!confirm('Delete this client permanently? This cannot be undone.')) return;
    startTransition(async () => {
      const result = await deleteClient({ id: clientId });
      if (!result.ok) {
        alert(friendlyMessage(result.error));
        return;
      }
      router.push('/clients');
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={onArchiveToggle} disabled={pending}>
        {archived ? 'Unarchive' : 'Archive'}
      </Button>
      <Button variant="destructive" onClick={onDelete} disabled={pending}>
        Delete
      </Button>
    </div>
  );
}
