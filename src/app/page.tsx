import Link from 'next/link';

export default function Home() {
  return (
    <div className="bg-canvas flex min-h-screen flex-col">
      <header className="border-hairline-soft border-b">
        <nav className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <Link
            href="/"
            className="font-display text-ink text-[18px] font-semibold tracking-[-0.3px]"
          >
            middlemist
          </Link>
          <div className="flex items-center gap-3">
            <Link href="#" className="text-muted hover:text-ink text-[14px] font-medium">
              Sign in
            </Link>
            <Link
              href="#"
              className="bg-primary text-on-primary hover:bg-primary-active inline-flex h-10 items-center justify-center rounded-md px-5 text-[14px] font-semibold transition-colors"
            >
              Sign up free
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-[1200px] px-6 py-24 md:py-[96px]">
          <div className="mx-auto max-w-[720px] text-center">
            <p className="rounded-pill bg-surface-card text-ink mb-4 inline-block px-3 py-1 text-[13px] font-medium">
              Coming soon
            </p>
            <h1 className="font-display text-ink text-[48px] leading-[1.1] font-semibold tracking-[-1.5px] md:text-[64px] md:leading-[1.05] md:tracking-[-2px]">
              A freelance operations tool for solo developers
            </h1>
            <p className="text-body mt-6 text-[16px] leading-[1.5] md:text-[18px] md:leading-[1.5]">
              Proposals, projects, time tracking, and invoices in one place. Built for freelancers
              like you.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                href="#"
                className="bg-primary text-on-primary hover:bg-primary-active inline-flex h-10 items-center justify-center rounded-md px-5 text-[14px] font-semibold transition-colors"
              >
                Notify me
              </Link>
              <Link
                href="#"
                className="border-hairline bg-canvas text-ink hover:bg-surface-soft inline-flex h-10 items-center justify-center rounded-md border px-5 text-[14px] font-semibold transition-colors"
              >
                Learn more
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-canvas">
          <div className="mx-auto max-w-[1200px] px-6 py-[96px]">
            <h2 className="font-display text-ink mx-auto max-w-[720px] text-center text-[36px] leading-[1.15] font-semibold tracking-[-1px] md:text-[48px] md:leading-[1.1] md:tracking-[-1.5px]">
              Everything in one place
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <div className="bg-surface-card rounded-lg p-8">
                <h3 className="text-ink text-[18px] leading-[1.4] font-semibold">Proposals</h3>
                <p className="text-body mt-2 text-[16px] leading-[1.5]">
                  Build proposals from reusable blocks. Send a clean, branded link your client can
                  accept.
                </p>
              </div>
              <div className="bg-surface-card rounded-lg p-8">
                <h3 className="text-ink text-[18px] leading-[1.4] font-semibold">
                  Projects &amp; time
                </h3>
                <p className="text-body mt-2 text-[16px] leading-[1.5]">
                  Track tasks, log time, post updates. The client portal shows exactly what your
                  client needs to see.
                </p>
              </div>
              <div className="bg-surface-card rounded-lg p-8">
                <h3 className="text-ink text-[18px] leading-[1.4] font-semibold">Invoices</h3>
                <p className="text-body mt-2 text-[16px] leading-[1.5]">
                  Generate invoices from time entries or accepted proposals. Multi-currency. PDF
                  export. Reminder schedule.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-surface-dark">
        <div className="mx-auto max-w-[1200px] px-6 py-16">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-display text-on-dark text-[18px] font-semibold tracking-[-0.3px]">
                middlemist
              </p>
              <p className="text-on-dark-soft mt-2 text-[14px] leading-[1.5]">
                A freelance operations tool for solo developers.
              </p>
            </div>
            <p className="text-on-dark-soft text-[13px] leading-[1.4] font-medium">
              In development. Built by CJ Jutba.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
