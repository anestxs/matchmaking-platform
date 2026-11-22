import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex flex-1 items-center justify-center px-6 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 size-120 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-2xl shadow-brand/10 animate-rise-in motion-reduce:animate-none">
        <Link
          href="/"
          aria-label="Matchmaking Platform, back to home"
          className="inline-flex rounded-[22%] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <Logo size={40} />
        </Link>

        {children}
      </div>
    </main>
  );
}
