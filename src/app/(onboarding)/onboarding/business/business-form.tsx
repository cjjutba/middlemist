'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { friendlyMessage } from '@/lib/utils/errors';
import { saveBusinessName } from '@/actions/onboarding';

const schema = z.object({
  businessName: z.string().trim().min(1, 'Required').max(120),
});

export function BusinessStepForm({
  defaultValue,
  fallbackName,
}: {
  defaultValue: string;
  fallbackName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { businessName: defaultValue || fallbackName },
  });

  function onSubmit(values: { businessName: string }) {
    setServerError(null);
    startTransition(async () => {
      const r = await saveBusinessName(values);
      if (!r.ok) {
        setServerError(friendlyMessage(r.error));
        return;
      }
      router.push('/onboarding/logo');
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextField
        label="Business name"
        placeholder="Maria Santos Studio"
        error={errors.businessName?.message}
        {...register('businessName')}
      />
      {serverError ? <p className="text-error text-[13px]">{serverError}</p> : null}
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </form>
  );
}
