import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { clientsRepo } from '@/lib/repositories/clients.repo';
import { projectsRepo } from '@/lib/repositories/projects.repo';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import type { ProjectStatusValue } from '@/lib/schemas/project.schema';
import { ProjectActions } from './project-actions';

export const metadata = { title: 'Project · Middlemist' };

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

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'time', label: 'Time' },
  { key: 'updates', label: 'Updates' },
  { key: 'proposals', label: 'Proposals' },
  { key: 'invoices', label: 'Invoices' },
];

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const project = await projectsRepo.findById(session.user.id, id);
  if (!project) notFound();

  const client = await clientsRepo.findById(session.user.id, project.clientId);
  const status = project.status as ProjectStatusValue;

  return (
    <div className="px-6 py-10 lg:px-12 lg:py-14">
      <div className="mx-auto max-w-[1024px]">
        <Link href="/projects" className="text-muted hover:text-ink text-[13px] font-medium">
          ← Back to projects
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-ink text-[32px] leading-[1.2] font-semibold tracking-[-0.5px]">
                {project.name}
              </h1>
              <StatusPill tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</StatusPill>
            </div>
            <p className="text-muted mt-1 text-[14px]">
              {client ? (
                <Link href={`/clients/${client.id}`} className="hover:text-ink hover:underline">
                  {client.name}
                </Link>
              ) : (
                <span>—</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/projects/${project.id}/edit`}>
              <Button variant="secondary">Edit</Button>
            </Link>
            <ProjectActions
              projectId={project.id}
              currentStatus={project.status}
              archived={Boolean(project.archivedAt)}
            />
          </div>
        </div>

        <div className="border-hairline-soft mt-8 border-b">
          <nav className="flex gap-6 overflow-x-auto">
            {TABS.map((t) => {
              const isActive = t.key === 'overview';
              return (
                <span
                  key={t.key}
                  className={`relative pb-3 text-[14px] font-medium whitespace-nowrap transition-colors ${
                    isActive ? 'text-ink' : 'text-muted'
                  }`}
                >
                  {t.label}
                  {isActive ? (
                    <span className="bg-primary absolute right-0 -bottom-px left-0 h-[2px]" />
                  ) : null}
                </span>
              );
            })}
          </nav>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="border-hairline-soft bg-canvas rounded-lg border p-6">
            <h2 className="text-ink text-[14px] font-semibold">Schedule</h2>
            <dl className="mt-3 space-y-2 text-[14px]">
              <div className="flex">
                <dt className="text-muted w-24">Start</dt>
                <dd className="text-ink">
                  {project.startedAt ? new Date(project.startedAt).toLocaleDateString() : '—'}
                </dd>
              </div>
              <div className="flex">
                <dt className="text-muted w-24">End</dt>
                <dd className="text-ink">
                  {project.endedAt ? new Date(project.endedAt).toLocaleDateString() : '—'}
                </dd>
              </div>
            </dl>
          </div>
          <div className="border-hairline-soft bg-canvas rounded-lg border p-6">
            <h2 className="text-ink text-[14px] font-semibold">Budget</h2>
            <dl className="mt-3 space-y-2 text-[14px]">
              <div className="flex">
                <dt className="text-muted w-24">Currency</dt>
                <dd className="text-ink">{project.currency}</dd>
              </div>
              <div className="flex">
                <dt className="text-muted w-24">Amount</dt>
                <dd className="text-ink tabular">
                  {project.budgetAmount ? project.budgetAmount.toString() : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {project.description ? (
          <div className="border-hairline-soft bg-canvas mt-6 rounded-lg border p-6">
            <h2 className="text-ink text-[14px] font-semibold">Description</h2>
            <p className="text-body mt-2 text-[14px] leading-[1.6] whitespace-pre-line">
              {project.description}
            </p>
          </div>
        ) : null}

        <div className="border-hairline-soft bg-surface-soft mt-10 rounded-lg border px-6 py-5">
          <p className="text-muted text-[13px]">
            Tasks, time, updates, proposals, and invoices for this project will appear here as those
            modules ship.
          </p>
        </div>
      </div>
    </div>
  );
}
