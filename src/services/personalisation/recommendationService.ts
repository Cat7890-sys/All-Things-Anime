import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import type {
  AnimeRecommendation,
  AtaUserPreferences,
  RecommendationCategoryId,
  RecommendationFeedbackType,
  UserAnimeListItem,
} from '../../types';
import { anilistService, parseAniListNumericId } from '../catalogue/anilistService';
import type { NormalizedAnime } from '../catalogue/anilistTypes';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  getCachedValue,
  getOrFetch,
  invalidateCacheKey,
  setCacheValue,
} from '../memoryCache';

const REC_FEEDBACK_CACHE_TTL_MS = 3 * 60_000;
const REC_FEEDBACK_QUERY_LIMIT = 300;

export const RECOMMENDATION_CATEGORY_META: Record<
  RecommendationCategoryId,
  {
    id: RecommendationCategoryId;
    label: string;
    reasonCategory: AnimeRecommendation['reasonCategory'];
    subtitle: string;
  }
> = {
  recommended_for_you: {
    id: 'recommended_for_you',
    label: 'Recommended For You',
    reasonCategory: 'Recommended For You',
    subtitle: 'Weighted blend of your genres, themes, formats, and tracked tastes.',
  },
  because_you_watched: {
    id: 'because_you_watched',
    label: 'Because You Watched',
    reasonCategory: 'Because You Watched',
    subtitle: 'Connected to your favourite titles and highest-rated completed series.',
  },
  similar_anime: {
    id: 'similar_anime',
    label: 'Similar Anime',
    reasonCategory: 'Similar Anime',
    subtitle: 'Strong genre, tag, and studio overlap with series you enjoy.',
  },
  hidden_gems: {
    id: 'hidden_gems',
    label: 'Hidden Gems',
    reasonCategory: 'Hidden Gems',
    subtitle: 'High-rated AniList standouts beyond the loudest mainstream charts.',
  },
  trending_in_interests: {
    id: 'trending_in_interests',
    label: 'Trending In Your Interests',
    reasonCategory: 'Trending In Your Interests',
    subtitle: 'Currently trending or airing series matching your personal taste profile.',
  },
  continue_exploring: {
    id: 'continue_exploring',
    label: 'Continue Exploring',
    reasonCategory: 'Continue Exploring',
    subtitle: 'Adjacent genres and acclaimed series tailored for discovery.',
  },
};

const GENRE_ALIAS_MAP: Record<string, string[]> = {
  'fantasy & isekai': ['fantasy', 'adventure'],
  'mecha & sci-fi': ['mecha', 'sci-fi'],
  'animation & sakuga': ['action'],
  'manga & light novels': [],
};

export function expandPreferenceGenres(genres: string[]): string[] {
  const tokens = new Set<string>();
  for (const g of genres) {
    const lower = g.trim().toLowerCase();
    if (!lower) continue;
    tokens.add(lower);
    const mapped = GENRE_ALIAS_MAP[lower];
    if (mapped) {
      mapped.forEach((m) => tokens.add(m));
    }
  }
  return Array.from(tokens);
}

export function normalizeAniListGenreFilters(genres: string[]): string[] {
  const canonical = new Set<string>();
  for (const g of genres) {
    const lower = g.trim().toLowerCase();
    if (!lower) continue;
    if (lower === 'fantasy & isekai') {
      canonical.add('Fantasy');
    } else if (lower === 'mecha & sci-fi') {
      canonical.add('Mecha');
      canonical.add('Sci-Fi');
    } else if (
      lower !== 'animation & sakuga' &&
      lower !== 'manga & light novels' &&
      lower !== 'shonen' &&
      lower !== 'seinen' &&
      lower !== 'shojo' &&
      lower !== 'josei' &&
      lower !== 'school' &&
      lower !== 'historical'
    ) {
      canonical.add(g.trim());
    }
  }
  return Array.from(canonical);
}

function normalizeFormatToken(format: string): string {
  const lower = format.trim().toLowerCase();
  if (lower === 'tv' || lower === 'tv series') return 'tv';
  if (lower === 'tv_short' || lower === 'tv short') return 'tv_short';
  if (lower === 'movie') return 'movie';
  if (lower === 'ova') return 'ova';
  if (lower === 'ona') return 'ona';
  if (lower === 'special') return 'special';
  return lower;
}

function matchesReleasePeriod(
  seasonYear: number | null,
  preferredPeriods: string[]
): boolean {
  if (!seasonYear || preferredPeriods.length === 0) return false;
  for (const period of preferredPeriods) {
    const p = period.toLowerCase();
    if (p.includes('2025') || p.includes('2026') || p.includes('current')) {
      if (seasonYear >= 2025) return true;
    } else if (p.includes('2020') || p.includes('modern')) {
      if (seasonYear >= 2020 && seasonYear <= 2024) return true;
    } else if (p.includes('2010') || p.includes('golden')) {
      if (seasonYear >= 2010 && seasonYear <= 2019) return true;
    } else if (p.includes('2000')) {
      if (seasonYear >= 2000 && seasonYear <= 2009) return true;
    } else if (p.includes('classic') || p.includes('90')) {
      if (seasonYear < 2000) return true;
    }
  }
  return false;
}

export async function getUserRecommendationFeedback(
  userId: string
): Promise<Record<string, RecommendationFeedbackType>> {
  if (!userId) return {};
  const path = `recommendationFeedback/${userId}/items`;
  return getOrFetch(
    `recFeedback:${userId}`,
    async () => {
      try {
        const snap = await getDocs(
          query(collection(db, path), limit(REC_FEEDBACK_QUERY_LIMIT))
        );
        const map: Record<string, RecommendationFeedbackType> = {};
        for (const d of snap.docs) {
          map[d.id] = d.data().feedbackType as RecommendationFeedbackType;
        }
        return map;
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
        return {};
      }
    },
    { ttlMs: REC_FEEDBACK_CACHE_TTL_MS, uid: userId }
  );
}

export async function recordRecommendationFeedback(
  userId: string,
  animeId: string,
  feedbackType: RecommendationFeedbackType,
  reason?: string
): Promise<void> {
  if (!userId || !animeId) return;
  const path = `recommendationFeedback/${userId}/items/${animeId}`;
  const docRef = doc(db, 'recommendationFeedback', userId, 'items', animeId);
  try {
    await setDoc(
      docRef,
      {
        animeId,
        feedbackType,
        reason: reason || '',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    const cacheKey = `recFeedback:${userId}`;
    const cached =
      getCachedValue<Record<string, RecommendationFeedbackType>>(cacheKey);
    if (cached !== undefined) {
      setCacheValue(
        cacheKey,
        { ...cached, [animeId]: feedbackType },
        { ttlMs: REC_FEEDBACK_CACHE_TTL_MS, uid: userId }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function clearRecommendationFeedback(
  userId: string
): Promise<void> {
  if (!userId) return;
  const path = `recommendationFeedback/${userId}/items`;
  try {
    const snap = await getDocs(
      query(collection(db, path), limit(REC_FEEDBACK_QUERY_LIMIT))
    );
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    invalidateCacheKey(`recFeedback:${userId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface RecommendationFilterContext {
  trackedIds: Set<string>;
  completedOrDroppedIds: Set<string>;
  avoidIds: Set<string>;
  avoidTitlesLower: string[];
  hiddenGenres: Set<string>;
  topicsToAvoid: string[];
  feedbackMap: Record<string, RecommendationFeedbackType>;
  includeOlderAnime: boolean;
}

export function buildFilterContext(
  preferences: AtaUserPreferences | null,
  watchlist: UserAnimeListItem[],
  feedbackMap: Record<string, RecommendationFeedbackType>
): RecommendationFilterContext {
  const trackedIds = new Set<string>();
  const completedOrDroppedIds = new Set<string>();

  for (const w of watchlist) {
    trackedIds.add(String(w.animeId));
    const numericId = parseAniListNumericId(w.animeId);
    if (numericId) trackedIds.add(String(numericId));
    if (w.status === 'completed' || w.status === 'dropped') {
      completedOrDroppedIds.add(String(w.animeId));
      if (numericId) completedOrDroppedIds.add(String(numericId));
    }
  }

  const avoidIds = new Set<string>(
    (preferences?.avoidAnimeIds || []).map((id) => String(id).trim()).filter(Boolean)
  );
  const avoidTitlesLower = (preferences?.avoidAnimeTitles || [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const hiddenGenres = new Set(
    expandPreferenceGenres(preferences?.hiddenGenres || [])
  );

  const topicsToAvoid = Array.from(
    new Set([
      ...(preferences?.topicsToAvoid || []),
      ...(preferences?.hiddenTopics || []),
    ])
  )
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  return {
    trackedIds,
    completedOrDroppedIds,
    avoidIds,
    avoidTitlesLower,
    hiddenGenres,
    topicsToAvoid,
    feedbackMap,
    includeOlderAnime:
      preferences?.includeOlderAnime === undefined
        ? true
        : Boolean(preferences.includeOlderAnime),
  };
}

export function filterRecommendationCandidate(
  anime: NormalizedAnime,
  ctx: RecommendationFilterContext,
  options?: { allowTrackedIfNotCompletedOrDropped?: boolean }
): boolean {
  if (anime.isAdult !== false) {
    return false;
  }

  const idStr = String(anime.id);
  const feedback = ctx.feedbackMap[idStr];
  if (feedback === 'not_interested' || feedback === 'dislike') {
    return false;
  }

  if (ctx.avoidIds.has(idStr)) {
    return false;
  }

  if (ctx.completedOrDroppedIds.has(idStr)) {
    return false;
  }

  if (!options?.allowTrackedIfNotCompletedOrDropped && ctx.trackedIds.has(idStr)) {
    return false;
  }

  const titles = [
    anime.title.display,
    anime.title.english || '',
    anime.title.romaji || '',
  ]
    .map((t) => t.toLowerCase())
    .filter(Boolean);

  if (
    ctx.avoidTitlesLower.some((avoid) =>
      titles.some((t) => t.includes(avoid) || avoid.includes(t))
    )
  ) {
    return false;
  }

  const animeGenresLower = anime.genres.map((g) => g.toLowerCase());
  if (animeGenresLower.some((g) => ctx.hiddenGenres.has(g))) {
    return false;
  }

  if (ctx.topicsToAvoid.length > 0) {
    const searchable = [
      ...titles,
      ...animeGenresLower,
      ...(anime.tags || []).map((t) => t.toLowerCase()),
      (anime.description || '').toLowerCase(),
    ].join(' ');
    if (ctx.topicsToAvoid.some((topic) => searchable.includes(topic))) {
      return false;
    }
  }

  if (
    !ctx.includeOlderAnime &&
    anime.seasonYear !== null &&
    anime.seasonYear < 2010
  ) {
    return false;
  }

  return true;
}

export interface RecommendationSeedProfile {
  seedGenres: Set<string>;
  seedTags: Set<string>;
  seedStudios: Set<string>;
  seedTitles: Array<{ title: string; genres: string[]; id: string }>;
}

export function buildSeedProfile(
  preferences: AtaUserPreferences | null,
  watchlist: UserAnimeListItem[]
): RecommendationSeedProfile {
  const positiveTracked = watchlist
    .filter(
      (w) =>
        w.status === 'completed' ||
        w.status === 'watching' ||
        (w.userRating !== null && w.userRating >= 7)
    )
    .sort((a, b) => (b.userRating || 6) - (a.userRating || 6));

  const seedGenres = new Set<string>();
  const seedTags = new Set<string>();
  const seedStudios = new Set<string>(
    (preferences?.favouriteStudios || []).map((s) => s.toLowerCase())
  );

  for (const w of positiveTracked.slice(0, 6)) {
    (w.genres || []).forEach((g) => seedGenres.add(g.toLowerCase()));
    (w.studios || []).forEach((s) => seedStudios.add(s.toLowerCase()));
  }

  (preferences?.favouriteThemes || []).forEach((t) =>
    seedTags.add(t.toLowerCase())
  );

  const seedTitles = positiveTracked.slice(0, 4).map((w) => ({
    id: String(w.animeId),
    title: w.animeTitle,
    genres: (w.genres || []).map((g) => g.toLowerCase()),
  }));

  return { seedGenres, seedTags, seedStudios, seedTitles };
}

export function scoreRecommendationCandidate(
  anime: NormalizedAnime,
  category: RecommendationCategoryId,
  preferences: AtaUserPreferences | null,
  seed: RecommendationSeedProfile,
  feedbackMap: Record<string, RecommendationFeedbackType>,
  indexSeedBoost: { seedTitle?: string; relationType?: string } = {}
): AnimeRecommendation | null {
  const userGenres = new Set(
    expandPreferenceGenres(preferences?.favouriteGenres || [])
  );
  const userFormats = new Set(
    (preferences?.preferredFormats || []).map(normalizeFormatToken)
  );
  const userThemes = new Set(
    (preferences?.favouriteThemes || []).map((t) => t.toLowerCase())
  );
  const userStudios = new Set(
    (preferences?.favouriteStudios || []).map((s) => s.toLowerCase())
  );
  const preferredPeriods = preferences?.preferredPeriods || [];
  const diversity = preferences?.recommendationDiversity || 'balanced';

  const matchedSignals: string[] = [];
  let score = 0;

  // Genre overlap (preference + positive watchlist)
  const matchedGenres: string[] = [];
  for (const g of anime.genres) {
    const lower = g.toLowerCase();
    if (userGenres.has(lower)) {
      matchedGenres.push(g);
      score += diversity === 'focused' ? 14 : diversity === 'balanced' ? 10 : 7;
    } else if (seed.seedGenres.has(lower)) {
      matchedGenres.push(g);
      score += 6;
    }
  }
  if (matchedGenres.length > 0) {
    matchedSignals.push(`Genres: ${matchedGenres.slice(0, 3).join(', ')}`);
  }

  // Themes / Tags
  const matchedTags = (anime.tags || []).filter((t) =>
    userThemes.has(t.toLowerCase())
  );
  if (matchedTags.length > 0) {
    score += matchedTags.length * 6;
    matchedSignals.push(`Themes: ${matchedTags.slice(0, 2).join(', ')}`);
  }

  // Studios
  const matchedStudios = anime.studios.filter(
    (s) => userStudios.has(s.toLowerCase()) || seed.seedStudios.has(s.toLowerCase())
  );
  if (matchedStudios.length > 0) {
    score += 8;
    matchedSignals.push(`Studio: ${matchedStudios[0]}`);
  }

  // Format preference
  if (
    anime.format !== 'UNKNOWN' &&
    userFormats.has(normalizeFormatToken(anime.format))
  ) {
    score += 5;
    matchedSignals.push(`Format: ${anime.formatLabel}`);
  }

  // Release period preference
  if (matchesReleasePeriod(anime.seasonYear, preferredPeriods)) {
    score += 5;
    if (anime.seasonYear) {
      matchedSignals.push(`Era: ${anime.seasonYear}`);
    }
  }

  // Quality score baseline (AniList 0..100 scale)
  const avgScore = anime.averageScore ?? 72;
  if (preferences?.prioritiseHighlyRated !== false) {
    score += Math.round((avgScore - 60) * 0.45);
    if (avgScore >= 82) {
      matchedSignals.push(`Rated ${avgScore}% on AniList`);
    }
  } else {
    score += Math.round((avgScore - 60) * 0.2);
  }

  // Content preference toggles
  if (preferences?.prioritiseAiring && anime.status === 'RELEASING') {
    score += 12;
    matchedSignals.push('Currently Airing');
  }
  if (preferences?.prioritiseCompleted && anime.status === 'FINISHED') {
    score += 10;
    matchedSignals.push('Complete Run');
  }
  if (
    preferences?.showLesserKnown &&
    (anime.popularity === null || anime.popularity < 110000)
  ) {
    score += 10;
    matchedSignals.push('Lesser-Known Discovery');
  }

  // Positive feedback boost
  const feedback = feedbackMap[String(anime.id)];
  if (feedback === 'like' || feedback === 'saved') {
    score += 12;
    matchedSignals.push(feedback === 'saved' ? 'Saved by you' : 'Liked by you');
  }

  // Category-specific scoring & qualification
  let seedAnimeTitle = indexSeedBoost.seedTitle;
  const meta = RECOMMENDATION_CATEGORY_META[category];
  let reasonDetail = meta.subtitle;

  if (category === 'because_you_watched') {
    if (!seedAnimeTitle && seed.seedTitles.length > 0) {
      const bestSeed = seed.seedTitles.find((seedEntry) =>
        anime.genres.some((g) => seedEntry.genres.includes(g.toLowerCase()))
      );
      if (bestSeed) {
        seedAnimeTitle = bestSeed.title;
        score += 12;
      }
    }
    if (!seedAnimeTitle) return null;
    score += 10;
    if (indexSeedBoost.relationType) {
      matchedSignals.unshift(`${indexSeedBoost.relationType} to ${seedAnimeTitle}`);
      reasonDetail = `Directly connected (${indexSeedBoost.relationType.toLowerCase()}) to ${seedAnimeTitle}.`;
    } else {
      matchedSignals.unshift(`Matches ${seedAnimeTitle}`);
      reasonDetail = `Recommended because you enjoyed ${seedAnimeTitle}${
        matchedGenres.length > 0 ? ` (${matchedGenres.slice(0, 2).join(', ')})` : ''
      }.`;
    }
  } else if (category === 'hidden_gems') {
    const isUnderexposed =
      anime.popularity === null || anime.popularity < 140000;
    const isHighRated = avgScore >= 75;
    if (!isUnderexposed || !isHighRated) return null;
    score += 14 + Math.round((avgScore - 75) * 0.5);
    reasonDetail = `High AniList score (${avgScore}%) with lower mainstream saturation.`;
    if (!matchedSignals.some((s) => s.includes('Rated'))) {
      matchedSignals.push(`Hidden standout (${avgScore}%)`);
    }
  } else if (category === 'trending_in_interests') {
    const isTrending =
      (anime.trending !== null && anime.trending > 0) ||
      anime.trendingRank !== null ||
      anime.status === 'RELEASING';
    if (!isTrending) return null;
    score += anime.trendingRank ? Math.max(4, 24 - anime.trendingRank) : 10;
    reasonDetail =
      matchedGenres.length > 0
        ? `Trending now across your interests (${matchedGenres.slice(0, 2).join(', ')}).`
        : 'Gaining strong momentum across AniList right now.';
    if (anime.trendingRank) {
      matchedSignals.unshift(`Trending #${anime.trendingRank}`);
    }
  } else if (category === 'similar_anime') {
    if (matchedGenres.length === 0 && matchedStudios.length === 0 && matchedTags.length === 0) {
      return null;
    }
    score += matchedGenres.length * 4 + matchedStudios.length * 4;
    reasonDetail = `Shares ${
      matchedGenres.length > 0
        ? matchedGenres.slice(0, 2).join(' & ')
        : matchedStudios[0] || 'key creative traits'
    } with your taste profile.`;
  } else if (category === 'continue_exploring') {
    // Rewards high-rated adjacent titles beyond top primary genres when diverse/balanced
    const adjacentCount = anime.genres.filter(
      (g) => !userGenres.has(g.toLowerCase())
    ).length;
    if (avgScore < 74) return null;
    score += diversity === 'diverse' ? adjacentCount * 6 : adjacentCount * 3;
    reasonDetail =
      matchedGenres.length > 0
        ? `Bridges ${matchedGenres[0]} with fresh themes to broaden your watchlist.`
        : 'Critically acclaimed adjacent discovery tailored for exploration.';
  } else {
    // recommended_for_you
    if (matchedSignals.length > 0) {
      reasonDetail = `Matched via ${matchedSignals.slice(0, 2).join(' • ')}.`;
    }
  }

  // Mild diversity jitter keeps varied runs feeling balanced without randomness bugs
  if (diversity === 'diverse' && matchedGenres.length <= 1 && avgScore >= 78) {
    score += 4;
  }

  return {
    anime,
    category,
    score: Math.max(1, Math.round(score)),
    reasonCategory: meta.reasonCategory,
    reasonDetail,
    matchedSignals: matchedSignals.slice(0, 4),
    seedAnimeTitle,
  };
}

export function buildRecommendationsFromPools(
  candidates: NormalizedAnime[],
  preferences: AtaUserPreferences | null,
  watchlist: UserAnimeListItem[] = [],
  feedbackMap: Record<string, RecommendationFeedbackType> = {},
  seedDetailAnime: NormalizedAnime[] = []
): {
  all: AnimeRecommendation[];
  byCategory: Record<RecommendationCategoryId, AnimeRecommendation[]>;
  usedCategories: RecommendationCategoryId[];
} {
  const byCategory: Record<RecommendationCategoryId, AnimeRecommendation[]> = {
    recommended_for_you: [],
    because_you_watched: [],
    similar_anime: [],
    hidden_gems: [],
    trending_in_interests: [],
    continue_exploring: [],
  };

  if (preferences && preferences.recommendationsEnabled === false) {
    return { all: [], byCategory, usedCategories: [] };
  }

  const ctx = buildFilterContext(preferences, watchlist, feedbackMap);
  const seed = buildSeedProfile(preferences, watchlist);

  // Deduplicate input candidates
  const uniqueMap = new Map<number, NormalizedAnime>();
  for (const item of candidates) {
    if (item && item.isAdult === false && !uniqueMap.has(item.id)) {
      uniqueMap.set(item.id, item);
    }
  }

  // Index direct relations / AniList recommendations from seed detail anime
  const relationBoosts = new Map<
    number,
    { seedTitle: string; relationType?: string }
  >();
  for (const seedAnime of seedDetailAnime) {
    for (const rel of seedAnime.relations || []) {
      if (rel.anime.isAdult === false) {
        if (!uniqueMap.has(rel.anime.id)) {
          uniqueMap.set(rel.anime.id, rel.anime);
        }
        if (!relationBoosts.has(rel.anime.id)) {
          relationBoosts.set(rel.anime.id, {
            seedTitle: seedAnime.title.display,
            relationType: rel.relationType,
          });
        }
      }
    }
    for (const rec of seedAnime.recommendations || []) {
      if (rec.anime.isAdult === false) {
        if (!uniqueMap.has(rec.anime.id)) {
          uniqueMap.set(rec.anime.id, rec.anime);
        }
        if (!relationBoosts.has(rec.anime.id)) {
          relationBoosts.set(rec.anime.id, {
            seedTitle: seedAnime.title.display,
          });
        }
      }
    }
  }

  const filteredCandidates = Array.from(uniqueMap.values()).filter((anime) =>
    filterRecommendationCandidate(anime, ctx)
  );

  const categories: RecommendationCategoryId[] = [
    'recommended_for_you',
    'because_you_watched',
    'similar_anime',
    'hidden_gems',
    'trending_in_interests',
    'continue_exploring',
  ];

  for (const category of categories) {
    const list: AnimeRecommendation[] = [];
    for (const anime of filteredCandidates) {
      const boost = relationBoosts.get(anime.id);
      const scored = scoreRecommendationCandidate(
        anime,
        category,
        preferences,
        seed,
        feedbackMap,
        boost
      );
      if (scored) {
        list.push(scored);
      }
    }
    list.sort((a, b) => b.score - a.score);
    byCategory[category] = list.slice(0, 18);
  }

  const preferredCategories =
    preferences?.preferredRecommendationCategories &&
    preferences.preferredRecommendationCategories.length > 0
      ? preferences.preferredRecommendationCategories
      : categories;

  // Build deduplicated master list prioritising user's preferred categories
  const seenAll = new Set<number>();
  const all: AnimeRecommendation[] = [];

  for (const cat of preferredCategories) {
    const items = byCategory[cat] || [];
    for (const rec of items.slice(0, 8)) {
      if (!seenAll.has(rec.anime.id)) {
        seenAll.add(rec.anime.id);
        all.push(rec);
      }
    }
  }

  // Top up with remaining recommended_for_you items
  for (const rec of byCategory.recommended_for_you) {
    if (!seenAll.has(rec.anime.id) && all.length < 24) {
      seenAll.add(rec.anime.id);
      all.push(rec);
    }
  }

  all.sort((a, b) => b.score - a.score);

  const usedCategories = preferredCategories.filter(
    (cat) => byCategory[cat].length > 0
  );

  return {
    all: all.slice(0, 24),
    byCategory,
    usedCategories,
  };
}

export async function generateRecommendationsByCategory(
  preferences: AtaUserPreferences | null,
  watchlist: UserAnimeListItem[] = [],
  feedbackMap: Record<string, RecommendationFeedbackType> = {}
): Promise<{
  all: AnimeRecommendation[];
  byCategory: Record<RecommendationCategoryId, AnimeRecommendation[]>;
  usedCategories: RecommendationCategoryId[];
  isLimitedMode: boolean;
}> {
  if (preferences && preferences.recommendationsEnabled === false) {
    return {
      all: [],
      byCategory: {
        recommended_for_you: [],
        because_you_watched: [],
        similar_anime: [],
        hidden_gems: [],
        trending_in_interests: [],
        continue_exploring: [],
      },
      usedCategories: [],
      isLimitedMode: false,
    };
  }

  const categoryResults = await Promise.allSettled([
    anilistService.getCategory('popular', { perPage: 25 }),
    anilistService.getCategory('trending', { perPage: 25 }),
    anilistService.getCategory('top_rated', { perPage: 25 }),
    anilistService.getCategory('seasonal', { perPage: 20 }),
    anilistService.getCategory('currently_airing', { perPage: 20 }),
  ]);

  const pool: NormalizedAnime[] = [];
  let fulfilledCount = 0;
  for (const res of categoryResults) {
    if (res.status === 'fulfilled') {
      fulfilledCount++;
      pool.push(...res.value.items);
    }
  }

  // Targeted genre query if user picked specific canonical AniList genres
  const canonicalGenres = normalizeAniListGenreFilters(
    preferences?.favouriteGenres || []
  ).slice(0, 3);
  if (canonicalGenres.length > 0) {
    try {
      const genreSearch = await anilistService.searchAnime('', {
        genres: canonicalGenres,
        perPage: 15,
      });
      pool.push(...genreSearch.items);
    } catch {
      // Non-fatal fallback to main pools
    }
  }

  // Optionally fetch detail relations/recommendations for top 2 seed anime
  const seedNumericIds = Array.from(
    new Set(
      watchlist
        .filter((w) => w.status === 'completed' || w.status === 'watching')
        .sort((a, b) => (b.userRating || 6) - (a.userRating || 6))
        .map((w) => parseAniListNumericId(w.animeId))
        .filter((n): n is number => n !== null)
    )
  ).slice(0, 2);

  const seedDetailAnime: NormalizedAnime[] = [];
  if (seedNumericIds.length > 0) {
    const detailResults = await Promise.allSettled(
      seedNumericIds.map((id) => anilistService.getAnimeById(id))
    );
    for (const res of detailResults) {
      if (res.status === 'fulfilled' && res.value.anime) {
        seedDetailAnime.push(res.value.anime);
      }
    }
  }

  const built = buildRecommendationsFromPools(
    pool,
    preferences,
    watchlist,
    feedbackMap,
    seedDetailAnime
  );

  return {
    ...built,
    isLimitedMode: fulfilledCount === 0,
  };
}

export async function generateAnimeRecommendations(
  preferences: AtaUserPreferences | null,
  watchlist: UserAnimeListItem[] = [],
  feedbackMap: Record<string, RecommendationFeedbackType> = {}
): Promise<AnimeRecommendation[]> {
  const result = await generateRecommendationsByCategory(
    preferences,
    watchlist,
    feedbackMap
  );
  return result.all;
}

export async function getSimilarAnimeForDetail(
  targetAnime: NormalizedAnime,
  watchlist: UserAnimeListItem[] = [],
  feedbackMap: Record<string, RecommendationFeedbackType> = {},
  preferences: AtaUserPreferences | null = null
): Promise<AnimeRecommendation[]> {
  const ctx = buildFilterContext(preferences, watchlist, feedbackMap);
  const results: AnimeRecommendation[] = [];
  const seenIds = new Set<number>([targetAnime.id]);

  // 1. Direct AniList recommendations on the anime detail payload
  for (const rec of targetAnime.recommendations || []) {
    if (seenIds.has(rec.anime.id)) continue;
    if (!filterRecommendationCandidate(rec.anime, ctx, { allowTrackedIfNotCompletedOrDropped: true })) {
      continue;
    }
    seenIds.add(rec.anime.id);
    results.push({
      anime: rec.anime,
      category: 'similar_anime',
      score: Math.max(85, 95 + Math.min(20, rec.rating)),
      reasonCategory: 'Similar Anime',
      reasonDetail: `Recommended on AniList for viewers of ${targetAnime.title.display}.`,
      matchedSignals: rec.anime.genres.slice(0, 3),
      seedAnimeTitle: targetAnime.title.display,
    });
  }

  // 2. Franchise relations (Sequel / Prequel / Spin-off / Side Story)
  for (const rel of targetAnime.relations || []) {
    if (seenIds.has(rel.anime.id)) continue;
    if (rel.anime.isAdult !== false) continue;
    seenIds.add(rel.anime.id);
    results.push({
      anime: rel.anime,
      category: 'because_you_watched',
      score: 92,
      reasonCategory: 'Because You Watched',
      reasonDetail: `${rel.relationType} connected to ${targetAnime.title.display}.`,
      matchedSignals: [rel.relationType, ...rel.anime.genres.slice(0, 2)],
      seedAnimeTitle: targetAnime.title.display,
    });
  }

  // 3. Supplement from cached popular/trending pools by genre overlap if < 6 items
  if (results.length < 6 && targetAnime.genres.length > 0) {
    try {
      const searchRes = await anilistService.searchAnime('', {
        genres: targetAnime.genres.slice(0, 2),
        perPage: 10,
      });
      const targetGenreSet = new Set(targetAnime.genres.map((g) => g.toLowerCase()));
      for (const candidate of searchRes.items) {
        if (seenIds.has(candidate.id)) continue;
        if (!filterRecommendationCandidate(candidate, ctx)) continue;
        const overlap = candidate.genres.filter((g) =>
          targetGenreSet.has(g.toLowerCase())
        );
        if (overlap.length === 0) continue;
        seenIds.add(candidate.id);
        results.push({
          anime: candidate,
          category: 'similar_anime',
          score: 70 + overlap.length * 8,
          reasonCategory: 'Similar Anime',
          reasonDetail: `Shares ${overlap.slice(0, 2).join(' & ')} with ${targetAnime.title.display}.`,
          matchedSignals: overlap.slice(0, 3),
          seedAnimeTitle: targetAnime.title.display,
        });
      }
    } catch {
      // Graceful fallback
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 8);
}
