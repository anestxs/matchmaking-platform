'use client';

import { useState } from 'react';
import Link from 'next/dist/client/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import z from 'zod';
import { Button, buttonClasses } from '@/components/button';
import { TextField } from '@/components/text-field';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type ResetState = 'missing' | 'form' | 'success' | 'invalid';

type ResultCopy = {
  title: string;
  body: string;
  action: { href: string; label: string; variant: 'primary' | 'secondary' };
};

const RESULT: Record<Exclude<ResetState, 'form'>, ResultCopy> = {
  missing: {
    title: 'Link incomplete',
    body: 'This page needs the full link from your email. Open the email again and use the button inside it.',
    action: { href: '/', label: 'Back to home', variant: 'secondary' },
  },
  invalid: {
    title: 'Link not valid',
    body: 'This link has expired or was already used. Request a new one to reset your password.',
    action: { href: '/forgot-password', label: 'Request a new link', variant: 'primary' },
  },
  success: {
    title: 'Password updated',
    body: 'Your new password is set and you were signed out on every device. Sign in with the new password.',
    action: { href: '/login', label: 'Sign in', variant: 'primary' },
  },
};

const ResetPasswordSchema = z
  .object({
    password: z.string().min(8, 'At least 8 characters.').max(128, 'At most 128 characters.'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type ResetPasswordValues = z.infer<typeof ResetPasswordSchema>;

export function ResetPasswordForm({ token }: { token: string | null }) {
  const { status, signOut } = useAuth();
  const [state, setState] = useState<ResetState>(token ? 'form' : 'missing');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(ResetPasswordSchema),
    mode: 'onTouched',
    defaultValues: { password: '', confirmPassword: '' },
  });

  async function onSubmit({ password }: ResetPasswordValues) {
    if (!token) {
      return;
    }

    try {
      await api<{ success: boolean; message: string }>('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status !== 429) {
        setState('invalid');
      } else {
        toast.error(
          cause instanceof ApiError ? cause.message : 'Could not reach the server. Try again.',
        );
      }
      return;
    }
    setState('success');

    if (status === 'authenticated') {
      await signOut().catch(() => undefined);
    }
  }
  if (state !== 'form') {
    const result = RESULT[state];

    return (
      <div aria-live="polite">
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{result.title}</h1>
        <p className="mt-2 text-sm text-muted">{result.body}</p>

        <div className="mt-7 flex flex-col">
          <Link href={result.action.href} className={buttonClasses(result.action.variant)}>
            {result.action.label}
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div aria-live="polite">
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mt-2 text-sm text-muted">
        Choose a new password for your account. You will be signed out on every device.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 flex flex-col gap-4">
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          hint="At least 8 characters."
          maxLength={128}
          error={errors.password?.message}
          {...register('password')}
        />

        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat the password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Updating password' : 'Update password'}
        </Button>
      </form>
    </div>
  );
}
