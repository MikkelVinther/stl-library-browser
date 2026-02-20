import { useState, useEffect } from 'react';

export type AppTheme = 'prototype-dark' | 'presentation-dark';

const STORAGE_KEY = 'stl-library-theme';
const DEFAULT_THEME: AppTheme = 'prototype-dark';

function applyTheme(theme: AppTheme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'prototype-dark' || saved === 'presentation-dark') return saved;
    } catch {
      // localStorage unavailable (e.g. in tests)
    }
    return DEFAULT_THEME;
  });

  // Apply theme to DOM on mount and whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (next: AppTheme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    setThemeState(next);
  };

  const toggleTheme = () => {
    setTheme(theme === 'prototype-dark' ? 'presentation-dark' : 'prototype-dark');
  };

  return { theme, setTheme, toggleTheme };
}
