import assert from 'node:assert/strict';
import {
  ATA_SCORING_RULES,
  computeChallengePoints,
  deriveChallengeLifecycleStatus,
  evaluateUnlockedAchievements,
} from './gamificationRules.ts';
import {
  calculateChallengeProgress,
  isValidIsoDateOnly,
  validateChallengeForm,
} from '../validation.ts';
import type { CreateChallengeInput } from '../../types/index.ts';

// 1. ISO Date format validation
assert.equal(isValidIsoDateOnly('2026-06-01'), true);
assert.equal(isValidIsoDateOnly('2026-02-29'), false); // not a leap year
assert.equal(isValidIsoDateOnly('2026-13-01'), false);
assert.equal(isValidIsoDateOnly('invalid-date'), false);

// 2. Challenge form validation
const validChallengeInput: CreateChallengeInput = {
  title: 'Summer 2026 Shonen Gauntlet',
  description: 'Conquer the hottest seasonal shonen anime titles before the season ends.',
  coverImageUrl: 'https://cdn.example.com/cover.jpg',
  category: 'Seasonal Watch',
  difficulty: 'standard',
  durationType: 'monthly',
  startDate: '2026-07-01',
  endDate: '2026-07-31',
  animeTargets: [
    {
      animeId: 21,
      title: 'One Piece',
      coverImage: 'https://cdn.example.com/op.jpg',
      totalEpisodes: 12,
    },
    {
      animeId: 16498,
      title: 'Shingeki no Kyojin',
      coverImage: 'https://cdn.example.com/aot.jpg',
      totalEpisodes: 25,
    },
  ],
  requirementsText: 'Log your progress in the anime tracker and mark items complete.',
  participantLimit: 100,
  visibility: 'public',
};

assert.equal(validateChallengeForm(validChallengeInput), null);

// Inverted dates rejection
assert.equal(
  validateChallengeForm({
    ...validChallengeInput,
    startDate: '2026-08-01',
    endDate: '2026-07-01',
  }),
  'End date must be on or after the start date.'
);

// Empty anime targets rejection
assert.equal(
  validateChallengeForm({
    ...validChallengeInput,
    animeTargets: [],
  }),
  'Select at least 1 anime title for the challenge.'
);

// Excessive participant limit rejection
assert.equal(
  validateChallengeForm({
    ...validChallengeInput,
    participantLimit: 6000,
  }),
  'Participant limit must be between 2 and 5000, or left unlimited.'
);

// 3. Challenge progress percentage calculation
const p1 = calculateChallengeProgress([21, 16498], [21, 16498, 100, 200]);
assert.equal(p1.totalCount, 4);
assert.equal(p1.progressPercent, 50);
assert.equal(p1.isCompleted, false);

const p2 = calculateChallengeProgress([1, 2, 3], [1, 2, 3]);
assert.equal(p2.totalCount, 3);
assert.equal(p2.progressPercent, 100);
assert.equal(p2.isCompleted, true);

const p3 = calculateChallengeProgress([], []);
assert.equal(p3.totalCount, 0);
assert.equal(p3.progressPercent, 0);
assert.equal(p3.isCompleted, false);

// 4. Scoring calculations across difficulties and completion bonus
const casualPart = computeChallengePoints({
  completedAnimeCount: 1,
  totalAnimeCount: 2,
  difficulty: 'casual',
});
// Base 10 + 25 = 35 * 1.0 = 35
assert.equal(casualPart.points, 35);
assert.equal(casualPart.isCompleted, false);

const standardDone = computeChallengePoints({
  completedAnimeCount: 2,
  totalAnimeCount: 2,
  difficulty: 'standard',
});
// (10 + 2*25 + 100 bonus) = 160 * 1.25 = 200
assert.equal(standardDone.points, 200);
assert.equal(standardDone.isCompleted, true);

const hardcoreDone = computeChallengePoints({
  completedAnimeCount: 4,
  totalAnimeCount: 4,
  difficulty: 'hardcore',
});
// (10 + 4*25 + 100 bonus) = 210 * 1.5 = 315
assert.equal(hardcoreDone.points, 315);
assert.equal(hardcoreDone.isCompleted, true);

// 5. Lifecycle status derivation
assert.equal(
  deriveChallengeLifecycleStatus('active', '2026-06-01', '2026-06-30', '2026-05-15'),
  'upcoming'
);
assert.equal(
  deriveChallengeLifecycleStatus('active', '2026-06-01', '2026-06-30', '2026-06-15'),
  'active'
);
assert.equal(
  deriveChallengeLifecycleStatus('active', '2026-06-01', '2026-06-30', '2026-07-05'),
  'completed'
);
assert.equal(
  deriveChallengeLifecycleStatus('archived', '2026-06-01', '2026-06-30', '2026-06-15'),
  'archived'
);

// 6. Achievement unlocks eligibility evaluation
const newUnlocks = evaluateUnlockedAchievements(
  {
    challengesJoined: 1,
    challengesCompleted: 1,
    communityEventsJoined: 1,
    watchPartiesAttended: 1,
    watchPartiesHostedCompleted: 1,
  },
  new Set(['first_challenge_joined']) // already possessed
);

assert.ok(!newUnlocks.includes('first_challenge_joined')); // deduplicated
assert.ok(newUnlocks.includes('first_challenge_completed'));
assert.ok(newUnlocks.includes('community_participant'));
assert.ok(newUnlocks.includes('watch_party_attendee'));
assert.ok(newUnlocks.includes('watch_party_host'));

console.log('All Anime Challenge service & gamification unit tests passed!');
