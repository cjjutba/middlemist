import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { usersRepo } from '@/lib/repositories/users.repo';
import { OnboardingStepper } from '@/components/app/onboarding-stepper';
import { BusinessStepForm } from './business-form';

export const metadata = { title: 'Business name · Middlemist' };

export default async function BusinessStepPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const user = await usersRepo.findById(session.user.id);
  if (!user) redirect('/login');
  if (user.onboardingDoneAt) redirect('/dashboard');

  return (
    <div className="border-hairline bg-canvas rounded-lg border p-8">
      <OnboardingStepper current={1} total={4} />
      <h1 className="font-display text-ink text-[24px] leading-[1.2] font-semibold tracking-[-0.5px]">
        What&apos;s your business name?
      </h1>
      <p className="text-muted mt-2 text-[14px]">
        This appears on proposals, invoices, and your client portal. You can change it anytime.
      </p>
      <div className="mt-6">
        <BusinessStepForm defaultValue={user.businessName ?? ''} fallbackName={user.name} />
      </div>
    </div>
  );
}
