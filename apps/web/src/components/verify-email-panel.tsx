'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button, buttonClasses } from '@/components/button';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type VerifyState = 'missing' | 'idle' | 'submitting' | 'success' | 'error';

const COPY: Record<Exclude<VerifyState, 'submitting'>, { title: string; body: string }> = {
  missing: {
    title: 'Link incomplete',
    body: 'This page needs the full link from your email. Open the email again and use the button inside it.',
  },
  idle: {
    title: 'Confirm your email',
    body: 'Press the button below to finish verifying your email address.',
  },
  success: {
    title: 'Email verified',
    body: 'Your email address is confirmed. You can now use it to sign in.',
  },
  error: {
    title: 'Link not valid',
    body: 'This link has expired or was already used. Request a new one from your account settings.',
  },
};

export function VerifyEmailPanel({ token }: { token: string | null }) {
  const { status, reloadUser } = useAuth();
  const [state, setState] = useState<VerifyState>(token ? 'idle' : 'missing');

  const copy = COPY[state === 'submitting' ? 'idle' : state];
  const isSignedIn = status === 'authenticated';

  async function verify() {
    if (!token) return;

    setState('submitting');

    try {
      await api<{ success: boolean; message: string }>('/auth/email/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    } catch (cause) {
      if (cause instanceof ApiError) {
        setState('error');
      } else {
        toast.error('Could not reach the server. Try again.');
        setState('idle');
      }
      return;
    }
    setState('success');

    if (isSignedIn) {
      await reloadUser().catch(() => undefined);
    }
  }

  return (
    <div aria-live="polite">
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted">{copy.body}</p>

      <div className="mt-7 flex flex-col">
        {state === 'idle' || state === 'submitting' ? (
          <Button type="button" onClick={verify} disabled={state === 'submitting'}>
            {state === 'submitting' ? 'Verifying' : 'Verify email'}
          </Button>
        ) : state === 'success' ? (
          <Link href={isSignedIn ? '/' : '/login'} className={buttonClasses('primary')}>
            {isSignedIn ? 'Continue' : 'Sign in'}
          </Link>
        ) : (
          <Link href="/" className={buttonClasses('secondary')}>
            Back to home
          </Link>
        )}
      </div>
    </div>
  );
}
