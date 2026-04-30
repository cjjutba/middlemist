import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { clientsRepo } from '@/lib/repositories/clients.repo';
import type { CreateClientInput } from '@/lib/schemas/client.schema';
import { ClientForm } from '../../new/client-form';

export const metadata = { title: 'Edit client · Middlemist' };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const client = await clientsRepo.findById(session.user.id, id);
  if (!client) notFound();

  const defaults: Partial<CreateClientInput> = {
    name: client.name,
    email: client.email,
    ...(client.companyName ? { companyName: client.companyName } : {}),
    ...(client.phone ? { phone: client.phone } : {}),
    ...(client.website ? { website: client.website } : {}),
    ...(client.address ? { address: client.address } : {}),
    ...(client.taxId ? { taxId: client.taxId } : {}),
    ...(client.notes ? { notes: client.notes } : {}),
    ...(client.preferredCurrency ? { preferredCurrency: client.preferredCurrency } : {}),
  };

  return (
    <div className="px-6 py-10 lg:px-12 lg:py-14">
      <div className="mx-auto max-w-[640px]">
        <Link
          href={`/clients/${client.id}`}
          className="text-muted hover:text-ink text-[13px] font-medium"
        >
          ← Back to {client.name}
        </Link>
        <h1 className="font-display text-ink mt-3 text-[28px] leading-[1.2] font-semibold tracking-[-0.5px]">
          Edit client
        </h1>
        <div className="mt-8">
          <ClientForm mode="edit" clientId={client.id} defaults={defaults} />
        </div>
      </div>
    </div>
  );
}
