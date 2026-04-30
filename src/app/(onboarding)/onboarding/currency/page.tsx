import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { usersRepo } from '@/lib/repositories/users.repo';
import { OnboardingStepper } from '@/components/app/onboarding-stepper';
import { CurrencyStepForm } from './currency-form';

export const metadata = { title: 'Default currency · Middlemist' };

export default async function CurrencyStepPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const user = await usersRepo.findById(session.user.id);
  if (!user) redirect('/login');
  if (user.onboardingDoneAt) redirect('/dashboard');

  return (
    <div className="border-hairline bg-canvas rounded-lg border p-8">
      <OnboardingStepper current={3} total={4} />
      <h1 className="font-display text-ink text-[24px] leading-[1.2] font-semibold tracking-[-0.5px]">
        Default currency
      </h1>
      <p className="text-muted mt-2 text-[14px]">
        New invoices will default to this. You can override per invoice.
      </p>
      <div className="mt-6">
        <CurrencyStepForm defaultValue={user.defaultCurrency ?? 'PHP'} />
      </div>
    </div>
  );
}
