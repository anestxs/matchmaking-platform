import type { Metadata } from 'next';
import { RegisterForm } from '@/components/register-form';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create a Matchmaking Platform account and start queueing.',
};

export default function RegisterPage() {
  return <RegisterForm />;
}
