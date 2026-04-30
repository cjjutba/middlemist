import Link from 'next/link';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { SignupForm } from '@/components/auth/SignupForm';

export const metadata = {
  title: 'Sign up · Middlemist',
};

export default function SignupPage() {
  return (
    <>
      <AuthHeading
        title="Create your account"
        description="Start with a free Middlemist account."
      />
      <SignupForm />
      <p className="text-muted mt-6 text-[14px]">
        Already have an account?{' '}
        <Link href="/login" className="text-ink font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
