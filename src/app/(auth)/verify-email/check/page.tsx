import Link from 'next/link';
import { AuthHeading } from '@/components/auth/AuthHeading';

export const metadata = {
  title: 'Check your email · Middlemist',
};

export default function VerifyEmailCheckPage() {
  return (
    <>
      <AuthHeading
        title="Check your email"
        description="We sent a verification link to your inbox. Click the link to activate your account."
      />
      <p className="text-muted text-[14px] leading-[1.5]">
        Didn&apos;t get it? Check your spam folder, or{' '}
        <Link href="/signup" className="text-ink font-medium hover:underline">
          try again
        </Link>
        .
      </p>
    </>
  );
}
