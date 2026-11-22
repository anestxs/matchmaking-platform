export const THEMES = ['system', 'light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = 'theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

const listeners = new Set<() => void>();

export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);

  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function getServerTheme(): Theme {
  return 'system';
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function setTheme(theme: Theme): void {
  if (theme === 'system') {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  applyTheme(theme);

  for (const listener of listeners) listener();
}

export function applyTheme(theme: Theme): void {
  const resolved =
    theme === 'system' ? (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light') : theme;

  document.documentElement.dataset.theme = resolved;
}

export function watchSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);

  return () => media.removeEventListener('change', onChange);
}
