export type ServerChallengeDifficulty = 'casual' | 'standard' | 'hardcore';
export type ServerAchievementId =
  | 'first_challenge_joined'
  | 'first_challenge_completed'
  | 'challenge_champion'
  | 'community_participant'
  | 'watch_party_attendee'
  | 'watch_party_host'
  | 'consistent_participant';

export const SERVER_SCORING_RULES = {
  challengeJoinBase: 10,
  challengeAnimeCompleted: 25,
  challengeFullCompletionBonus: 100,
  difficultyMultiplier: {
    casual: 1.0,
    standard: 1.25,
    hardcore: 1.5,
  } as Record<ServerChallengeDifficulty, number>,
  watchPartyAttend: 15,
  watchPartyCompleted: 25,
  watchPartyHostCompletedBonus: 30,
  watchPartyHostMinAttendees: 2,
} as const;

export const SERVER_ACHIEVEMENT_DEFS: Record<
  ServerAchievementId,
  { title: string; description: string }
> = {
  first_challenge_joined: {
    title: 'First Challenge Joined',
    description: 'Enrolled in your first ATA Anime Challenge.',
  },
  first_challenge_completed: {
    title: 'First Challenge Completed',
    description: 'Completed every target anime in an ATA Anime Challenge.',
  },
  challenge_champion: {
    title: 'Challenge Champion',
    description: 'Mastered multiple seasonal and thematic anime challenges.',
  },
  community_participant: {
    title: 'Community Participant',
    description: 'Joined a community-hosted anime challenge or watch party.',
  },
  watch_party_attendee: {
    title: 'Watch Party Attendee',
    description: 'Checked in to a scheduled independent Watch Party.',
  },
  watch_party_host: {
    title: 'Watch Party Host',
    description: 'Organised and completed an ATA Watch Party with community members.',
  },
  consistent_participant: {
    title: 'Consistent Participant',
    description: 'Remained active across multiple ATA challenges and watch parties.',
  },
};

export function sanitizeTargetAnimeIds(
  claimedIds: unknown[],
  allowedTargetIds: number[]
): number[] {
  const allowedSet = new Set(
    allowedTargetIds.filter((n) => Number.isInteger(n) && n > 0)
  );
  const valid = new Set<number>();
  for (const raw of claimedIds) {
    const num = Number(raw);
    if (Number.isInteger(num) && allowedSet.has(num)) {
      valid.add(num);
    }
  }
  return Array.from(valid);
}

export function computeServerChallengePoints(params: {
  completedAnimeCount: number;
  totalAnimeCount: number;
  difficulty: string;
}): {
  points: number;
  progressPercent: number;
  isCompleted: boolean;
} {
  const safeTotal = Math.max(0, Math.floor(params.totalAnimeCount));
  const safeCompleted = Math.min(
    safeTotal,
    Math.max(0, Math.floor(params.completedAnimeCount))
  );
  const diffKey: ServerChallengeDifficulty =
    params.difficulty === 'hardcore' || params.difficulty === 'standard'
      ? params.difficulty
      : 'casual';
  const multiplier = SERVER_SCORING_RULES.difficultyMultiplier[diffKey];
  const isCompleted = safeTotal > 0 && safeCompleted === safeTotal;
  const progressPercent =
    safeTotal > 0 ? Math.min(100, Math.round((safeCompleted / safeTotal) * 100)) : 0;

  const rawPoints =
    SERVER_SCORING_RULES.challengeJoinBase +
    safeCompleted * SERVER_SCORING_RULES.challengeAnimeCompleted +
    (isCompleted ? SERVER_SCORING_RULES.challengeFullCompletionBonus : 0);

  return {
    points: Math.round(rawPoints * multiplier),
    progressPercent,
    isCompleted,
  };
}

export function computeServerWatchPartyPoints(rsvpStatus: string): number {
  if (rsvpStatus === 'completed') {
    return (
      SERVER_SCORING_RULES.watchPartyAttend +
      SERVER_SCORING_RULES.watchPartyCompleted
    );
  }
  if (rsvpStatus === 'attending') {
    return SERVER_SCORING_RULES.watchPartyAttend;
  }
  return 0;
}

export function evaluateServerAchievements(
  stats: {
    challengesJoined: number;
    challengesCompleted: number;
    communityEventsJoined: number;
    watchPartiesAttended: number;
    watchPartiesHostedCompleted: number;
  },
  existingIds: Set<string>
): ServerAchievementId[] {
  const unlocked: ServerAchievementId[] = [];
  const check = (id: ServerAchievementId, cond: boolean) => {
    if (cond && !existingIds.has(id)) {
      unlocked.push(id);
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
  return unlocked;
}
