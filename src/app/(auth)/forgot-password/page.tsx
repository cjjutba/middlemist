import Link from 'next/link';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata = {
  title: 'Forgot password · Middlemist',
};

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading
        title="Reset your password"
        description="Enter your email and we'll send a link to set a new password."
      />
      <ForgotPasswordForm />
      <p className="text-muted mt-6 text-[14px]">
        <Link href="/login" className="text-ink font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
