import Link from 'next/link';
import { verifyEmail } from '@/actions/auth';
import { AuthAlert } from '@/components/auth/AuthAlert';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { friendlyMessage } from '@/lib/utils/errors';

export const metadata = {
  title: 'Verify email · Middlemist',
};

export default async function VerifyEmailTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await verifyEmail({ token });

  if (result.ok) {
    return (
      <>
        <AuthHeading
          title={result.data?.alreadyVerified ? 'Already verified' : 'Email verified'}
          description={
            result.data?.alreadyVerified
              ? 'Your email was already verified. You can sign in anytime.'
              : 'Your email is verified. Sign in to start using Middlemist.'
          }
        />
        <Link
          href="/login"
          className="bg-primary text-on-primary hover:bg-primary-active inline-flex h-10 w-full items-center justify-center rounded-md text-[14px] font-semibold transition-colors"
        >
          Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Verification failed" />
      <AuthAlert tone="error">{friendlyMessage(result.error)}</AuthAlert>
      <p className="text-muted mt-6 text-[14px] leading-[1.5]">
        <Link href="/login" className="text-ink font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
