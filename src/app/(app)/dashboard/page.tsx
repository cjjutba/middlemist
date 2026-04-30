import { auth } from '@/lib/auth';

export const metadata = {
  title: 'Dashboard · Middlemist',
};

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="px-6 py-10 lg:px-12 lg:py-14">
      <div className="mx-auto max-w-[980px]">
        <h1 className="font-display text-ink text-[32px] leading-[1.2] font-semibold tracking-[-0.5px]">
          Dashboard
        </h1>
        <p className="text-body mt-3 text-[16px]">
          Signed in as <span className="text-ink font-medium">{session?.user?.email}</span>
        </p>
        <p className="text-muted mt-2 text-[14px]">
          The real dashboard arrives in Week 13. Use the sidebar to explore the app shell.
        </p>
      </div>
    </div>
  );
}
