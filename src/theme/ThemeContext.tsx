/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'high-contrast';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'shelter-route-theme';

const THEME_CYCLE: Theme[] = ['light', 'dark', 'high-contrast'];

function isValidTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'high-contrast';
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isValidTheme(stored)) {
    return stored;
  }
  if (window.matchMedia('(prefers-contrast: more)').matches) {
    return 'high-contrast';
  }
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const currentIndex = THEME_CYCLE.indexOf(prev);
      return THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
