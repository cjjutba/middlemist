import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { clientsRepo } from '@/lib/repositories/clients.repo';
import { projectsRepo } from '@/lib/repositories/projects.repo';
import type { CreateProjectInputZ } from '@/lib/schemas/project.schema';
import { ProjectForm } from '../../new/project-form';

export const metadata = { title: 'Edit project · Middlemist' };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const project = await projectsRepo.findById(session.user.id, id);
  if (!project) notFound();

  // Archived projects are read-only; bounce back to the detail page.
  if (project.archivedAt) redirect(`/projects/${project.id}`);

  const clients = await clientsRepo.list(session.user.id);

  // Form fields are strings (HTML input values); convert from row shape.
  const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
  const defaults: Partial<CreateProjectInputZ> = {
    clientId: project.clientId,
    name: project.name,
    currency: project.currency,
    // Archived projects redirect above, so project.status is always one of
    // 'active' | 'on_hold' | 'completed' here. The form schema rejects
    // 'archived' anyway (see SELECTABLE_STATUSES).
    status: project.status as CreateProjectInputZ['status'],
    ...(project.description ? { description: project.description } : {}),
    ...(project.startedAt ? { startedAt: isoDate(project.startedAt) } : {}),
    ...(project.endedAt ? { endedAt: isoDate(project.endedAt) } : {}),
    ...(project.budgetAmount ? { budgetAmount: project.budgetAmount.toString() } : {}),
  };

  return (
    <div className="px-6 py-10 lg:px-12 lg:py-14">
      <div className="mx-auto max-w-[640px]">
        <Link
          href={`/projects/${project.id}`}
          className="text-muted hover:text-ink text-[13px] font-medium"
        >
          ← Back to {project.name}
        </Link>
        <h1 className="font-display text-ink mt-3 text-[28px] leading-[1.2] font-semibold tracking-[-0.5px]">
          Edit project
        </h1>
        <div className="mt-8">
          <ProjectForm
            mode="edit"
            projectId={project.id}
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            defaults={defaults}
          />
        </div>
      </div>
    </div>
  );
}
