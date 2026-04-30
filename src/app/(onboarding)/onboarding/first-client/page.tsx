import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { usersRepo } from '@/lib/repositories/users.repo';
import { OnboardingStepper } from '@/components/app/onboarding-stepper';
import { FirstClientForm } from './first-client-form';

export const metadata = { title: 'First client · Middlemist' };

export default async function FirstClientStepPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const user = await usersRepo.findById(session.user.id);
  if (!user) redirect('/login');
  if (user.onboardingDoneAt) redirect('/dashboard');

  return (
    <div className="border-hairline bg-canvas rounded-lg border p-8">
      <OnboardingStepper current={4} total={4} />
      <h1 className="font-display text-ink text-[24px] leading-[1.2] font-semibold tracking-[-0.5px]">
        Add your first client
      </h1>
      <p className="text-muted mt-2 text-[14px]">
        You can skip this and add clients later from the sidebar.
      </p>
      <div className="mt-6">
        <FirstClientForm />
      </div>
    </div>
  );
}
