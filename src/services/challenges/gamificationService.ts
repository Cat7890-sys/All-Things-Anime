import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type {
  AchievementId,
  CommunityLeaderboardEntry,
  LeaderboardProfile,
  UserAchievement,
} from '../../types';
import { db, functions } from '../firebase';
import { getOrFetch } from '../memoryCache';

const GAMIFICATION_CACHE_TTL_MS = 2 * 60_000;

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

export function mapDocToLeaderboardProfile(
  id: string,
  data: Record<string, unknown>
): LeaderboardProfile {
  return {
    userId: String(data.userId || id),
    username: String(data.username || 'ata_member'),
    displayName: String(data.displayName || data.username || 'ATA Member'),
    avatarUrl: String(data.avatarUrl || ''),
    totalPoints: typeof data.totalPoints === 'number' ? data.totalPoints : 0,
    challengePoints:
      typeof data.challengePoints === 'number' ? data.challengePoints : 0,
    watchPartyPoints:
      typeof data.watchPartyPoints === 'number' ? data.watchPartyPoints : 0,
    challengesJoined:
      typeof data.challengesJoined === 'number' ? data.challengesJoined : 0,
    challengesCompleted:
      typeof data.challengesCompleted === 'number' ? data.challengesCompleted : 0,
    watchPartiesAttended:
      typeof data.watchPartiesAttended === 'number'
        ? data.watchPartiesAttended
        : 0,
    watchPartiesHosted:
      typeof data.watchPartiesHosted === 'number' ? data.watchPartiesHosted : 0,
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export async function fetchOverallLeaderboard(
  maxEntries = 30
): Promise<LeaderboardProfile[]> {
  const safeLimit = Math.min(Math.max(1, maxEntries), 100);
  return getOrFetch(
    `leaderboard:overall:${safeLimit}`,
    async () => {
      try {
        const q = query(
          collection(db, 'leaderboardProfiles'),
          orderBy('totalPoints', 'desc'),
          limit(safeLimit)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) =>
          mapDocToLeaderboardProfile(d.id, d.data())
        );
      } catch {
        return [];
      }
    },
    { ttlMs: GAMIFICATION_CACHE_TTL_MS }
  );
}

export async function fetchUserLeaderboardProfile(
  userId: string
): Promise<LeaderboardProfile | null> {
  if (!userId) return null;
  return getOrFetch(
    `leaderboard:user:${userId}`,
    async () => {
      try {
        const snap = await getDoc(doc(db, 'leaderboardProfiles', userId));
        if (!snap.exists()) return null;
        return mapDocToLeaderboardProfile(snap.id, snap.data());
      } catch {
        return null;
      }
    },
    { ttlMs: GAMIFICATION_CACHE_TTL_MS, uid: userId }
  );
}

export async function fetchCommunityLeaderboard(): Promise<
  CommunityLeaderboardEntry[]
> {
  return getOrFetch(
    'leaderboard:community',
    async () => {
      try {
        const q = query(
          collection(db, 'animeChallenges'),
          where('visibility', '==', 'community'),
          where('communityVisibility', '==', 'public'),
          where('moderationStatus', '==', 'active'),
          limit(80)
        );
        const snap = await getDocs(q);
        const byCommunity = new Map<string, CommunityLeaderboardEntry>();

        snap.docs.forEach((d) => {
          const data = d.data();
          const communityId = String(data.communityId || '');
          const communityName = String(data.communityName || 'Community Club');
          if (!communityId) return;

          const existing = byCommunity.get(communityId) || {
            communityId,
            communityName,
            totalChallenges: 0,
            totalParticipants: 0,
            totalCompletions: 0,
            totalScore: 0,
          };

          const participants =
            typeof data.participantCount === 'number'
              ? data.participantCount
              : 0;
          const completions =
            typeof data.completedCount === 'number' ? data.completedCount : 0;

          existing.totalChallenges += 1;
          existing.totalParticipants += participants;
          existing.totalCompletions += completions;
          existing.totalScore =
            existing.totalChallenges * 15 +
            existing.totalParticipants * 10 +
            existing.totalCompletions * 40;
          byCommunity.set(communityId, existing);
        });

        return Array.from(byCommunity.values()).sort(
          (a, b) => b.totalScore - a.totalScore
        );
      } catch {
        return [];
      }
    },
    { ttlMs: GAMIFICATION_CACHE_TTL_MS }
  );
}

export async function fetchUserAchievements(
  userId: string
): Promise<UserAchievement[]> {
  if (!userId) return [];
  return getOrFetch(
    `userAchievements:${userId}`,
    async () => {
      try {
        const q = query(
          collection(db, 'userAchievements'),
          where('userId', '==', userId),
          limit(100)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || userId),
            achievementId: data.achievementId as AchievementId,
            title: String(data.title || ''),
            description: String(data.description || ''),
            sourceEventId: String(data.sourceEventId || ''),
            unlockedAt: toDateOrNull(data.unlockedAt),
          };
        });
      } catch {
        return [];
      }
    },
    { ttlMs: GAMIFICATION_CACHE_TTL_MS, uid: userId }
  );
}

export async function syncChallengeRewardsSafely(
  challengeId: string
): Promise<void> {
  try {
    await httpsCallable(functions, 'syncChallengeProgressAndRewards')({
      challengeId,
    });
  } catch {
    // Graceful when functions are not yet deployed
  }
}

export async function syncWatchPartyRewardsSafely(
  partyId: string
): Promise<void> {
  try {
    await httpsCallable(functions, 'syncWatchPartyRsvpRewards')({
      partyId,
    });
  } catch {
    // Graceful when functions are not yet deployed
  }
}
