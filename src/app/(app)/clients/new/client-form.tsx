'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { TextareaField } from '@/components/ui/textarea-field';
import {
  SUPPORTED_CURRENCIES,
  createClientSchema,
  type CreateClientInput,
} from '@/lib/schemas/client.schema';
import { friendlyMessage } from '@/lib/utils/errors';
import { createClient, updateClient } from '@/actions/clients';

type Mode =
  | { mode: 'create'; defaults?: Partial<CreateClientInput> }
  | { mode: 'edit'; clientId: string; defaults: Partial<CreateClientInput> };

export function ClientForm(props: Mode) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: props.defaults ?? {},
  });

  function onSubmit(values: CreateClientInput) {
    setServerError(null);
    startTransition(async () => {
      const result =
        props.mode === 'create'
          ? await createClient(values)
          : await updateClient({ id: props.clientId, ...values });
      if (!result.ok) {
        setServerError(friendlyMessage(result.error));
        return;
      }
      const targetId = props.mode === 'create' ? result.data.id : props.clientId;
      router.push(`/clients/${targetId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <TextField
        label="Name"
        placeholder="Maria Santos"
        autoComplete="name"
        error={errors.name?.message}
        {...register('name')}
      />
      <TextField
        label="Company"
        placeholder="Mangosteen Studio"
        hint="Optional"
        autoComplete="organization"
        error={errors.companyName?.message}
        {...register('companyName')}
      />
      <TextField
        label="Email"
        type="email"
        placeholder="maria@example.com"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        label="Phone"
        hint="Optional"
        autoComplete="tel"
        error={errors.phone?.message}
        {...register('phone')}
      />
      <TextField
        label="Website"
        hint="Optional"
        placeholder="https://example.com"
        error={errors.website?.message}
        {...register('website')}
      />
      <SelectField
        label="Preferred currency"
        hint="Used as the suggested currency for invoices to this client"
        error={errors.preferredCurrency?.message}
        defaultValue=""
        {...register('preferredCurrency')}
      >
        <option value="">—</option>
        {SUPPORTED_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </SelectField>
      <TextareaField
        label="Address"
        hint="Optional"
        error={errors.address?.message}
        {...register('address')}
      />
      <TextareaField
        label="Notes"
        hint="Anything you want to remember about this client"
        rows={4}
        error={errors.notes?.message}
        {...register('notes')}
      />

      {serverError ? (
        <p className="border-error/30 bg-error/10 text-error rounded-md border px-3 py-2 text-[13px]">
          {serverError}
        </p>
      ) : null}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : props.mode === 'create' ? 'Create client' : 'Save changes'}
        </Button>
        <Button type="button" variant="text" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
