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

const registerSchema = z.object({
  nickname: z
    .string()
    .min(3, 'At least 3 characters.')
    .max(20, 'At most 20 characters.')
    .regex(/^[A-Za-z0-9_]+$/, 'Letters, digits and underscore only.'),
  tag: z.string().regex(/^\d{4}$/, 'Exactly four digits.'),
  email: z.union([z.literal(''), z.email('Enter a valid email address.')]),
  password: z.string().min(8, 'At least 8 characters.').max(128, 'At most 128 characters.'),
});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const { signIn, status } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { nickname: '', tag: '', email: '', password: '' },
  });

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status, router]);

  async function onSubmit({ nickname, tag, email, password }: RegisterValues) {
    try {
      const session = await api<Session>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          nickname,
          tag,
          password,
          ...(email ? { email } : {}),
        }),
      });

      signIn(session);
      router.replace('/');
      toast.success(`Account created. Welcome, ${session.user.nickname}.`);
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
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-2 text-sm text-muted">
        Your nickname and tag together identify you in matches.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Nickname"
            autoComplete="username"
            placeholder="player"
            hint="Letters, digits and underscore."
            maxLength={20}
            error={errors.nickname?.message}
            {...register('nickname')}
          />

          <TextField
            label="Tag"
            inputMode="numeric"
            placeholder="1234"
            hint="Exactly four digits."
            maxLength={4}
            error={errors.tag?.message}
            {...register('tag')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Email (optional)"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            hint="For password recovery."
            error={errors.email?.message}
            {...register('email')}
          />

          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a password"
            hint="At least 8 characters."
            maxLength={128}
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account' : 'Create account'}
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
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand hover:text-brand-hover">
          Sign in
        </Link>
      </p>
    </>
  );
}
