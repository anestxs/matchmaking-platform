'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button, buttonClasses } from '@/components/button';
import { useAuth } from '@/lib/auth-context';

export function HomeActions() {
  const { status, user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut();
      toast.success('You are signed out.');
    } catch {
      toast.error('Could not reach the server. You are signed out on this device only.');
    } finally {
      setIsSigningOut(false);
    }
  }

  if (status === 'loading') {
    return <div aria-hidden className="h-11" />;
  }

  if (status === 'authenticated' && user) {
    return (
      <div className="flex w-full flex-col items-center gap-4">
        <p className="text-sm text-muted">
          Signed in as{' '}
          <span className="font-medium text-foreground">
            {user.nickname}#{user.tag}
          </span>
        </p>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href="/settings" className={buttonClasses('primary')}>
            Open settings
          </Link>
          <Button type="button" variant="secondary" onClick={handleSignOut} disabled={isSigningOut}>
            {isSigningOut ? 'Signing out' : 'Sign out'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
      <Link href="/register" className={buttonClasses('primary')}>
        Create an account
      </Link>
      <Link href="/login" className={buttonClasses('secondary')}>
        Sign in
      </Link>
    </div>
  );
}
