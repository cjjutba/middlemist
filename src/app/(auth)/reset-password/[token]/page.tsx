import Link from 'next/link';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const metadata = {
  title: 'Reset password · Middlemist',
};

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <>
      <AuthHeading title="Set a new password" />
      <ResetPasswordForm token={token} />
      <p className="text-muted mt-6 text-[14px]">
        <Link href="/login" className="text-ink font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
