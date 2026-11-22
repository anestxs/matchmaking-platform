'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { clsx } from 'clsx';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import DiscordIcon from '@/assets/icons/discord.svg';
import { Button, buttonClasses } from '@/components/button';
import { TextField } from '@/components/text-field';
import { api, ApiError } from '@/lib/api';
import { type Session, useAuth } from '@/lib/auth-context';

const DISCORD_ERRORS: Record<string, string> = {
  discord_email_taken:
    'The email on your Discord account already belongs to another account. Sign in with your password, then connect Discord in settings.',
  discord_email_missing:
    'Your Discord account has no verified email. Add one in Discord, then try again.',
  discord_failed: 'Discord sign-in did not finish. Try again.',
};

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or nickname#tag.'),
  password: z.string().min(1, 'Enter your password.'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({ errorCode }: { errorCode: string | null }) {
  const discordError = errorCode ? DISCORD_ERRORS[errorCode] : undefined;

  const router = useRouter();
  const { signIn, status } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { identifier: '', password: '' },
  });

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status, router]);

  async function onSubmit(values: LoginValues) {
    try {
      const session = await api<Session>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });

      signIn(session);
      router.replace('/');
    } catch (cause) {
      toast.error(
        cause instanceof ApiError ? cause.message : 'Could not reach the server. Try again.',
      );
    }
  }

  if (status !== 'anonymous') {
    return <p className="mt-6 text-sm text-muted">Checking your session</p>;
  }

  return (
    <>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted">
        Use your email address, or your nickname together with its tag.
      </p>

      {discordError ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {discordError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 flex flex-col gap-4">
        <TextField
          label="Email or nickname#tag"
          autoComplete="username"
          placeholder="you@example.com or player#1234"
          error={errors.identifier?.message}
          {...register('identifier')}
        />

        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          error={errors.password?.message}
          {...register('password')}
        />

        <Link
          href="/forgot-password"
          className="-mt-2 self-end text-sm font-medium text-brand hover:text-brand-hover"
        >
          Forgot password?
        </Link>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in' : 'Sign in'}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <a
        href={`${process.env.NEXT_PUBLIC_API_URL}/auth/discord`}
        className={clsx(buttonClasses('secondary'), 'w-full')}
      >
        <DiscordIcon className="size-5 text-discord" aria-hidden />
        Continue with Discord
      </a>

      <p className="mt-6 text-center text-sm text-muted">
        No account yet?{' '}
        <Link href="/register" className="font-medium text-brand hover:text-brand-hover">
          Create one
        </Link>
      </p>
    </>
  );
}
