import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { usersRepo } from '@/lib/repositories/users.repo';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Welcome · Middlemist' };

export default async function OnboardingWelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const user = await usersRepo.findById(session.user.id);
  if (!user) redirect('/login');
  if (user.onboardingDoneAt) redirect('/dashboard');

  return (
    <div className="border-hairline bg-canvas rounded-lg border p-8">
      <h1 className="font-display text-ink text-[28px] leading-[1.2] font-semibold tracking-[-0.5px]">
        Welcome to Middlemist
      </h1>
      <p className="text-body mt-3 text-[16px] leading-[1.5]">
        We&apos;ll set up the basics in a couple of minutes. You can skip steps and come back to
        them later.
      </p>
      <ul className="text-body mt-6 space-y-2 text-[14px]">
        <li>· Your business name</li>
        <li>· A logo (optional)</li>
        <li>· Your default currency</li>
        <li>· Your first client (optional)</li>
      </ul>
      <div className="mt-8">
        <Link href="/onboarding/business">
          <Button variant="primary">Get started</Button>
        </Link>
      </div>
    </div>
  );
}
