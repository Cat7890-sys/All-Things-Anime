import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  DEFAULT_USER_PREFERENCES,
  getUserPreferences,
  subscribeToUserPreferences,
  updateUserPreferences,
} from '../services/personalisation/userPreferencesService';
import type {
  AtaAccentColor,
  AtaFeedDensity,
  AtaThemePreference,
  AtaUserPreferences,
  UpdateUserPreferencesInput,
} from '../types';

export const ACCENT_COLOR_MAP: Record<
  AtaAccentColor,
  { name: string; hex: string; darkHex: string; glow: string }
> = {
  red: {
    name: 'ATA Red (Default)',
    hex: '#EF3038',
    darkHex: '#B92335',
    glow: 'rgba(239, 48, 56, 0.3)',
  },
  crimson: {
    name: 'Neon Crimson',
    hex: '#FF2A55',
    darkHex: '#D81A40',
    glow: 'rgba(255, 42, 85, 0.3)',
  },
  amber: {
    name: 'Solar Amber',
    hex: '#FF6B00',
    darkHex: '#D95700',
    glow: 'rgba(255, 107, 0, 0.3)',
  },
  violet: {
    name: 'Cyber Violet',
    hex: '#9D4EDD',
    darkHex: '#7B2CBF',
    glow: 'rgba(157, 78, 221, 0.3)',
  },
  azure: {
    name: 'Electric Azure',
    hex: '#0096FF',
    darkHex: '#0077D9',
    glow: 'rgba(0, 150, 255, 0.3)',
  },
  emerald: {
    name: 'Neon Emerald',
    hex: '#00E599',
    darkHex: '#00B377',
    glow: 'rgba(0, 229, 153, 0.3)',
  },
};

interface PreferencesContextValue {
  preferences: AtaUserPreferences;
  isLoading: boolean;
  updatePreferences: (input: UpdateUserPreferencesInput) => Promise<void>;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
  accentInfo: { name: string; hex: string; darkHex: string; glow: string };
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(
  undefined
);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { firebaseUser } = useAuth();
  const [preferences, setPreferences] = useState<AtaUserPreferences>({
    userId: '',
    ...DEFAULT_USER_PREFERENCES,
    updatedAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  useEffect(() => {
    if (!firebaseUser) {
      setPreferences({
        userId: '',
        ...DEFAULT_USER_PREFERENCES,
        updatedAt: null,
      });
      setIsLoading(false);
      return;
    }

    const unsub = subscribeToUserPreferences(
      firebaseUser.uid,
      (prefs) => {
        setPreferences(prefs);
        setIsLoading(false);

        // If verified user has not completed onboarding and has no favourite genres configured, offer onboarding
        if (
          firebaseUser.emailVerified &&
          !prefs.onboardingCompleted &&
          prefs.favouriteAnimeTitles.length === 0
        ) {
          setIsOnboardingOpen(true);
        }
      },
      () => {
        setIsLoading(false);
      }
    );

    return () => {
      unsub();
    };
  }, [firebaseUser]);

  // Apply theme & accent variables dynamically
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const accent = ACCENT_COLOR_MAP[preferences.accentColor] || ACCENT_COLOR_MAP.red;

    root.style.setProperty('--ata-accent-main', accent.hex);
    root.style.setProperty('--ata-accent-dark', accent.darkHex);
    root.style.setProperty('--ata-accent-glow', accent.glow);

    // Feed density class
    if (preferences.feedDensity === 'compact') {
      root.classList.add('ata-density-compact');
      root.classList.remove('ata-density-comfortable');
    } else {
      root.classList.add('ata-density-comfortable');
      root.classList.remove('ata-density-compact');
    }

    // Reduced motion preference
    if (preferences.reducedMotion) {
      root.classList.add('ata-reduced-motion');
    } else {
      root.classList.remove('ata-reduced-motion');
    }
  }, [preferences.accentColor, preferences.feedDensity, preferences.reducedMotion]);

  const handleUpdate = async (input: UpdateUserPreferencesInput) => {
    if (!firebaseUser) return;
    setPreferences((prev) => ({ ...prev, ...input }));
    if (!firebaseUser.emailVerified) return;
    await updateUserPreferences(firebaseUser.uid, input);
  };

  const accentInfo =
    ACCENT_COLOR_MAP[preferences.accentColor] || ACCENT_COLOR_MAP.red;

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        isLoading,
        updatePreferences: handleUpdate,
        isOnboardingOpen,
        setIsOnboardingOpen,
        accentInfo,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return ctx;
}
