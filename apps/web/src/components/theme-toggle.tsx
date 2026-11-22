'use client';

import { type FC, type SVGProps } from 'react';
import clsx from 'clsx';
import MonitorIcon from '@/assets/icons/monitor.svg';
import MoonIcon from '@/assets/icons/moon.svg';
import SunIcon from '@/assets/icons/sun.svg';
import { setTheme, type Theme, THEMES } from '@/lib/theme';
import { useTheme } from '@/lib/use-theme';

const LABELS: Record<Theme, string> = {
  system: 'Match system theme',
  light: 'Light theme',
  dark: 'Dark theme',
};

const ICONS: Record<Theme, FC<SVGProps<SVGSVGElement>>> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

export function ThemeToggle() {
  const theme = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="relative inline-grid grid-cols-3 rounded-full border border-border bg-surface p-1 shadow-lg shadow-brand/5"
    >
      <span
        aria-hidden
        style={{ transform: `translateX(${THEMES.indexOf(theme) * 100}%)` }}
        className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-brand transition-transform duration-300 ease-out motion-reduce:transition-none"
      />

      {THEMES.map((value) => {
        const selected = theme === value;
        const Icon = ICONS[value];

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={LABELS[value]}
            title={LABELS[value]}
            onClick={() => setTheme(value)}
            className={clsx(
              'relative flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              selected ? 'text-brand-foreground' : 'text-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
