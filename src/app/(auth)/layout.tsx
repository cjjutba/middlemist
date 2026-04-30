import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-canvas flex min-h-screen flex-col">
      <header className="border-hairline-soft border-b">
        <nav className="mx-auto flex h-16 max-w-[1200px] items-center px-6">
          <Link
            href="/"
            className="font-display text-ink text-[18px] font-semibold tracking-[-0.3px]"
          >
            middlemist
          </Link>
        </nav>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
      <footer className="bg-surface-dark">
        <div className="mx-auto max-w-[1200px] px-6 py-8">
          <p className="text-on-dark-soft text-[13px] leading-[1.4] font-medium">
            middlemist · in development
          </p>
        </div>
      </footer>
    </div>
  );
}
