import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type {
  AnimeChallenge,
  AtaPublicProfile,
  AtaUserAccount,
  ChallengeAnimeTarget,
  ChallengeLifecycleStatus,
  ChallengeParticipation,
  CreateChallengeInput,
  UpdateChallengeInput,
  UserAnimeListItem,
} from '../../types';
import { auth, db, functions, handleFirestoreError, OperationType } from '../firebase';
import {
  getOrFetch,
  invalidateCacheKey,
  invalidateCachePrefix,
  setCacheValue,
} from '../memoryCache';
import { getUserAnimeList, upsertAnimeListItem } from '../personalisation/animeTrackerService';
import {
  calculateChallengeProgress,
  validateChallengeForm,
} from '../validation';
import { computeChallengePoints, deriveChallengeLifecycleStatus } from './gamificationRules';

const CHALLENGES_CACHE_TTL_MS = 2 * 60_000;

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function mapDocToChallenge(
  id: string,
  data: Record<string, unknown>
): AnimeChallenge {
  const startDate = String(data.startDate || '');
  const endDate = String(data.endDate || '');
  const rawStatus = (data.status as ChallengeLifecycleStatus) || 'active';
  const targets = Array.isArray(data.animeTargets)
    ? (data.animeTargets as ChallengeAnimeTarget[])
    : [];

  return {
    id,
    title: String(data.title || 'Untitled Challenge'),
    description: String(data.description || ''),
    coverImageUrl: String(data.coverImageUrl || ''),
    category: (data.category as AnimeChallenge['category']) || 'Seasonal Watch',
    difficulty: (data.difficulty as AnimeChallenge['difficulty']) || 'casual',
    durationType: (data.durationType as AnimeChallenge['durationType']) || 'monthly',
    startDate,
    endDate,
    animeTargets: targets,
    requirementsText: String(data.requirementsText || ''),
    participantLimit:
      typeof data.participantLimit === 'number' ? data.participantLimit : null,
    participantCount:
      typeof data.participantCount === 'number' ? data.participantCount : 0,
    completedCount:
      typeof data.completedCount === 'number' ? data.completedCount : 0,
    visibility: (data.visibility as AnimeChallenge['visibility']) || 'public',
    communityId: String(data.communityId || ''),
    communityName: String(data.communityName || ''),
    communityVisibility:
      (data.communityVisibility as AnimeChallenge['communityVisibility']) || 'none',
    creatorId: String(data.creatorId || ''),
    creatorUsername: String(data.creatorUsername || ''),
    creatorDisplayName: String(data.creatorDisplayName || ''),
    status: deriveChallengeLifecycleStatus(rawStatus, startDate, endDate),
    isFeatured: Boolean(data.isFeatured),
    moderationStatus:
      (data.moderationStatus as AnimeChallenge['moderationStatus']) || 'active',
    moderationReason:
      typeof data.moderationReason === 'string' ? data.moderationReason : undefined,
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function mapDocToChallengeParticipation(
  id: string,
  data: Record<string, unknown>
): ChallengeParticipation {
  return {
    id,
    challengeId: String(data.challengeId || ''),
    userId: String(data.userId || ''),
    username: String(data.username || ''),
    displayName: String(data.displayName || ''),
    avatarUrl: String(data.avatarUrl || ''),
    communityId: String(data.communityId || ''),
    completedAnimeIds: Array.isArray(data.completedAnimeIds)
      ? (data.completedAnimeIds as number[]).filter((n) => Number.isInteger(n))
      : [],
    episodeProgressMap:
      data.episodeProgressMap && typeof data.episodeProgressMap === 'object'
        ? (data.episodeProgressMap as Record<string, number>)
        : {},
    totalAnimeCount:
      typeof data.totalAnimeCount === 'number' ? data.totalAnimeCount : 1,
    progressPercent:
      typeof data.progressPercent === 'number' ? data.progressPercent : 0,
    status: data.status === 'completed' ? 'completed' : 'active',
    pointsAwarded:
      typeof data.pointsAwarded === 'number' ? data.pointsAwarded : 0,
    trackerSynced: Boolean(data.trackerSynced),
    joinedAt: toDateOrNull(data.joinedAt),
    completedAt: toDateOrNull(data.completedAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export async function fetchPublicAndJoinedChallenges(
  currentUserId?: string,
  communityId?: string
): Promise<AnimeChallenge[]> {
  const cacheKey = `challenges:list:${communityId || 'all'}:${
    communityId ? 'shared' : currentUserId || 'anon'
  }`;
  return getOrFetch(
    cacheKey,
    async () => {
      try {
        if (communityId) {
          const q = query(
            collection(db, 'animeChallenges'),
            where('communityId', '==', communityId),
            orderBy('createdAt', 'desc'),
            limit(40)
          );
          const snap = await getDocs(q);
          const list = snap.docs
            .map((d) => mapDocToChallenge(d.id, d.data()))
            .filter((c) => c.moderationStatus === 'active');
          for (const ch of list) {
            setCacheValue(`challengeById:${ch.id}`, ch, {
              ttlMs: CHALLENGES_CACHE_TTL_MS,
            });
          }
          return list;
        }

        const queries = [
          getDocs(
            query(
              collection(db, 'animeChallenges'),
              where('visibility', '==', 'public'),
              where('moderationStatus', '==', 'active'),
              orderBy('participantCount', 'desc'),
              limit(50)
            )
          ),
          getDocs(
            query(
              collection(db, 'animeChallenges'),
              where('visibility', '==', 'community'),
              where('communityVisibility', '==', 'public'),
              where('moderationStatus', '==', 'active'),
              limit(30)
            )
          ).catch(() => null),
        ];

        if (currentUserId) {
          queries.push(
            getDocs(
              query(
                collection(db, 'animeChallenges'),
                where('creatorId', '==', currentUserId),
                limit(30)
              )
            ).catch(() => null)
          );
        }

        const results = await Promise.all(queries);
        const merged = new Map<string, AnimeChallenge>();
        for (const snap of results) {
          if (!snap) continue;
          snap.docs.forEach((docSnap) => {
            const mapped = mapDocToChallenge(docSnap.id, docSnap.data());
            if (mapped.moderationStatus === 'active') {
              merged.set(mapped.id, mapped);
              setCacheValue(`challengeById:${mapped.id}`, mapped, {
                ttlMs: CHALLENGES_CACHE_TTL_MS,
              });
            }
          });
        }

        return Array.from(merged.values()).sort((a, b) => {
          if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
          return b.participantCount - a.participantCount;
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'animeChallenges');
      }
    },
    {
      ttlMs: CHALLENGES_CACHE_TTL_MS,
      uid: communityId ? undefined : currentUserId,
    }
  );
}

export async function fetchChallengeById(
  challengeId: string
): Promise<AnimeChallenge | null> {
  if (!challengeId) return null;
  return getOrFetch(
    `challengeById:${challengeId}`,
    async () => {
      try {
        const snap = await getDoc(doc(db, 'animeChallenges', challengeId));
        if (!snap.exists()) return null;
        return mapDocToChallenge(snap.id, snap.data());
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.GET,
          `animeChallenges/${challengeId}`
        );
      }
    },
    { ttlMs: CHALLENGES_CACHE_TTL_MS }
  );
}

export async function createAnimeChallenge(
  creator: AtaPublicProfile | AtaUserAccount,
  input: CreateChallengeInput
): Promise<AnimeChallenge> {
  const user = auth.currentUser;
  if (!user || user.uid !== creator.uid) {
    throw new Error('Please sign in to create a challenge.');
  }
  if (!user.emailVerified) {
    throw new Error('Please verify your email address before creating a challenge.');
  }

  const err = validateChallengeForm(input);
  if (err) throw new Error(err);

  await user.getIdToken(true);

  const docRef = doc(collection(db, 'animeChallenges'));
  const today = new Date().toISOString().slice(0, 10);
  const initialStatus: ChallengeLifecycleStatus =
    today < input.startDate ? 'upcoming' : 'active';
  const coverImageUrl =
    (input.coverImageUrl || '').trim() ||
    input.animeTargets[0]?.coverImage ||
    '';

  const payload = {
    id: docRef.id,
    title: input.title.trim(),
    description: input.description.trim(),
    coverImageUrl,
    category: input.category,
    difficulty: input.difficulty,
    durationType: input.durationType,
    startDate: input.startDate,
    endDate: input.endDate,
    animeTargets: input.animeTargets.map((t) => ({
      animeId: t.animeId,
      title: t.title,
      coverImage: t.coverImage,
      totalEpisodes: t.totalEpisodes ?? null,
      format: t.format || 'TV',
    })),
    requirementsText: input.requirementsText.trim(),
    participantLimit: input.participantLimit ?? null,
    participantCount: 0,
    completedCount: 0,
    visibility: input.visibility,
    communityId: input.visibility === 'community' ? (input.communityId || '').trim() : '',
    communityName:
      input.visibility === 'community' ? (input.communityName || '').trim() : '',
    communityVisibility:
      input.visibility === 'community'
        ? input.communityVisibility || 'public'
        : 'none',
    creatorId: creator.uid,
    creatorUsername: creator.username,
    creatorDisplayName: creator.displayName,
    status: initialStatus,
    isFeatured: false,
    moderationStatus: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, payload);
    invalidateCachePrefix('challenges:list:');
    const created = await getDoc(docRef);
    const mapped = mapDocToChallenge(
      docRef.id,
      created.exists() ? created.data() : (payload as unknown as Record<string, unknown>)
    );
    setCacheValue(`challengeById:${docRef.id}`, mapped, {
      ttlMs: CHALLENGES_CACHE_TTL_MS,
    });
    return mapped;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `animeChallenges/${docRef.id}`
    );
  }
}

export async function updateAnimeChallenge(
  challengeId: string,
  input: UpdateChallengeInput
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required.');
  const err = validateChallengeForm(input);
  if (err) throw new Error(err);

  const today = new Date().toISOString().slice(0, 10);
  const derivedStatus =
    input.status === 'archived'
      ? 'archived'
      : today < input.startDate
        ? 'upcoming'
        : today > input.endDate
          ? 'completed'
          : 'active';

  try {
    await updateDoc(doc(db, 'animeChallenges', challengeId), {
      title: input.title.trim(),
      description: input.description.trim(),
      coverImageUrl:
        (input.coverImageUrl || '').trim() ||
        input.animeTargets[0]?.coverImage ||
        '',
      category: input.category,
      difficulty: input.difficulty,
      durationType: input.durationType,
      startDate: input.startDate,
      endDate: input.endDate,
      animeTargets: input.animeTargets.map((t) => ({
        animeId: t.animeId,
        title: t.title,
        coverImage: t.coverImage,
        totalEpisodes: t.totalEpisodes ?? null,
        format: t.format || 'TV',
      })),
      requirementsText: input.requirementsText.trim(),
      participantLimit: input.participantLimit ?? null,
      status: derivedStatus,
      updatedAt: serverTimestamp(),
    });
    invalidateCacheKey(`challengeById:${challengeId}`);
    invalidateCachePrefix('challenges:list:');
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `animeChallenges/${challengeId}`
    );
  }
}

export async function archiveAnimeChallenge(challengeId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'animeChallenges', challengeId), {
      status: 'archived',
      updatedAt: serverTimestamp(),
    });
    invalidateCacheKey(`challengeById:${challengeId}`);
    invalidateCachePrefix('challenges:list:');
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `animeChallenges/${challengeId}`
    );
  }
}

export async function joinAnimeChallenge(
  challenge: AnimeChallenge,
  profile: AtaPublicProfile | AtaUserAccount,
  trackerItems?: UserAnimeListItem[]
): Promise<ChallengeParticipation> {
  const user = auth.currentUser;
  if (!user || user.uid !== profile.uid) {
    throw new Error('Please sign in to join this challenge.');
  }
  if (!user.emailVerified) {
    throw new Error('Please verify your email address before joining a challenge.');
  }
  if (challenge.status === 'archived' || challenge.moderationStatus !== 'active') {
    throw new Error('This challenge is closed for new participants.');
  }
  if (
    challenge.participantLimit !== null &&
    challenge.participantCount >= challenge.participantLimit
  ) {
    throw new Error('This challenge has reached its participant limit.');
  }

  const partId = `${challenge.id}__${profile.uid}`;
  const partRef = doc(db, 'challengeParticipants', partId);
  const existing = await getDoc(partRef);
  if (existing.exists()) {
    return mapDocToChallengeParticipation(existing.id, existing.data());
  }

  // Sync existing completed/watching progress from Build 06 Anime Tracker
  const list = trackerItems ?? (await getUserAnimeList(profile.uid).catch(() => []));
  const trackerById = new Map(list.map((item) => [String(item.animeId), item]));
  const targetIds = challenge.animeTargets.map((t) => t.animeId);
  const initialCompleted: number[] = [];
  const episodeProgressMap: Record<string, number> = {};

  for (const target of challenge.animeTargets) {
    const tracked = trackerById.get(String(target.animeId));
    if (tracked) {
      episodeProgressMap[String(target.animeId)] = tracked.episodesWatched || 0;
      if (tracked.status === 'completed') {
        initialCompleted.push(target.animeId);
      }
    }
  }

  const progress = calculateChallengeProgress(initialCompleted, targetIds);
  const payload = {
    id: partId,
    challengeId: challenge.id,
    userId: profile.uid,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl || '',
    communityId: challenge.communityId || '',
    completedAnimeIds: progress.validCompletedIds,
    episodeProgressMap,
    totalAnimeCount: Math.max(1, targetIds.length),
    progressPercent: progress.progressPercent,
    status: progress.isCompleted ? 'completed' : 'active',
    pointsAwarded: 0,
    trackerSynced: list.length > 0,
    joinedAt: serverTimestamp(),
    completedAt: progress.isCompleted ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(partRef, payload);
    batch.update(doc(db, 'animeChallenges', challenge.id), {
      participantCount: challenge.participantCount + 1,
    });
    await batch.commit();

    // Non-blocking server-side reward & achievement sync
    void httpsCallable(functions, 'syncChallengeProgressAndRewards')({
      challengeId: challenge.id,
    }).catch(() => undefined);

    const saved = await getDoc(partRef);
    invalidateCacheKey(`challengeById:${challenge.id}`);
    invalidateCachePrefix('challenges:list:');
    invalidateCacheKey(`challengeParts:user:${profile.uid}`);
    invalidateCacheKey(`challengeParts:challenge:${challenge.id}`);
    return mapDocToChallengeParticipation(
      partId,
      saved.exists() ? saved.data() : (payload as unknown as Record<string, unknown>)
    );
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `challengeParticipants/${partId}`
    );
  }
}

export async function leaveAnimeChallenge(
  challenge: AnimeChallenge,
  userId: string
): Promise<void> {
  const partId = `${challenge.id}__${userId}`;
  const partRef = doc(db, 'challengeParticipants', partId);
  try {
    const batch = writeBatch(db);
    batch.delete(partRef);
    batch.update(doc(db, 'animeChallenges', challenge.id), {
      participantCount: Math.max(0, challenge.participantCount - 1),
    });
    await batch.commit();
    invalidateCacheKey(`challengeById:${challenge.id}`);
    invalidateCachePrefix('challenges:list:');
    invalidateCacheKey(`challengeParts:user:${userId}`);
    invalidateCacheKey(`challengeParts:challenge:${challenge.id}`);
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `challengeParticipants/${partId}`
    );
  }
}

export async function updateChallengeTargetProgress(params: {
  challenge: AnimeChallenge;
  participation: ChallengeParticipation;
  animeTarget: ChallengeAnimeTarget;
  markCompleted: boolean;
  episodesWatched?: number;
  syncToTracker?: boolean;
}): Promise<ChallengeParticipation> {
  const { challenge, participation, animeTarget, markCompleted, episodesWatched, syncToTracker } =
    params;

  const targetIds = challenge.animeTargets.map((t) => t.animeId);
  const nextCompletedSet = new Set(participation.completedAnimeIds);
  if (markCompleted) {
    nextCompletedSet.add(animeTarget.animeId);
  } else {
    nextCompletedSet.delete(animeTarget.animeId);
  }

  const nextEpisodeMap = { ...participation.episodeProgressMap };
  if (typeof episodesWatched === 'number' && episodesWatched >= 0) {
    nextEpisodeMap[String(animeTarget.animeId)] = episodesWatched;
  } else if (markCompleted && animeTarget.totalEpisodes) {
    nextEpisodeMap[String(animeTarget.animeId)] = animeTarget.totalEpisodes;
  }

  const progress = calculateChallengeProgress(
    Array.from(nextCompletedSet),
    targetIds
  );
  const { points } = computeChallengePoints({
    completedAnimeCount: progress.validCompletedIds.length,
    totalAnimeCount: progress.totalCount,
    difficulty: challenge.difficulty,
  });

  if (syncToTracker) {
    await upsertAnimeListItem(participation.userId, {
      animeId: String(animeTarget.animeId),
      animeTitle: animeTarget.title,
      animeCoverUrl: animeTarget.coverImage,
      genres: [],
      studios: [],
      format: animeTarget.format || 'TV',
      seasonYear: null,
      totalEpisodes: animeTarget.totalEpisodes,
      episodesWatched:
        nextEpisodeMap[String(animeTarget.animeId)] ??
        (markCompleted ? animeTarget.totalEpisodes || 1 : 0),
      status: markCompleted ? 'completed' : 'watching',
      userRating: null,
      startDate: null,
      completionDate: markCompleted ? new Date().toISOString().slice(0, 10) : null,
      personalNotes: `Tracked via ATA Challenge: ${challenge.title}`,
    }).catch(() => undefined);
  }

  const partRef = doc(db, 'challengeParticipants', participation.id);
  try {
    await updateDoc(partRef, {
      completedAnimeIds: progress.validCompletedIds,
      episodeProgressMap: nextEpisodeMap,
      progressPercent: progress.progressPercent,
      status: progress.isCompleted ? 'completed' : 'active',
      trackerSynced: Boolean(syncToTracker || participation.trackerSynced),
      completedAt: progress.isCompleted ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });

    void httpsCallable(functions, 'syncChallengeProgressAndRewards')({
      challengeId: challenge.id,
    }).catch(() => undefined);

    invalidateCacheKey(`challengeParts:user:${participation.userId}`);
    invalidateCacheKey(`challengeParts:challenge:${challenge.id}`);

    return {
      ...participation,
      completedAnimeIds: progress.validCompletedIds,
      episodeProgressMap: nextEpisodeMap,
      progressPercent: progress.progressPercent,
      status: progress.isCompleted ? 'completed' : 'active',
      pointsAwarded: points,
      trackerSynced: Boolean(syncToTracker || participation.trackerSynced),
      completedAt: progress.isCompleted ? new Date() : null,
      updatedAt: new Date(),
    };
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `challengeParticipants/${participation.id}`
    );
  }
}

export async function fetchUserChallengeParticipations(
  userId: string
): Promise<ChallengeParticipation[]> {
  if (!userId) return [];
  return getOrFetch(
    `challengeParts:user:${userId}`,
    async () => {
      try {
        const q = query(
          collection(db, 'challengeParticipants'),
          where('userId', '==', userId),
          orderBy('updatedAt', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) =>
          mapDocToChallengeParticipation(d.id, d.data())
        );
      } catch {
        return [];
      }
    },
    { ttlMs: CHALLENGES_CACHE_TTL_MS, uid: userId }
  );
}

export async function fetchChallengeParticipants(
  challengeId: string
): Promise<ChallengeParticipation[]> {
  if (!challengeId) return [];
  return getOrFetch(
    `challengeParts:challenge:${challengeId}`,
    async () => {
      try {
        const q = query(
          collection(db, 'challengeParticipants'),
          where('challengeId', '==', challengeId),
          orderBy('progressPercent', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) =>
          mapDocToChallengeParticipation(d.id, d.data())
        );
      } catch {
        return [];
      }
    },
    { ttlMs: CHALLENGES_CACHE_TTL_MS }
  );
}

export async function inviteUsersToChallenge(
  challengeId: string,
  recipientIds: string[]
): Promise<number> {
  if (!challengeId || recipientIds.length === 0) return 0;
  const callable = httpsCallable<
    { eventType: 'challenge'; eventId: string; recipientIds: string[] },
    { ok: boolean; sentCount: number }
  >(functions, 'sendEventInvites');
  const res = await callable({
    eventType: 'challenge',
    eventId: challengeId,
    recipientIds,
  });
  return res.data.sentCount || 0;
}
