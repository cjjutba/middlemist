'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { login } from '@/actions/auth';
import { AuthAlert } from './AuthAlert';

const schema = z.object({
  email: z.string().email('Enter a valid email.').max(254),
  password: z.string().min(1, 'Password is required.').max(128),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setSubmitting(true);
    const formData = new FormData();
    formData.set('email', values.email);
    formData.set('password', values.password);
    const result = await login(formData);
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {formError ? <AuthAlert tone="error">{formError}</AuthAlert> : null}

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

      <label className="block">
        <span className="text-ink mb-1.5 block text-[14px] font-medium">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="bg-canvas border-hairline text-ink w-full rounded-md border px-3.5 py-2.5 text-[16px] outline-none focus:border-black focus:ring-2 focus:ring-black/10"
        />
        {errors.password ? (
          <span className="text-error mt-1 block text-[13px]">{errors.password.message}</span>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-on-primary hover:bg-primary-active mt-2 inline-flex h-10 w-full items-center justify-center rounded-md text-[14px] font-semibold transition-colors disabled:opacity-50"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
