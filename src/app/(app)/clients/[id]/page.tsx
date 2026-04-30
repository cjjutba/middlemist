import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { clientsRepo } from '@/lib/repositories/clients.repo';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { ClientActions } from './client-actions';

export const metadata = { title: 'Client · Middlemist' };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const client = await clientsRepo.findById(session.user.id, id);
  if (!client) notFound();

  return (
    <div className="px-6 py-10 lg:px-12 lg:py-14">
      <div className="mx-auto max-w-[1024px]">
        <Link href="/clients" className="text-muted hover:text-ink text-[13px] font-medium">
          ← Back to clients
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-ink text-[32px] leading-[1.2] font-semibold tracking-[-0.5px]">
                {client.name}
              </h1>
              {client.archivedAt ? <StatusPill tone="muted">Archived</StatusPill> : null}
            </div>
            {client.companyName ? (
              <p className="text-muted mt-1 text-[16px]">{client.companyName}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/clients/${client.id}/edit`}>
              <Button variant="secondary">Edit</Button>
            </Link>
            <ClientActions clientId={client.id} archived={Boolean(client.archivedAt)} />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="border-hairline-soft bg-canvas rounded-lg border p-6">
            <h2 className="text-ink text-[14px] font-semibold">Contact</h2>
            <dl className="mt-3 space-y-2 text-[14px]">
              <div className="flex">
                <dt className="text-muted w-24">Email</dt>
                <dd className="text-ink">{client.email}</dd>
              </div>
              {client.phone ? (
                <div className="flex">
                  <dt className="text-muted w-24">Phone</dt>
                  <dd className="text-ink">{client.phone}</dd>
                </div>
              ) : null}
              {client.website ? (
                <div className="flex">
                  <dt className="text-muted w-24">Website</dt>
                  <dd className="text-ink truncate">{client.website}</dd>
                </div>
              ) : null}
              {client.address ? (
                <div className="flex">
                  <dt className="text-muted w-24">Address</dt>
                  <dd className="text-ink whitespace-pre-line">{client.address}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          <div className="border-hairline-soft bg-canvas rounded-lg border p-6">
            <h2 className="text-ink text-[14px] font-semibold">Settings</h2>
            <dl className="mt-3 space-y-2 text-[14px]">
              <div className="flex">
                <dt className="text-muted w-32">Preferred currency</dt>
                <dd className="text-ink">{client.preferredCurrency ?? '—'}</dd>
              </div>
              {client.taxId ? (
                <div className="flex">
                  <dt className="text-muted w-32">Tax ID</dt>
                  <dd className="text-ink">{client.taxId}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>

        {client.notes ? (
          <div className="border-hairline-soft bg-canvas mt-6 rounded-lg border p-6">
            <h2 className="text-ink text-[14px] font-semibold">Notes</h2>
            <p className="text-body mt-2 text-[14px] leading-[1.6] whitespace-pre-line">
              {client.notes}
            </p>
          </div>
        ) : null}

        <div className="border-hairline-soft bg-surface-soft mt-10 rounded-lg border px-6 py-5">
          <p className="text-muted text-[13px]">
            Projects, proposals, and invoices for this client will appear here as those modules
            ship.
          </p>
        </div>
      </div>
    </div>
  );
}
