import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  AtaUserPreferences,
  DashboardWidgetConfig,
  UpdateUserPreferencesInput,
} from '../../types';
import { db, handleFirestoreError, OperationType } from '../firebase';

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'continue_watching', label: 'Continue Watching', enabled: true, order: 0 },
  { id: 'watchlist_summary', label: 'Watchlist Overview', enabled: true, order: 1 },
  { id: 'recent_added', label: 'Recently Added', enabled: true, order: 2 },
  { id: 'favourite_genres', label: 'Favourite Genres', enabled: true, order: 3 },
  { id: 'recommendations', label: 'Recommended For You', enabled: true, order: 4 },
  { id: 'personal_stats', label: 'Anime Activity Insights', enabled: true, order: 5 },
  { id: 'recent_collections', label: 'My Collections', enabled: true, order: 6 },
  { id: 'community_activity', label: 'Community Signals', enabled: false, order: 7 },
];

export const DEFAULT_USER_PREFERENCES: Omit<
  AtaUserPreferences,
  'userId' | 'updatedAt'
> = {
  themePreference: 'dark',
  accentColor: 'red',
  feedDensity: 'comfortable',
  reducedMotion: false,
  defaultFeed: 'for_you',
  hiddenTopics: [],
  hiddenGenres: [],
  recommendationsEnabled: true,
  onboardingCompleted: false,
  profileBannerUrl: '',
  profileAccentColor: '#EF3038',
  favouriteQuote: '',
  favouriteAnimeTitles: [],
  favouriteCharacters: [],
  favouriteGenres: ['Action', 'Adventure', 'Fantasy & Isekai'],
  preferredFormats: ['TV Series', 'Movie'],
  preferredPeriods: ['Modern Era (2020-2024)', 'Current Airing (2025-2026)'],
  topicsToAvoid: [],
  dashboardWidgets: DEFAULT_DASHBOARD_WIDGETS,
};

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (typeof value === 'object' && value && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function mapDocToUserPreferences(
  userId: string,
  data?: Record<string, unknown> | null
): AtaUserPreferences {
  if (!data) {
    return {
      userId,
      ...DEFAULT_USER_PREFERENCES,
      updatedAt: null,
    };
  }

  return {
    userId,
    themePreference:
      (data.themePreference as AtaUserPreferences['themePreference']) || 'dark',
    accentColor:
      (data.accentColor as AtaUserPreferences['accentColor']) || 'red',
    feedDensity:
      (data.feedDensity as AtaUserPreferences['feedDensity']) || 'comfortable',
    reducedMotion: Boolean(data.reducedMotion),
    defaultFeed:
      (data.defaultFeed as AtaUserPreferences['defaultFeed']) || 'for_you',
    hiddenTopics: Array.isArray(data.hiddenTopics) ? (data.hiddenTopics as string[]) : [],
    hiddenGenres: Array.isArray(data.hiddenGenres) ? (data.hiddenGenres as string[]) : [],
    recommendationsEnabled:
      typeof data.recommendationsEnabled === 'boolean'
        ? data.recommendationsEnabled
        : true,
    onboardingCompleted: Boolean(data.onboardingCompleted),
    profileBannerUrl:
      typeof data.profileBannerUrl === 'string' ? data.profileBannerUrl : '',
    profileAccentColor:
      typeof data.profileAccentColor === 'string'
        ? data.profileAccentColor
        : '#EF3038',
    favouriteQuote:
      typeof data.favouriteQuote === 'string' ? data.favouriteQuote : '',
    favouriteAnimeTitles: Array.isArray(data.favouriteAnimeTitles)
      ? (data.favouriteAnimeTitles as string[])
      : [],
    favouriteCharacters: Array.isArray(data.favouriteCharacters)
      ? (data.favouriteCharacters as string[])
      : [],
    favouriteGenres: Array.isArray(data.favouriteGenres)
      ? (data.favouriteGenres as string[])
      : DEFAULT_USER_PREFERENCES.favouriteGenres,
    preferredFormats: Array.isArray(data.preferredFormats)
      ? (data.preferredFormats as string[])
      : DEFAULT_USER_PREFERENCES.preferredFormats,
    preferredPeriods: Array.isArray(data.preferredPeriods)
      ? (data.preferredPeriods as string[])
      : DEFAULT_USER_PREFERENCES.preferredPeriods,
    topicsToAvoid: Array.isArray(data.topicsToAvoid)
      ? (data.topicsToAvoid as string[])
      : [],
    dashboardWidgets: Array.isArray(data.dashboardWidgets)
      ? (data.dashboardWidgets as DashboardWidgetConfig[])
      : DEFAULT_DASHBOARD_WIDGETS,
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export async function getUserPreferences(
  userId: string
): Promise<AtaUserPreferences> {
  if (!userId) {
    return {
      userId: '',
      ...DEFAULT_USER_PREFERENCES,
      updatedAt: null,
    };
  }

  const path = `userPreferences/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'userPreferences', userId));
    return mapDocToUserPreferences(userId, snap.exists() ? snap.data() : null);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeToUserPreferences(
  userId: string,
  onPreferences: (prefs: AtaUserPreferences) => void,
  onError?: (errMessage: string) => void
): Unsubscribe {
  if (!userId) {
    onPreferences({
      userId: '',
      ...DEFAULT_USER_PREFERENCES,
      updatedAt: null,
    });
    return () => {};
  }

  const path = `userPreferences/${userId}`;
  return onSnapshot(
    doc(db, 'userPreferences', userId),
    (snapshot) => {
      onPreferences(
        mapDocToUserPreferences(
          userId,
          snapshot.exists() ? snapshot.data() : null
        )
      );
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (err) {
        onError?.(
          err instanceof Error
            ? err.message
            : 'Unable to load user preferences.'
        );
      }
    }
  );
}

export async function updateUserPreferences(
  userId: string,
  input: UpdateUserPreferencesInput
): Promise<AtaUserPreferences> {
  if (!userId) {
    throw new Error('User ID is required.');
  }

  const path = `userPreferences/${userId}`;
  try {
    const current = await getUserPreferences(userId);
    const updated: AtaUserPreferences = {
      ...current,
      ...input,
      userId,
      updatedAt: new Date(),
    };

    const payload = {
      userId,
      themePreference: updated.themePreference,
      accentColor: updated.accentColor,
      feedDensity: updated.feedDensity,
      reducedMotion: Boolean(updated.reducedMotion),
      defaultFeed: updated.defaultFeed,
      hiddenTopics: updated.hiddenTopics || [],
      hiddenGenres: updated.hiddenGenres || [],
      recommendationsEnabled: Boolean(updated.recommendationsEnabled),
      onboardingCompleted: Boolean(updated.onboardingCompleted),
      profileBannerUrl: updated.profileBannerUrl || '',
      profileAccentColor: updated.profileAccentColor || '#EF3038',
      favouriteQuote: updated.favouriteQuote || '',
      favouriteAnimeTitles: updated.favouriteAnimeTitles || [],
      favouriteCharacters: updated.favouriteCharacters || [],
      favouriteGenres: updated.favouriteGenres || [],
      preferredFormats: updated.preferredFormats || [],
      preferredPeriods: updated.preferredPeriods || [],
      topicsToAvoid: updated.topicsToAvoid || [],
      dashboardWidgets: updated.dashboardWidgets || DEFAULT_DASHBOARD_WIDGETS,
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'userPreferences', userId), payload, { merge: true });
    return updated;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function resetUserPreferences(
  userId: string
): Promise<AtaUserPreferences> {
  return updateUserPreferences(userId, {
    ...DEFAULT_USER_PREFERENCES,
  });
}
