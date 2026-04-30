import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { usersRepo } from '@/lib/repositories/users.repo';
import { OnboardingStepper } from '@/components/app/onboarding-stepper';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Logo · Middlemist' };

export default async function LogoStepPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const user = await usersRepo.findById(session.user.id);
  if (!user) redirect('/login');
  if (user.onboardingDoneAt) redirect('/dashboard');

  return (
    <div className="border-hairline bg-canvas rounded-lg border p-8">
      <OnboardingStepper current={2} total={4} />
      <h1 className="font-display text-ink text-[24px] leading-[1.2] font-semibold tracking-[-0.5px]">
        Add a logo
      </h1>
      <p className="text-muted mt-2 text-[14px]">
        File upload arrives when UploadThing is wired. Skip for now — you can add a logo later from
        Settings.
      </p>
      <div className="border-hairline-soft bg-surface-soft mt-6 rounded-lg border p-6 text-center">
        <p className="text-muted text-[13px]">Logo upload arrives in a later week.</p>
      </div>
      <div className="mt-6 flex items-center gap-2">
        <Link href="/onboarding/currency">
          <Button variant="primary">Continue</Button>
        </Link>
      </div>
    </div>
  );
}
