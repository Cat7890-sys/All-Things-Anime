import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  AtaUserPreferences,
  DashboardWidgetConfig,
  RecommendationCategoryId,
  RecommendationDiversity,
  UpdateUserPreferencesInput,
} from '../../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  APPROVED_RECOMMENDATION_CATEGORIES,
  validateAccentColor,
  validateDefaultFeedTab,
  validateFavouriteQuote,
  validateFeedDensity,
  validateOptionalHttpsUrl,
  validatePreferenceStringList,
  validateRecommendationDiversity,
  validateThemePreference,
} from '../validation';

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'recommendations', label: 'Recommended For You', enabled: true, order: 0 },
  { id: 'continue_watching', label: 'Continue Watching', enabled: true, order: 1 },
  { id: 'recent_added', label: 'Recently Added', enabled: true, order: 2 },
  { id: 'favourite_anime', label: 'Favourite Anime', enabled: true, order: 3 },
  { id: 'recent_collections', label: 'Custom Collections', enabled: true, order: 4 },
  { id: 'currently_airing', label: 'Currently Airing Anime', enabled: true, order: 5 },
  { id: 'trending_interests', label: 'Trending In Your Interests', enabled: true, order: 6 },
  { id: 'personal_stats', label: 'Personal Stats & Insights', enabled: true, order: 7 },
  { id: 'recently_completed', label: 'Recently Completed', enabled: true, order: 8 },
  { id: 'upcoming_anime', label: 'Upcoming Anime', enabled: true, order: 9 },
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
  favouriteGenres: ['Action', 'Adventure', 'Fantasy'],
  favouriteThemes: ['Atmospheric', 'Character Driven'],
  preferredFormats: ['TV Series', 'Movie'],
  preferredPeriods: ['Modern Era (2020-2024)', 'Current Airing (2025-2026)'],
  favouriteStudios: [],
  preferredTypes: ['Any Adaptation or Original'],
  avoidAnimeIds: [],
  avoidAnimeTitles: [],
  topicsToAvoid: [],
  preferredRecommendationCategories: [
    'recommended_for_you',
    'because_you_watched',
    'similar_anime',
    'hidden_gems',
    'trending_in_interests',
    'continue_exploring',
  ],
  prioritiseAiring: false,
  prioritiseCompleted: false,
  includeOlderAnime: true,
  prioritiseHighlyRated: true,
  showLesserKnown: false,
  recommendationDiversity: 'balanced',
  showAnimeStatsOnProfile: true,
  showFavouriteAnimeOnProfile: true,
  showCollectionsOnProfile: true,
  dashboardWidgets: DEFAULT_DASHBOARD_WIDGETS,
};

const VALID_WIDGET_IDS = new Set(DEFAULT_DASHBOARD_WIDGETS.map((w) => w.id));
const VALID_REC_CATEGORY_SET = new Set<string>(
  APPROVED_RECOMMENDATION_CATEGORIES
);

export function normalizeDashboardWidgets(
  raw: unknown
): DashboardWidgetConfig[] {
  const defaultsMap = new Map(
    DEFAULT_DASHBOARD_WIDGETS.map((w) => [w.id, w])
  );

  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_DASHBOARD_WIDGETS.map((w) => ({ ...w }));
  }

  const seen = new Set<string>();
  const parsed: DashboardWidgetConfig[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id : '';
    if (!VALID_WIDGET_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    const def = defaultsMap.get(id)!;
    parsed.push({
      id,
      label: def.label,
      enabled: typeof obj.enabled === 'boolean' ? obj.enabled : def.enabled,
      order: typeof obj.order === 'number' ? obj.order : def.order,
    });
  }

  parsed.sort((a, b) => a.order - b.order);

  for (const def of DEFAULT_DASHBOARD_WIDGETS) {
    if (!seen.has(def.id)) {
      parsed.push({ ...def });
    }
  }

  return parsed.map((w, idx) => ({ ...w, order: idx }));
}

export function reorderDashboardWidget(
  widgets: DashboardWidgetConfig[],
  widgetId: string,
  direction: 'up' | 'down'
): DashboardWidgetConfig[] {
  const normalized = normalizeDashboardWidgets(widgets);
  const index = normalized.findIndex((w) => w.id === widgetId);
  if (index === -1) return normalized;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= normalized.length) {
    return normalized;
  }

  const copy = [...normalized];
  const [moved] = copy.splice(index, 1);
  copy.splice(targetIndex, 0, moved);

  return copy.map((w, idx) => ({ ...w, order: idx }));
}

export function restoreDefaultDashboardWidgets(): DashboardWidgetConfig[] {
  return DEFAULT_DASHBOARD_WIDGETS.map((w) => ({ ...w }));
}

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (
    typeof value === 'object' &&
    value &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function stringList(raw: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  return Array.from(
    new Set(
      raw
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function mapDocToUserPreferences(
  userId: string,
  data?: Record<string, unknown> | null
): AtaUserPreferences {
  if (!data) {
    return {
      userId,
      ...DEFAULT_USER_PREFERENCES,
      dashboardWidgets: restoreDefaultDashboardWidgets(),
      updatedAt: null,
    };
  }

  const rawCategories = stringList(
    data.preferredRecommendationCategories,
    DEFAULT_USER_PREFERENCES.preferredRecommendationCategories
  ).filter((cat): cat is RecommendationCategoryId =>
    VALID_REC_CATEGORY_SET.has(cat)
  );

  const diversityRaw =
    typeof data.recommendationDiversity === 'string'
      ? data.recommendationDiversity
      : 'balanced';
  const recommendationDiversity: RecommendationDiversity =
    diversityRaw === 'focused' ||
    diversityRaw === 'balanced' ||
    diversityRaw === 'diverse'
      ? diversityRaw
      : 'balanced';

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
    hiddenTopics: stringList(data.hiddenTopics),
    hiddenGenres: stringList(data.hiddenGenres),
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
    favouriteAnimeTitles: stringList(data.favouriteAnimeTitles),
    favouriteCharacters: stringList(data.favouriteCharacters),
    favouriteGenres: stringList(
      data.favouriteGenres,
      DEFAULT_USER_PREFERENCES.favouriteGenres
    ),
    favouriteThemes: stringList(
      data.favouriteThemes,
      DEFAULT_USER_PREFERENCES.favouriteThemes
    ),
    preferredFormats: stringList(
      data.preferredFormats,
      DEFAULT_USER_PREFERENCES.preferredFormats
    ),
    preferredPeriods: stringList(
      data.preferredPeriods,
      DEFAULT_USER_PREFERENCES.preferredPeriods
    ),
    favouriteStudios: stringList(data.favouriteStudios),
    preferredTypes: stringList(
      data.preferredTypes,
      DEFAULT_USER_PREFERENCES.preferredTypes
    ),
    avoidAnimeIds: stringList(data.avoidAnimeIds),
    avoidAnimeTitles: stringList(data.avoidAnimeTitles),
    topicsToAvoid: stringList(data.topicsToAvoid),
    preferredRecommendationCategories:
      rawCategories.length > 0
        ? rawCategories
        : [...DEFAULT_USER_PREFERENCES.preferredRecommendationCategories],
    prioritiseAiring: Boolean(data.prioritiseAiring),
    prioritiseCompleted: Boolean(data.prioritiseCompleted),
    includeOlderAnime:
      typeof data.includeOlderAnime === 'boolean'
        ? data.includeOlderAnime
        : true,
    prioritiseHighlyRated:
      typeof data.prioritiseHighlyRated === 'boolean'
        ? data.prioritiseHighlyRated
        : true,
    showLesserKnown: Boolean(data.showLesserKnown),
    recommendationDiversity,
    showAnimeStatsOnProfile:
      typeof data.showAnimeStatsOnProfile === 'boolean'
        ? data.showAnimeStatsOnProfile
        : true,
    showFavouriteAnimeOnProfile:
      typeof data.showFavouriteAnimeOnProfile === 'boolean'
        ? data.showFavouriteAnimeOnProfile
        : true,
    showCollectionsOnProfile:
      typeof data.showCollectionsOnProfile === 'boolean'
        ? data.showCollectionsOnProfile
        : true,
    dashboardWidgets: normalizeDashboardWidgets(data.dashboardWidgets),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

function validatePreferencesUpdate(input: UpdateUserPreferencesInput): void {
  if (input.themePreference) {
    const err = validateThemePreference(input.themePreference);
    if (err) throw new Error(err);
  }
  if (input.accentColor) {
    const err = validateAccentColor(input.accentColor);
    if (err) throw new Error(err);
  }
  if (input.feedDensity) {
    const err = validateFeedDensity(input.feedDensity);
    if (err) throw new Error(err);
  }
  if (input.defaultFeed) {
    const err = validateDefaultFeedTab(input.defaultFeed);
    if (err) throw new Error(err);
  }
  if (input.recommendationDiversity) {
    const err = validateRecommendationDiversity(input.recommendationDiversity);
    if (err) throw new Error(err);
  }
  if (input.profileBannerUrl !== undefined) {
    const err = validateOptionalHttpsUrl(
      input.profileBannerUrl,
      1000,
      'Profile banner URL'
    );
    if (err) throw new Error(err);
  }
  if (input.favouriteQuote !== undefined) {
    const err = validateFavouriteQuote(input.favouriteQuote);
    if (err) throw new Error(err);
  }
  if (input.favouriteGenres) {
    const err = validatePreferenceStringList(
      input.favouriteGenres,
      20,
      60,
      'Favourite genres'
    );
    if (err) throw new Error(err);
  }
  if (input.topicsToAvoid) {
    const err = validatePreferenceStringList(
      input.topicsToAvoid,
      30,
      60,
      'Topics to avoid'
    );
    if (err) throw new Error(err);
  }
  if (input.avoidAnimeIds) {
    const err = validatePreferenceStringList(
      input.avoidAnimeIds,
      50,
      40,
      'Avoid anime list'
    );
    if (err) throw new Error(err);
  }
}

export async function getUserPreferences(
  userId: string
): Promise<AtaUserPreferences> {
  if (!userId) {
    return {
      userId: '',
      ...DEFAULT_USER_PREFERENCES,
      dashboardWidgets: restoreDefaultDashboardWidgets(),
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
      dashboardWidgets: restoreDefaultDashboardWidgets(),
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

  validatePreferencesUpdate(input);

  const path = `userPreferences/${userId}`;
  try {
    const current = await getUserPreferences(userId);
    const updated: AtaUserPreferences = {
      ...current,
      ...input,
      userId,
      dashboardWidgets: normalizeDashboardWidgets(
        input.dashboardWidgets ?? current.dashboardWidgets
      ),
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
      profileBannerUrl: (updated.profileBannerUrl || '').trim(),
      profileAccentColor: updated.profileAccentColor || '#EF3038',
      favouriteQuote: (updated.favouriteQuote || '').trim(),
      favouriteAnimeTitles: (updated.favouriteAnimeTitles || []).slice(0, 15),
      favouriteCharacters: (updated.favouriteCharacters || []).slice(0, 15),
      favouriteGenres: (updated.favouriteGenres || []).slice(0, 20),
      favouriteThemes: (updated.favouriteThemes || []).slice(0, 20),
      preferredFormats: (updated.preferredFormats || []).slice(0, 10),
      preferredPeriods: (updated.preferredPeriods || []).slice(0, 10),
      favouriteStudios: (updated.favouriteStudios || []).slice(0, 20),
      preferredTypes: (updated.preferredTypes || []).slice(0, 10),
      avoidAnimeIds: (updated.avoidAnimeIds || []).slice(0, 50),
      avoidAnimeTitles: (updated.avoidAnimeTitles || []).slice(0, 50),
      topicsToAvoid: (updated.topicsToAvoid || []).slice(0, 30),
      preferredRecommendationCategories:
        updated.preferredRecommendationCategories.length > 0
          ? updated.preferredRecommendationCategories
          : DEFAULT_USER_PREFERENCES.preferredRecommendationCategories,
      prioritiseAiring: Boolean(updated.prioritiseAiring),
      prioritiseCompleted: Boolean(updated.prioritiseCompleted),
      includeOlderAnime: Boolean(updated.includeOlderAnime),
      prioritiseHighlyRated: Boolean(updated.prioritiseHighlyRated),
      showLesserKnown: Boolean(updated.showLesserKnown),
      recommendationDiversity: updated.recommendationDiversity,
      showAnimeStatsOnProfile: Boolean(updated.showAnimeStatsOnProfile),
      showFavouriteAnimeOnProfile: Boolean(updated.showFavouriteAnimeOnProfile),
      showCollectionsOnProfile: Boolean(updated.showCollectionsOnProfile),
      dashboardWidgets: updated.dashboardWidgets,
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'userPreferences', userId), payload, { merge: true });
    return updated;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes('permission')
    ) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    throw error;
  }
}

export async function resetUserPreferences(
  userId: string
): Promise<AtaUserPreferences> {
  return updateUserPreferences(userId, {
    ...DEFAULT_USER_PREFERENCES,
    dashboardWidgets: restoreDefaultDashboardWidgets(),
  });
}
