import './globals.css';

import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import clsx from 'clsx';
import { ThemeScript } from '@/components/theme-script';
import { ThemeToggle } from '@/components/theme-toggle';
import { Toaster } from '@/components/toaster';
import { AuthProvider } from '@/lib/auth-context';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Matchmaking Platform',
    template: '%s | Matchmaking Platform',
  },
  description: 'Build a party, queue by skill rating, and play ranked matches and tournaments.',
  applicationName: 'Matchmaking Platform',
  openGraph: {
    type: 'website',
    siteName: 'Matchmaking Platform',
    title: 'Matchmaking Platform',
    description: 'Build a party, queue by skill rating, and play ranked matches and tournaments.',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={clsx(geistSans.variable, 'h-full antialiased')}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <div className="fixed top-4 right-4 z-50">
            <ThemeToggle />
          </div>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
