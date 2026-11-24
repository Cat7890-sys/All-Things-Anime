import type {
  AchievementDefinition,
  AchievementId,
  ChallengeDifficulty,
  ChallengeLifecycleStatus,
  WatchPartyStatus,
} from '../../types';

/**
 * Transparent, server-enforced scoring rules for ATA Challenges & Watch Parties.
 * Used identically by client UI explanations and Cloud Functions validation.
 */
export const ATA_SCORING_RULES = {
  challengeJoinBase: 10,
  challengeAnimeCompleted: 25,
  challengeFullCompletionBonus: 100,
  difficultyMultiplier: {
    casual: 1.0,
    standard: 1.25,
    hardcore: 1.5,
  } as Record<ChallengeDifficulty, number>,
  watchPartyAttend: 15,
  watchPartyCompleted: 25,
  watchPartyHostCompletedBonus: 30,
  watchPartyHostMinAttendees: 2,
} as const;

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  {
    id: 'first_challenge_joined',
    title: 'First Challenge Joined',
    description: 'Enrolled in your first ATA Anime Challenge.',
    criteriaLabel: 'Join at least 1 anime challenge',
    accentTone: 'sky',
  },
  {
    id: 'first_challenge_completed',
    title: 'First Challenge Completed',
    description: 'Completed every target anime in an ATA Anime Challenge.',
    criteriaLabel: 'Complete 1 anime challenge',
    accentTone: 'emerald',
  },
  {
    id: 'challenge_champion',
    title: 'Challenge Champion',
    description: 'Mastered multiple seasonal and thematic anime challenges.',
    criteriaLabel: 'Complete 3 or more anime challenges',
    accentTone: 'amber',
  },
  {
    id: 'community_participant',
    title: 'Community Participant',
    description: 'Joined a community-hosted anime challenge or watch party.',
    criteriaLabel: 'Participate in 1 community challenge or watch party',
    accentTone: 'indigo',
  },
  {
    id: 'watch_party_attendee',
    title: 'Watch Party Attendee',
    description: 'Checked in to a scheduled independent Watch Party.',
    criteriaLabel: 'Attend 1 scheduled watch party',
    accentTone: 'crimson',
  },
  {
    id: 'watch_party_host',
    title: 'Watch Party Host',
    description: 'Organised and completed an ATA Watch Party with community members.',
    criteriaLabel: 'Host 1 completed watch party with 2+ participants',
    accentTone: 'amber',
  },
  {
    id: 'consistent_participant',
    title: 'Consistent Participant',
    description: 'Remained active across multiple ATA challenges and watch parties.',
    criteriaLabel: 'Reach 5+ total challenge/watch party activities',
    accentTone: 'emerald',
  },
];

export const ACHIEVEMENT_BY_ID: Record<AchievementId, AchievementDefinition> =
  ACHIEVEMENT_CATALOG.reduce(
    (acc, item) => {
      acc[item.id] = item;
      return acc;
    },
    {} as Record<AchievementId, AchievementDefinition>
  );

export function computeChallengePoints(params: {
  completedAnimeCount: number;
  totalAnimeCount: number;
  difficulty: ChallengeDifficulty;
}): {
  points: number;
  isCompleted: boolean;
} {
  const safeTotal = Math.max(0, Math.floor(params.totalAnimeCount));
  const safeCompleted = Math.min(
    safeTotal,
    Math.max(0, Math.floor(params.completedAnimeCount))
  );
  const multiplier = ATA_SCORING_RULES.difficultyMultiplier[params.difficulty] ?? 1;
  const isCompleted = safeTotal > 0 && safeCompleted === safeTotal;
  const rawPoints =
    ATA_SCORING_RULES.challengeJoinBase +
    safeCompleted * ATA_SCORING_RULES.challengeAnimeCompleted +
    (isCompleted ? ATA_SCORING_RULES.challengeFullCompletionBonus : 0);

  return {
    points: Math.round(rawPoints * multiplier),
    isCompleted,
  };
}

export function computeWatchPartyParticipantPoints(
  rsvpStatus: 'joined' | 'attending' | 'completed'
): number {
  if (rsvpStatus === 'completed') {
    return ATA_SCORING_RULES.watchPartyAttend + ATA_SCORING_RULES.watchPartyCompleted;
  }
  if (rsvpStatus === 'attending') {
    return ATA_SCORING_RULES.watchPartyAttend;
  }
  return 0;
}

export interface AchievementStatsSnapshot {
  challengesJoined: number;
  challengesCompleted: number;
  communityEventsJoined: number;
  watchPartiesAttended: number;
  watchPartiesHostedCompleted: number;
}

export function evaluateUnlockedAchievements(
  stats: AchievementStatsSnapshot,
  existingUnlocked: Set<AchievementId> | AchievementId[]
): AchievementId[] {
  const unlockedSet =
    existingUnlocked instanceof Set ? existingUnlocked : new Set(existingUnlocked);
  const newlyUnlocked: AchievementId[] = [];

  const check = (id: AchievementId, condition: boolean) => {
    if (condition && !unlockedSet.has(id)) {
      newlyUnlocked.push(id);
    }
  };

  check('first_challenge_joined', stats.challengesJoined >= 1);
  check('first_challenge_completed', stats.challengesCompleted >= 1);
  check('challenge_champion', stats.challengesCompleted >= 3);
  check('community_participant', stats.communityEventsJoined >= 1);
  check('watch_party_attendee', stats.watchPartiesAttended >= 1);
  check('watch_party_host', stats.watchPartiesHostedCompleted >= 1);
  check(
    'consistent_participant',
    stats.challengesJoined + stats.watchPartiesAttended >= 5
  );

  return newlyUnlocked;
}

export function deriveChallengeLifecycleStatus(
  storedStatus: ChallengeLifecycleStatus,
  startDate: string,
  endDate: string,
  nowDateStr?: string
): ChallengeLifecycleStatus {
  if (storedStatus === 'archived') return 'archived';
  const today = nowDateStr || new Date().toISOString().slice(0, 10);
  if (today < startDate) return 'upcoming';
  if (today > endDate) return 'completed';
  return 'active';
}

export function deriveWatchPartyLifecycleStatus(
  storedStatus: WatchPartyStatus,
  scheduledStartAtMs: number,
  estimatedDurationMinutes: number,
  nowMs: number = Date.now()
): WatchPartyStatus {
  if (storedStatus === 'cancelled') return 'cancelled';
  if (storedStatus === 'completed') return 'completed';
  if (!scheduledStartAtMs || scheduledStartAtMs <= 0) return storedStatus;
  const endMs = scheduledStartAtMs + Math.max(10, estimatedDurationMinutes) * 60 * 1000;
  if (nowMs >= endMs) return 'completed';
  if (nowMs >= scheduledStartAtMs) return 'live';
  return 'scheduled';
}

export function formatCountdownLabel(
  targetStartAtMs: number,
  durationMinutes: number,
  status: WatchPartyStatus,
  nowMs: number = Date.now()
): string {
  if (status === 'cancelled') return 'Cancelled';
  const derived = deriveWatchPartyLifecycleStatus(
    status,
    targetStartAtMs,
    durationMinutes,
    nowMs
  );
  if (derived === 'completed') return 'Completed';
  if (derived === 'live') return 'Watch Window Active Now';
  const diffMs = targetStartAtMs - nowMs;
  if (diffMs <= 0) return 'Starting soon';
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Starts in ${days}d ${hours}h`;
  if (hours > 0) return `Starts in ${hours}h ${minutes}m`;
  return `Starts in ${Math.max(1, minutes)}m`;
}
