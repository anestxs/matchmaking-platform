import type { Metadata } from 'next';
import { VerifyEmailPanel } from '@/components/verify-email-panel';

export const metadata: Metadata = {
  title: 'Verify email',
  description: 'Confirm the email address on your Matchmaking Platform account.',
  referrer: 'no-referrer',
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;

  return <VerifyEmailPanel token={typeof token === 'string' ? token : null} />;
}
