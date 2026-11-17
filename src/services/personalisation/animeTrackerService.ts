import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  AnimeActivitySummary,
  MonthlyActivityPoint,
  PersonalAnimeInsights,
  UpsertAnimeListItemInput,
  UserAnimeListItem,
  WatchlistStatus,
} from '../../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  validateAnimeRating,
  validateIsoDateString,
  validateOptionalHttpsUrl,
  validatePersonalNotes,
  validateWatchedEpisodes,
  validateWatchlistStatus,
} from '../validation';

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

export function mapDocToAnimeListItem(
  id: string,
  data: Record<string, unknown>
): UserAnimeListItem {
  return {
    id,
    userId: String(data.userId || ''),
    animeId: String(data.animeId || id),
    animeTitle: String(data.animeTitle || 'Untitled Anime'),
    animeCoverUrl: String(data.animeCoverUrl || ''),
    genres: Array.isArray(data.genres) ? (data.genres as string[]) : [],
    studios: Array.isArray(data.studios) ? (data.studios as string[]) : [],
    format: String(data.format || 'TV Series'),
    seasonYear:
      typeof data.seasonYear === 'number' && !isNaN(data.seasonYear)
        ? data.seasonYear
        : null,
    totalEpisodes:
      typeof data.totalEpisodes === 'number' && !isNaN(data.totalEpisodes)
        ? data.totalEpisodes
        : null,
    episodesWatched:
      typeof data.episodesWatched === 'number' ? data.episodesWatched : 0,
    status: (data.status as WatchlistStatus) || 'planning',
    userRating:
      typeof data.userRating === 'number' && data.userRating > 0
        ? data.userRating
        : null,
    startDate: typeof data.startDate === 'string' ? data.startDate : null,
    completionDate:
      typeof data.completionDate === 'string' ? data.completionDate : null,
    personalNotes:
      typeof data.personalNotes === 'string' ? data.personalNotes : '',
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function subscribeToUserAnimeList(
  userId: string,
  onList: (items: UserAnimeListItem[]) => void,
  onError?: (errMessage: string) => void
): Unsubscribe {
  if (!userId) {
    onList([]);
    return () => {};
  }

  const path = `userAnimeLists/${userId}/items`;
  const q = query(collection(db, path), orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) =>
        mapDocToAnimeListItem(d.id, d.data())
      );
      onList(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        onError?.(
          err instanceof Error
            ? err.message
            : 'Unable to sync anime tracker list.'
        );
      }
    }
  );
}

export async function getUserAnimeList(
  userId: string
): Promise<UserAnimeListItem[]> {
  if (!userId) return [];
  const path = `userAnimeLists/${userId}/items`;
  try {
    const q = query(collection(db, path), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDocToAnimeListItem(d.id, d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function upsertAnimeListItem(
  userId: string,
  input: UpsertAnimeListItemInput
): Promise<UserAnimeListItem> {
  if (!userId) {
    throw new Error('You must be signed in to update your anime tracker.');
  }

  const statusErr = validateWatchlistStatus(input.status);
  if (statusErr) throw new Error(statusErr);

  const epErr = validateWatchedEpisodes(
    input.episodesWatched,
    input.totalEpisodes
  );
  if (epErr) throw new Error(epErr);

  const rateErr = validateAnimeRating(input.userRating);
  if (rateErr) throw new Error(rateErr);

  const startErr = validateIsoDateString(input.startDate, 'Start date');
  if (startErr) throw new Error(startErr);

  const compErr = validateIsoDateString(input.completionDate, 'Completion date');
  if (compErr) throw new Error(compErr);

  const coverErr = validateOptionalHttpsUrl(
    input.animeCoverUrl,
    1000,
    'Anime cover URL'
  );
  if (coverErr) throw new Error(coverErr);

  if (input.personalNotes) {
    const noteErr = validatePersonalNotes(input.personalNotes);
    if (noteErr) throw new Error(noteErr);
  }

  const docId = input.animeId.trim();
  if (!docId) {
    throw new Error('Anime identifier is required.');
  }
  const path = `userAnimeLists/${userId}/items/${docId}`;
  const docRef = doc(db, 'userAnimeLists', userId, 'items', docId);

  try {
    const now = new Date();
    const todayIso = now.toISOString().split('T')[0];
    const existingSnap = await getDoc(docRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : null;

    let startDate = input.startDate || (existingData?.startDate as string | null) || null;
    if (input.status === 'watching' && !startDate) {
      startDate = todayIso;
    }

    let completionDate = input.completionDate || null;
    if (input.status === 'completed' && !completionDate) {
      completionDate =
        (existingData?.completionDate as string | null) || todayIso;
    }

    const payload = {
      id: docId,
      userId,
      animeId: docId,
      animeTitle: input.animeTitle.trim(),
      animeCoverUrl: input.animeCoverUrl.trim(),
      genres: (input.genres || []).slice(0, 15),
      studios: (input.studios || []).slice(0, 10),
      format: input.format || 'TV Series',
      seasonYear:
        typeof input.seasonYear === 'number' ? input.seasonYear : null,
      totalEpisodes: input.totalEpisodes,
      episodesWatched: input.episodesWatched,
      status: input.status,
      userRating: input.userRating || null,
      startDate,
      completionDate,
      personalNotes: (input.personalNotes || '').trim(),
      createdAt: existingData?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, payload, { merge: true });

    return {
      ...payload,
      createdAt: existingData ? toDateOrNull(existingData.createdAt) : now,
      updatedAt: now,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function incrementWatchedEpisode(
  userId: string,
  animeId: string
): Promise<number> {
  if (!userId || !animeId) return 0;
  const docRef = doc(db, 'userAnimeLists', userId, 'items', animeId);
  const path = `userAnimeLists/${userId}/items/${animeId}`;

  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) {
        throw new Error('Anime entry not found in tracker.');
      }
      const data = snap.data();
      const currentWatched = Number(data.episodesWatched || 0);
      const total =
        typeof data.totalEpisodes === 'number' ? data.totalEpisodes : null;

      if (total !== null && currentWatched >= total) {
        return currentWatched;
      }

      const nextWatched = currentWatched + 1;
      const willBeCompleted = total !== null && total > 0 && nextWatched >= total;
      const todayIso = new Date().toISOString().split('T')[0];

      transaction.update(docRef, {
        episodesWatched: nextWatched,
        status: willBeCompleted
          ? 'completed'
          : data.status === 'planning'
            ? 'watching'
            : data.status,
        startDate: data.startDate || todayIso,
        completionDate: willBeCompleted
          ? todayIso
          : data.completionDate || null,
        updatedAt: serverTimestamp(),
      });

      return nextWatched;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateAnimeStatus(
  userId: string,
  animeId: string,
  status: WatchlistStatus
): Promise<void> {
  const statusErr = validateWatchlistStatus(status);
  if (statusErr) throw new Error(statusErr);

  const docRef = doc(db, 'userAnimeLists', userId, 'items', animeId);
  const path = `userAnimeLists/${userId}/items/${animeId}`;

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();

    const todayIso = new Date().toISOString().split('T')[0];
    let episodesWatched = Number(data.episodesWatched || 0);
    let startDate = (data.startDate as string | null) || null;
    let completionDate = (data.completionDate as string | null) || null;

    if (status === 'watching' && !startDate) {
      startDate = todayIso;
    }

    if (status === 'completed') {
      if (typeof data.totalEpisodes === 'number' && data.totalEpisodes > 0) {
        episodesWatched = data.totalEpisodes;
      }
      if (!completionDate) {
        completionDate = todayIso;
      }
    }

    await updateDoc(docRef, {
      status,
      episodesWatched,
      startDate,
      completionDate,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeAnimeFromList(
  userId: string,
  animeId: string
): Promise<void> {
  if (!userId || !animeId) return;
  const path = `userAnimeLists/${userId}/items/${animeId}`;
  try {
    await deleteDoc(doc(db, 'userAnimeLists', userId, 'items', animeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function buildMonthlyActivitySeries(
  items: UserAnimeListItem[],
  now: Date = new Date()
): MonthlyActivityPoint[] {
  const points: MonthlyActivityPoint[] = [];
  const monthBuckets = new Map<
    string,
    { updatedCount: number; completedCount: number }
  >();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
      2,
      '0'
    )}`;
    const label = d.toLocaleDateString('en-US', {
      month: 'short',
      timeZone: 'UTC',
    });
    monthBuckets.set(key, { updatedCount: 0, completedCount: 0 });
    points.push({
      monthKey: key,
      label,
      updatedCount: 0,
      completedCount: 0,
    });
  }

  for (const item of items) {
    const activityDate = item.updatedAt || item.createdAt;
    if (activityDate instanceof Date && !isNaN(activityDate.getTime())) {
      const actKey = `${activityDate.getUTCFullYear()}-${String(
        activityDate.getUTCMonth() + 1
      ).padStart(2, '0')}`;
      const bucket = monthBuckets.get(actKey);
      if (bucket) {
        bucket.updatedCount += 1;
      }
    }

    if (item.status === 'completed') {
      const compMonthKey = item.completionDate
        ? item.completionDate.slice(0, 7)
        : activityDate instanceof Date && !isNaN(activityDate.getTime())
          ? `${activityDate.getUTCFullYear()}-${String(
              activityDate.getUTCMonth() + 1
            ).padStart(2, '0')}`
          : '';
      if (compMonthKey) {
        const compBucket = monthBuckets.get(compMonthKey);
        if (compBucket) {
          compBucket.completedCount += 1;
        }
      }
    }
  }

  return points.map((pt) => {
    const b = monthBuckets.get(pt.monthKey);
    return {
      ...pt,
      updatedCount: b?.updatedCount ?? 0,
      completedCount: b?.completedCount ?? 0,
    };
  });
}

/**
 * Computes transparent, explainable insights strictly from user's stored records.
 * Never fabricates numbers or streak comparisons.
 */
export function calculatePersonalInsights(
  items: UserAnimeListItem[],
  totalCollections: number = 0,
  now: Date = new Date()
): PersonalAnimeInsights {
  let totalCompleted = 0;
  let totalWatching = 0;
  let totalPlanning = 0;
  let totalOnHold = 0;
  let totalDropped = 0;
  let totalEpisodesWatched = 0;

  const genreDistribution: Record<string, number> = {};
  const ratingDistribution: Record<number, number> = {};
  const formatDistribution: Record<string, number> = {};
  const studioDistribution: Record<string, number> = {};

  let sumRatings = 0;
  let ratedCount = 0;

  for (const item of items) {
    if (item.status === 'completed') totalCompleted++;
    else if (item.status === 'watching') totalWatching++;
    else if (item.status === 'planning') totalPlanning++;
    else if (item.status === 'on_hold') totalOnHold++;
    else if (item.status === 'dropped') totalDropped++;

    totalEpisodesWatched += item.episodesWatched || 0;

    if (item.userRating && item.userRating > 0) {
      sumRatings += item.userRating;
      ratedCount++;
      const rounded = Math.min(10, Math.max(1, Math.round(item.userRating)));
      ratingDistribution[rounded] = (ratingDistribution[rounded] || 0) + 1;
    }

    if (item.format) {
      formatDistribution[item.format] =
        (formatDistribution[item.format] || 0) + 1;
    }

    for (const genre of item.genres || []) {
      genreDistribution[genre] = (genreDistribution[genre] || 0) + 1;
    }

    for (const studio of item.studios || []) {
      studioDistribution[studio] = (studioDistribution[studio] || 0) + 1;
    }
  }

  const averageRating =
    ratedCount > 0 ? Number((sumRatings / ratedCount).toFixed(1)) : null;

  const completionRate =
    items.length > 0 ? Math.round((totalCompleted / items.length) * 100) : 0;

  return {
    totalTracked: items.length,
    totalCompleted,
    totalWatching,
    totalPlanning,
    totalOnHold,
    totalDropped,
    totalEpisodesWatched,
    averageRating,
    completionRate,
    genreDistribution,
    ratingDistribution,
    formatDistribution,
    studioDistribution,
    statusDistribution: {
      watching: totalWatching,
      completed: totalCompleted,
      planning: totalPlanning,
      on_hold: totalOnHold,
      dropped: totalDropped,
    },
    monthlyActivity: buildMonthlyActivitySeries(items, now),
    recentWatchlistChanges: items.slice(0, 5),
    totalCollections,
  };
}

export function buildPublicActivitySummary(
  items: UserAnimeListItem[],
  fallbackGenres: string[] = []
): AnimeActivitySummary {
  const insights = calculatePersonalInsights(items, 0);
  const topGenres = Object.entries(insights.genreDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([genre]) => genre);

  return {
    totalTracked: insights.totalTracked,
    totalCompleted: insights.totalCompleted,
    totalWatching: insights.totalWatching,
    totalEpisodesWatched: insights.totalEpisodesWatched,
    favouriteGenres:
      topGenres.length > 0 ? topGenres : fallbackGenres.slice(0, 4),
  };
}
