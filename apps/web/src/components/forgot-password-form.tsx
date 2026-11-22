'use client';

import { useState } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import z from 'zod';
import { Button, buttonClasses } from '@/components/button';
import { TextField } from '@/components/text-field';
import { api, ApiError } from '@/lib/api';

const forgotPassowrdSchema = z.object({
  email: z.email('Enter a valid email address.'),
});

type ForgotPasswordValues = z.infer<typeof forgotPassowrdSchema>;

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPassowrdSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });

  async function onSubmit({ email }: ForgotPasswordValues) {
    try {
      await api<{ success: boolean; message: string }>('/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      setSentTo(email);
    } catch (cause) {
      toast.error(
        cause instanceof ApiError ? cause.message : 'Could not reach the server. Try again.',
      );
    }
  }

  return (
    <div aria-live="polite">
      {sentTo ? (
        <>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-2 text-sm text-muted">
            If {sentTo} belongs to an account with a verified email, a reset link is on its way. The
            link expires in 1 hour.
          </p>

          <div className="mt-7 flex flex-col">
            <Link href="/login" className={buttonClasses('secondary')}>
              Back to sign in
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="mt-2 text-sm text-muted">
            Enter the email on your account and we will send you a link to set a new password.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 flex flex-col gap-4">
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending link' : 'Send reset link'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Remembered it?{' '}
            <Link href="/login" className="font-medium text-brand hover:text-brand-hover">
              Sign in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
