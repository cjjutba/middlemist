'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { saveDefaultCurrency } from '@/actions/onboarding';
import { SUPPORTED_CURRENCIES } from '@/lib/schemas/client.schema';
import { friendlyMessage } from '@/lib/utils/errors';

const schema = z.object({
  defaultCurrency: z.enum(SUPPORTED_CURRENCIES),
});
type FormValues = z.infer<typeof schema>;

export function CurrencyStepForm({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const initial: (typeof SUPPORTED_CURRENCIES)[number] = (
    SUPPORTED_CURRENCIES as readonly string[]
  ).includes(defaultValue)
    ? (defaultValue as (typeof SUPPORTED_CURRENCIES)[number])
    : 'PHP';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { defaultCurrency: initial },
  });

  function onSubmit(values: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const r = await saveDefaultCurrency(values);
      if (!r.ok) {
        setServerError(friendlyMessage(r.error));
        return;
      }
      router.push('/onboarding/first-client');
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <SelectField
        label="Default currency"
        error={errors.defaultCurrency?.message}
        {...register('defaultCurrency')}
      >
        {SUPPORTED_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </SelectField>
      {serverError ? <p className="text-error text-[13px]">{serverError}</p> : null}
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </form>
  );
}
