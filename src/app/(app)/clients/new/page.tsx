import Link from 'next/link';
import { ClientForm } from './client-form';

export const metadata = { title: 'New client · Middlemist' };

export default function NewClientPage() {
  return (
    <div className="px-6 py-10 lg:px-12 lg:py-14">
      <div className="mx-auto max-w-[640px]">
        <Link href="/clients" className="text-muted hover:text-ink text-[13px] font-medium">
          ← Back to clients
        </Link>
        <h1 className="font-display text-ink mt-3 text-[28px] leading-[1.2] font-semibold tracking-[-0.5px]">
          New client
        </h1>
        <p className="text-muted mt-1 text-[14px]">
          You can come back and fill in optional fields later.
        </p>
        <div className="mt-8">
          <ClientForm mode="create" />
        </div>
      </div>
    </div>
  );
}
