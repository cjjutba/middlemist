import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Briefcase, Plus } from 'lucide-react';
import { auth } from '@/lib/auth';
import { clientsRepo } from '@/lib/repositories/clients.repo';
import { projectsRepo } from '@/lib/repositories/projects.repo';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/utils/cn';
import { PROJECT_STATUSES, type ProjectStatusValue } from '@/lib/schemas/project.schema';

export const metadata = { title: 'Projects · Middlemist' };

const STATUS_LABELS: Record<ProjectStatusValue, string> = {
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  archived: 'Archived',
};

const STATUS_TONES: Record<ProjectStatusValue, 'success' | 'warning' | 'neutral' | 'muted'> = {
  active: 'success',
  on_hold: 'warning',
  completed: 'neutral',
  archived: 'muted',
};

type SearchParams = { status?: string };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const params = await searchParams;
  const statusFilter: ProjectStatusValue =
    params.status && (PROJECT_STATUSES as readonly string[]).includes(params.status)
      ? (params.status as ProjectStatusValue)
      : 'active';
  const isArchivedView = statusFilter === 'archived';

  const [projects, allClients] = await Promise.all([
    isArchivedView
      ? projectsRepo.list(session.user.id, { includeArchived: true })
      : projectsRepo.list(session.user.id, {
          status: statusFilter,
          includeArchived: false,
        }),
    clientsRepo.list(session.user.id),
  ]);

  const filtered = isArchivedView ? projects.filter((p) => p.archivedAt !== null) : projects;
  const clientNameById = new Map(allClients.map((c) => [c.id, c.name]));
  const clientCount = allClients.length;
  const isEmpty = filtered.length === 0;

  return (
    <div className="px-6 py-10 lg:px-12 lg:py-14">
      <div className="mx-auto max-w-[1024px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-ink text-[32px] leading-[1.2] font-semibold tracking-[-0.5px]">
              Projects
            </h1>
            <p className="text-muted mt-1 text-[14px]">
              The work itself. Tasks, time, and updates attach here.
            </p>
          </div>
          {clientCount > 0 ? (
            <Link href="/projects/new">
              <Button variant="primary">
                <Plus className="h-4 w-4" />
                New project
              </Button>
            </Link>
          ) : null}
        </div>

        <div className="rounded-pill bg-surface-soft mt-8 flex w-fit items-center gap-1 overflow-x-auto p-1">
          {PROJECT_STATUSES.map((s) => {
            const isActive = statusFilter === s;
            return (
              <Link
                key={s}
                href={`/projects?status=${s}`}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-canvas text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                    : 'text-muted hover:text-ink',
                )}
              >
                {STATUS_LABELS[s]}
              </Link>
            );
          })}
        </div>

        <div className="mt-6">
          {isEmpty && clientCount === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Add a client first"
              description="Projects belong to clients. Add a client and you can start your first project."
              action={
                <Link href="/clients/new">
                  <Button variant="primary">Add a client</Button>
                </Link>
              }
            />
          ) : null}
          {isEmpty && clientCount > 0 && statusFilter === 'active' ? (
            <EmptyState
              icon={Briefcase}
              title="No active projects"
              description="Create your first project and start tracking the work."
              action={
                <Link href="/projects/new">
                  <Button variant="primary">New project</Button>
                </Link>
              }
            />
          ) : null}
          {isEmpty && clientCount > 0 && statusFilter !== 'active' ? (
            <EmptyState
              title="Nothing here"
              description={`No projects in the ${STATUS_LABELS[statusFilter].toLowerCase()} state.`}
            />
          ) : null}
          {!isEmpty ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group border-hairline-soft bg-canvas hover:bg-surface-soft block rounded-lg border p-5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-ink text-[16px] font-semibold group-hover:underline">
                      {project.name}
                    </h2>
                    <StatusPill tone={STATUS_TONES[project.status as ProjectStatusValue]}>
                      {STATUS_LABELS[project.status as ProjectStatusValue] ?? project.status}
                    </StatusPill>
                  </div>
                  <p className="text-muted mt-1 text-[13px]">
                    {clientNameById.get(project.clientId) ?? '—'}
                  </p>
                  {project.description ? (
                    <p className="text-body mt-3 line-clamp-2 text-[13px] leading-[1.5]">
                      {project.description}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
