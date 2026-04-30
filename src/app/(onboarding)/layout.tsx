import Link from 'next/link';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-canvas flex min-h-screen flex-col">
      <header className="border-hairline-soft border-b">
        <nav className="mx-auto flex h-16 max-w-[1200px] items-center px-6">
          <Link
            href="/dashboard"
            className="font-display text-ink text-[18px] font-semibold tracking-[-0.3px]"
          >
            middlemist
          </Link>
        </nav>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 py-16">
        <div className="w-full max-w-[480px]">{children}</div>
      </main>
    </div>
  );
}
