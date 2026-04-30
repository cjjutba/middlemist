import Link from 'next/link';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Sign in · Middlemist',
};

export default function LoginPage() {
  return (
    <>
      <AuthHeading title="Sign in to Middlemist" />
      <LoginForm />
      <div className="mt-6 flex items-center justify-between text-[14px]">
        <Link href="/forgot-password" className="text-ink font-medium hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-ink font-medium hover:underline">
          Create account
        </Link>
      </div>
    </>
  );
}
