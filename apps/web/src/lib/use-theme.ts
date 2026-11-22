'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  applyTheme,
  getServerTheme,
  getTheme,
  subscribeTheme,
  type Theme,
  watchSystemTheme,
} from './theme';

export function useTheme(): Theme {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);

  useEffect(() => {
    if (theme !== 'system') return;

    return watchSystemTheme(() => applyTheme('system'));
  }, [theme]);

  return theme;
}
