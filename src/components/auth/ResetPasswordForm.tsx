'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { resetPassword } from '@/actions/auth';
import { AuthAlert } from './AuthAlert';

const schema = z.object({
  password: z.string().min(12, 'Password must be at least 12 characters.').max(128),
});

type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '' },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setSubmitting(true);
    const result = await resetPassword({ token, password: values.password });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    router.push('/login');
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {formError ? <AuthAlert tone="error">{formError}</AuthAlert> : null}

      <label className="block">
        <span className="text-ink mb-1.5 block text-[14px] font-medium">New password</span>
        <input
          type="password"
          autoComplete="new-password"
          {...register('password')}
          className="bg-canvas border-hairline text-ink w-full rounded-md border px-3.5 py-2.5 text-[16px] outline-none focus:border-black focus:ring-2 focus:ring-black/10"
        />
        {errors.password ? (
          <span className="text-error mt-1 block text-[13px]">{errors.password.message}</span>
        ) : (
          <span className="text-muted mt-1 block text-[13px]">At least 12 characters.</span>
        )}
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-on-primary hover:bg-primary-active mt-2 inline-flex h-10 w-full items-center justify-center rounded-md text-[14px] font-semibold transition-colors disabled:opacity-50"
      >
        {submitting ? 'Setting password…' : 'Set new password'}
      </button>
    </form>
  );
}
