import { logout } from '@/actions/auth';
import { auth } from '@/lib/auth';

export const metadata = {
  title: 'Dashboard · Middlemist',
};

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="bg-canvas min-h-screen px-6 py-16">
      <div className="mx-auto max-w-[720px]">
        <h1 className="font-display text-ink text-[32px] leading-[1.2] font-semibold tracking-[-0.5px]">
          Dashboard
        </h1>
        <p className="text-body mt-4 text-[16px]">
          Signed in as <span className="text-ink font-medium">{session?.user?.email}</span>
        </p>
        <p className="text-muted mt-2 text-[14px]">
          The real dashboard arrives in a later week. This page exists so the auth gate can be
          tested.
        </p>
        <form action={logout} className="mt-8">
          <button
            type="submit"
            className="border-hairline bg-canvas text-ink hover:bg-surface-soft inline-flex h-10 items-center justify-center rounded-md border px-5 text-[14px] font-semibold transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
