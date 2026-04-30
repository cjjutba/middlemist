import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import { auth } from '@/lib/auth';
import { clientsRepo } from '@/lib/repositories/clients.repo';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProjectForm } from './project-form';

export const metadata = { title: 'New project · Middlemist' };

export default async function NewProjectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const clients = await clientsRepo.list(session.user.id);

  return (
    <div className="px-6 py-10 lg:px-12 lg:py-14">
      <div className="mx-auto max-w-[640px]">
        <Link href="/projects" className="text-muted hover:text-ink text-[13px] font-medium">
          ← Back to projects
        </Link>
        <h1 className="font-display text-ink mt-3 text-[28px] leading-[1.2] font-semibold tracking-[-0.5px]">
          New project
        </h1>

        <div className="mt-8">
          {clients.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Add a client first"
              description="Projects belong to clients. Add one and come back."
              action={
                <Link href="/clients/new">
                  <Button variant="primary">Add a client</Button>
                </Link>
              }
            />
          ) : (
            <ProjectForm mode="create" clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
          )}
        </div>
      </div>
    </div>
  );
}
