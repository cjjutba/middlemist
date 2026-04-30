'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { completeOnboarding, createFirstClient } from '@/actions/onboarding';
import { friendlyMessage } from '@/lib/utils/errors';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email').max(254),
  companyName: z.string().trim().max(120).optional(),
});
type FormValues = z.infer<typeof schema>;

export function FirstClientForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onAddClient(values: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const create = await createFirstClient(values);
      if (!create.ok) {
        setServerError(friendlyMessage(create.error));
        return;
      }
      const finish = await completeOnboarding({});
      if (!finish.ok) {
        setServerError(friendlyMessage(finish.error));
        return;
      }
      router.push('/dashboard');
      router.refresh();
    });
  }

  function onSkip() {
    setServerError(null);
    startTransition(async () => {
      const finish = await completeOnboarding({});
      if (!finish.ok) {
        setServerError(friendlyMessage(finish.error));
        return;
      }
      router.push('/dashboard');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onAddClient)} className="flex flex-col gap-4">
      <TextField
        label="Name"
        placeholder="Maria Santos"
        error={errors.name?.message}
        {...register('name')}
      />
      <TextField
        label="Company"
        hint="Optional"
        error={errors.companyName?.message}
        {...register('companyName')}
      />
      <TextField
        label="Email"
        type="email"
        placeholder="maria@example.com"
        error={errors.email?.message}
        {...register('email')}
      />
      {serverError ? <p className="text-error text-[13px]">{serverError}</p> : null}
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Add client and finish'}
        </Button>
        <Button type="button" variant="text" onClick={onSkip} disabled={pending}>
          Skip and finish
        </Button>
      </div>
    </form>
  );
}
