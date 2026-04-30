import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Users } from 'lucide-react';
import { auth } from '@/lib/auth';
import { clientsRepo } from '@/lib/repositories/clients.repo';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/utils/cn';

export const metadata = { title: 'Clients · Middlemist' };

type SearchParams = { archived?: string; q?: string };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const params = await searchParams;
  const includeArchived = params.archived === 'true';
  const search = params.q?.trim() || undefined;

  const clients = await clientsRepo.list(session.user.id, {
    includeArchived,
    ...(search ? { search } : {}),
  });

  // The list with includeArchived=true returns active+archived together; for
  // an "Archived" view we filter to only-archived in memory.
  const filtered = includeArchived ? clients.filter((c) => c.archivedAt !== null) : clients;
  const isEmpty = filtered.length === 0;
  const isFiltered = includeArchived || Boolean(search);

  return (
    <div className="px-6 py-10 lg:px-12 lg:py-14">
      <div className="mx-auto max-w-[1024px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-ink text-[32px] leading-[1.2] font-semibold tracking-[-0.5px]">
              Clients
            </h1>
            <p className="text-muted mt-1 text-[14px]">
              Everyone you bill, and everyone whose work you track.
            </p>
          </div>
          <Link href="/clients/new">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              New client
            </Button>
          </Link>
        </div>

        <div className="rounded-pill bg-surface-soft mt-8 flex w-fit items-center gap-1 p-1">
          <Link
            href="/clients"
            className={cn(
              'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
              !includeArchived
                ? 'bg-canvas text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                : 'text-muted hover:text-ink',
            )}
          >
            Active
          </Link>
          <Link
            href="/clients?archived=true"
            className={cn(
              'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
              includeArchived
                ? 'bg-canvas text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                : 'text-muted hover:text-ink',
            )}
          >
            Archived
          </Link>
        </div>

        <div className="mt-6">
          {isEmpty && !isFiltered ? (
            <EmptyState
              icon={Users}
              title="No clients yet"
              description="Add your first client to start sending proposals and tracking work."
              action={
                <Link href="/clients/new">
                  <Button variant="primary">Add your first client</Button>
                </Link>
              }
            />
          ) : null}
          {isEmpty && isFiltered ? (
            <EmptyState
              title="Nothing here"
              description={
                includeArchived ? 'No archived clients.' : 'Nothing matched your search.'
              }
            />
          ) : null}
          {!isEmpty ? (
            <div className="border-hairline-soft bg-canvas overflow-hidden rounded-lg border">
              <table className="w-full">
                <thead className="border-hairline-soft bg-surface-soft border-b">
                  <tr>
                    <th className="text-muted px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase">
                      Name
                    </th>
                    <th className="text-muted px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase">
                      Company
                    </th>
                    <th className="text-muted px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase">
                      Email
                    </th>
                    <th className="text-muted px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client) => (
                    <tr
                      key={client.id}
                      className="border-hairline-soft hover:bg-surface-soft border-b last:border-0"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/clients/${client.id}`}
                          className="text-ink text-[14px] font-medium hover:underline"
                        >
                          {client.name}
                        </Link>
                      </td>
                      <td className="text-body px-4 py-3 text-[14px]">
                        {client.companyName ?? '—'}
                      </td>
                      <td className="text-body px-4 py-3 text-[14px]">{client.email}</td>
                      <td className="px-4 py-3">
                        {client.archivedAt ? <StatusPill tone="muted">Archived</StatusPill> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
