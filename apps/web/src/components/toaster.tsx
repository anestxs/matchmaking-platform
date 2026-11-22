'use client';

import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from '@/lib/use-theme';

export function Toaster() {
  const theme = useTheme();

  return (
    <SonnerToaster theme={theme} position="bottom-center" richColors closeButton duration={5000} />
  );
}
