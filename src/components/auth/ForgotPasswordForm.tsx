'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { requestPasswordReset } from '@/actions/auth';
import { AuthAlert } from './AuthAlert';

const schema = z.object({
  email: z.string().email('Enter a valid email.').max(254),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    await requestPasswordReset(values);
    setSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <AuthAlert tone="success">
        If an account exists for that email, we&apos;ve sent a password reset link. Check your
        inbox.
      </AuthAlert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <label className="block">
        <span className="text-ink mb-1.5 block text-[14px] font-medium">Email</span>
        <input
          type="email"
          autoComplete="email"
          {...register('email')}
          className="bg-canvas border-hairline text-ink w-full rounded-md border px-3.5 py-2.5 text-[16px] outline-none focus:border-black focus:ring-2 focus:ring-black/10"
        />
        {errors.email ? (
          <span className="text-error mt-1 block text-[13px]">{errors.email.message}</span>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-on-primary hover:bg-primary-active mt-2 inline-flex h-10 w-full items-center justify-center rounded-md text-[14px] font-semibold transition-colors disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}
