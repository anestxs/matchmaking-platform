import { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/forgot-password-form';

export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Request a link to set a new password for your Matchmaking Platform account.',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
