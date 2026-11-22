import { THEME_STORAGE_KEY } from '@/lib/theme';

function initTheme(storageKey: string) {
  try {
    const stored = localStorage.getItem(storageKey);

    document.documentElement.dataset.theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
  } catch {
    document.documentElement.dataset.theme = 'light';
  }
}

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(${initTheme.toString()})(${JSON.stringify(THEME_STORAGE_KEY)})`,
      }}
    />
  );
}
