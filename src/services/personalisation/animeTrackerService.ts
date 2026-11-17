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
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  PersonalAnimeInsights,
  UpsertAnimeListItemInput,
  UserAnimeListItem,
  WatchlistStatus,
} from '../../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  validateAnimeRating,
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
    format: String(data.format || 'TV Series'),
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
    personalNotes: typeof data.personalNotes === 'string' ? data.personalNotes : '',
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

  // Validations
  const statusErr = validateWatchlistStatus(input.status);
  if (statusErr) throw new Error(statusErr);

  const epErr = validateWatchedEpisodes(input.episodesWatched, input.totalEpisodes);
  if (epErr) throw new Error(epErr);

  const rateErr = validateAnimeRating(input.userRating);
  if (rateErr) throw new Error(rateErr);

  if (input.personalNotes) {
    const noteErr = validatePersonalNotes(input.personalNotes);
    if (noteErr) throw new Error(noteErr);
  }

  const docId = input.animeId;
  const path = `userAnimeLists/${userId}/items/${docId}`;
  const docRef = doc(db, 'userAnimeLists', userId, 'items', docId);

  try {
    const now = new Date();
    const existingSnap = await getDoc(docRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : null;

    let completionDate = input.completionDate || null;
    if (input.status === 'completed' && !completionDate) {
      completionDate = now.toISOString().split('T')[0];
    }

    const payload = {
      id: docId,
      userId,
      animeId: input.animeId,
      animeTitle: input.animeTitle,
      animeCoverUrl: input.animeCoverUrl,
      genres: input.genres || [],
      format: input.format || 'TV Series',
      totalEpisodes: input.totalEpisodes,
      episodesWatched: input.episodesWatched,
      status: input.status,
      userRating: input.userRating || null,
      startDate: input.startDate || null,
      completionDate,
      personalNotes: input.personalNotes || '',
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
        return currentWatched; // already at max
      }

      const nextWatched = currentWatched + 1;
      const willBeCompleted = total !== null && nextWatched >= total;

      transaction.update(docRef, {
        episodesWatched: nextWatched,
        status: willBeCompleted ? 'completed' : data.status,
        completionDate: willBeCompleted
          ? new Date().toISOString().split('T')[0]
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

    let episodesWatched = Number(data.episodesWatched || 0);
    let completionDate = data.completionDate || null;

    if (status === 'completed') {
      if (typeof data.totalEpisodes === 'number' && data.totalEpisodes > 0) {
        episodesWatched = data.totalEpisodes;
      }
      if (!completionDate) {
        completionDate = new Date().toISOString().split('T')[0];
      }
    }

    await updateDoc(docRef, {
      status,
      episodesWatched,
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

/**
 * Computes transparent, explainable insights strictly from user's stored records.
 * Never fabricates numbers or toxic streak comparisons.
 */
export function calculatePersonalInsights(
  items: UserAnimeListItem[],
  totalCollections: number = 0
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
      const rounded = Math.round(item.userRating);
      ratingDistribution[rounded] = (ratingDistribution[rounded] || 0) + 1;
    }

    if (item.format) {
      formatDistribution[item.format] =
        (formatDistribution[item.format] || 0) + 1;
    }

    for (const genre of item.genres) {
      genreDistribution[genre] = (genreDistribution[genre] || 0) + 1;
    }
  }

  const averageRating =
    ratedCount > 0 ? Number((sumRatings / ratedCount).toFixed(1)) : null;

  return {
    totalTracked: items.length,
    totalCompleted,
    totalWatching,
    totalPlanning,
    totalOnHold,
    totalDropped,
    totalEpisodesWatched,
    averageRating,
    genreDistribution,
    ratingDistribution,
    formatDistribution,
    recentWatchlistChanges: items.slice(0, 5),
    totalCollections,
  };
}
