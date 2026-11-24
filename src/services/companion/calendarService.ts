import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import type { WatchReminder } from '../../types';
import type { NormalizedAnime } from '../catalogue/anilistTypes';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ANILIST_GRAPHQL_ENDPOINT, normalizeAniListMedia } from '../catalogue/anilistService';

export interface AiringScheduleItem {
  id: number;
  episode: number;
  airingAt: number; // Unix timestamp
  mediaId: number;
  media: NormalizedAnime | null;
}

const AIRING_SCHEDULE_QUERY = `
  query GetAiringSchedules($airingAtGreater: Int, $airingAtLesser: Int, $perPage: Int) {
    Page(perPage: $perPage) {
      airingSchedules(airingAt_greater: $airingAtGreater, airingAt_lesser: $airingAtLesser, sort: TIME) {
        id
        episode
        airingAt
        mediaId
        media {
          id
          isAdult
          title {
            romaji
            english
            native
          }
          coverImage {
            extraLarge
            large
            color
          }
          episodes
          status
          format
          genres
          siteUrl
        }
      }
    }
  }
`;

export async function fetchAiringSchedules(
  airingAtGreater: number,
  airingAtLesser: number,
  perPage = 50
): Promise<AiringScheduleItem[]> {
  try {
    const response = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: AIRING_SCHEDULE_QUERY,
        variables: { airingAtGreater, airingAtLesser, perPage },
      }),
    });

    if (!response.ok) return [];
    const json = await response.json();
    const schedules = json?.data?.Page?.airingSchedules;
    if (!Array.isArray(schedules)) return [];

    return schedules
      .map((item): AiringScheduleItem | null => {
        if (!item || typeof item.id !== 'number' || !item.media) return null;
        const normalizedMedia = normalizeAniListMedia(item.media);
        if (!normalizedMedia) return null;
        return {
          id: item.id,
          episode: item.episode,
          airingAt: item.airingAt,
          mediaId: item.mediaId,
          media: normalizedMedia,
        };
      })
      .filter((x): x is AiringScheduleItem => x !== null);
  } catch {
    return [];
  }
}

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function subscribeToUserReminders(
  userId: string,
  onReminders: (reminders: WatchReminder[]) => void,
  onError?: (msg: string) => void
): Unsubscribe {
  if (!userId) {
    onReminders([]);
    return () => {};
  }

  const colRef = collection(db, 'userReminders', userId, 'items');
  return onSnapshot(
    query(colRef),
    (snapshot) => {
      const list: WatchReminder[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: typeof data.userId === 'string' ? data.userId : userId,
          animeId: typeof data.animeId === 'string' ? data.animeId : '',
          animeTitle: typeof data.animeTitle === 'string' ? data.animeTitle : '',
          animeCoverUrl: typeof data.animeCoverUrl === 'string' ? data.animeCoverUrl : '',
          episodeNumber: typeof data.episodeNumber === 'number' ? data.episodeNumber : 1,
          airingAt: typeof data.airingAt === 'number' ? data.airingAt : 0,
          offsetMinutes: typeof data.offsetMinutes === 'number' ? data.offsetMinutes : 0,
          isNotified: Boolean(data.isNotified),
          createdAt: toDateOrNull(data.createdAt),
        });
      });
      list.sort((a, b) => a.airingAt - b.airingAt);
      onReminders(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `userReminders/${userId}/items`);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : 'Failed to load reminders.');
      }
    }
  );
}

export async function upsertWatchReminder(
  userId: string,
  reminder: Omit<WatchReminder, 'userId' | 'createdAt'>
): Promise<void> {
  if (!userId) throw new Error('User ID required.');
  const docRef = doc(db, 'userReminders', userId, 'items', reminder.id);
  const payload = {
    userId,
    animeId: reminder.animeId,
    animeTitle: reminder.animeTitle,
    animeCoverUrl: reminder.animeCoverUrl,
    episodeNumber: reminder.episodeNumber,
    airingAt: reminder.airingAt,
    offsetMinutes: reminder.offsetMinutes,
    isNotified: Boolean(reminder.isNotified),
    createdAt: serverTimestamp(),
  };
  try {
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `userReminders/${userId}/items/${reminder.id}`);
  }
}

export async function deleteWatchReminder(userId: string, reminderId: string): Promise<void> {
  if (!userId || !reminderId) return;
  const docRef = doc(db, 'userReminders', userId, 'items', reminderId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `userReminders/${userId}/items/${reminderId}`);
  }
}
