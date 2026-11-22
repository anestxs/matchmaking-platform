import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/reset-password-form';

export const metadata: Metadata = {
  title: 'Set a new password',
  description: 'Choose a new password for your Matchmaking Platform account.',
  referrer: 'no-referrer',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;

  return <ResetPasswordForm token={typeof token === 'string' ? token : null} />;
}
