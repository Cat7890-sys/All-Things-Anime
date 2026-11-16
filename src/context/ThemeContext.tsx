import React, { createContext, useContext, useEffect, useState } from 'react';

export type AtaTheme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'ata-theme-preference';

interface ThemeContextValue {
  theme: AtaTheme;
  hasExplicitPreference: boolean;
  toggleTheme: () => void;
  setTheme: (nextTheme: AtaTheme) => void;
  resetToSystemPreference: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): AtaTheme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

function getInitialThemeState(): {
  theme: AtaTheme;
  hasExplicitPreference: boolean;
} {
  if (typeof window === 'undefined') {
    return { theme: 'dark', hasExplicitPreference: false };
  }
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return { theme: saved, hasExplicitPreference: true };
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
  return { theme: getSystemTheme(), hasExplicitPreference: false };
}

function applyThemeToDocument(theme: AtaTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      'content',
      theme === 'dark' ? '#090B14' : '#FFFFFF'
    );
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState(getInitialThemeState);

  useEffect(() => {
    applyThemeToDocument(state.theme);
  }, [state.theme]);

  useEffect(() => {
    if (state.hasExplicitPreference || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = () => {
      setState({
        theme: mediaQuery.matches ? 'light' : 'dark',
        hasExplicitPreference: false,
      });
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [state.hasExplicitPreference]);

  const setTheme = (nextTheme: AtaTheme) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage access errors
    }
    setState({ theme: nextTheme, hasExplicitPreference: true });
  };

  const toggleTheme = () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
  };

  const resetToSystemPreference = () => {
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      // Ignore storage access errors
    }
    setState({ theme: getSystemTheme(), hasExplicitPreference: false });
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: state.theme,
        hasExplicitPreference: state.hasExplicitPreference,
        toggleTheme,
        setTheme,
        resetToSystemPreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
