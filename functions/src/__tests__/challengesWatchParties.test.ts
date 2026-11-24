import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeServerChallengePoints,
  computeServerWatchPartyPoints,
  evaluateServerAchievements,
  sanitizeTargetAnimeIds,
  SERVER_SCORING_RULES,
} from '../challenges/challengeWatchPartyLogic';

test('sanitizeTargetAnimeIds strictly whitelists IDs and strips fraudulent/unrequested IDs', () => {
  const allowed = [21, 16498, 101922];
  const claimed = [21, '16498', 999999, -5, 'fake_id', null, undefined, 21, 101922];

  const sanitized = sanitizeTargetAnimeIds(claimed, allowed);
  assert.deepEqual(sanitized.sort((a, b) => a - b), [21, 16498, 101922]);
});

test('computeServerChallengePoints applies transparent multipliers and completion bonuses', () => {
  // Casual: base 10 + 2*25 = 60 * 1.0 = 60
  const c1 = computeServerChallengePoints({
    completedAnimeCount: 2,
    totalAnimeCount: 3,
    difficulty: 'casual',
  });
  assert.equal(c1.points, 60);
  assert.equal(c1.progressPercent, 67);
  assert.equal(c1.isCompleted, false);

  // Standard: (base 10 + 2*25 + 100 bonus) = 160 * 1.25 = 200
  const c2 = computeServerChallengePoints({
    completedAnimeCount: 2,
    totalAnimeCount: 2,
    difficulty: 'standard',
  });
  assert.equal(c2.points, 200);
  assert.equal(c2.progressPercent, 100);
  assert.equal(c2.isCompleted, true);

  // Hardcore: (base 10 + 4*25 + 100 bonus) = 210 * 1.5 = 315
  const c3 = computeServerChallengePoints({
    completedAnimeCount: 4,
    totalAnimeCount: 4,
    difficulty: 'hardcore',
  });
  assert.equal(c3.points, 315);
  assert.equal(c3.progressPercent, 100);
  assert.equal(c3.isCompleted, true);
});

test('computeServerWatchPartyPoints awards points strictly for verified attending and completed RSVP', () => {
  assert.equal(computeServerWatchPartyPoints('joined'), 0);
  assert.equal(
    computeServerWatchPartyPoints('attending'),
    SERVER_SCORING_RULES.watchPartyAttend
  );
  assert.equal(
    computeServerWatchPartyPoints('completed'),
    SERVER_SCORING_RULES.watchPartyAttend + SERVER_SCORING_RULES.watchPartyCompleted
  );
});

test('evaluateServerAchievements idempotently evaluates unlock criteria without duplicate awards', () => {
  const existing = new Set(['first_challenge_joined']);
  const unlocks = evaluateServerAchievements(
    {
      challengesJoined: 3,
      challengesCompleted: 3,
      communityEventsJoined: 2,
      watchPartiesAttended: 2,
      watchPartiesHostedCompleted: 1,
    },
    existing
  );

  assert.ok(!unlocks.includes('first_challenge_joined')); // already unlocked
  assert.ok(unlocks.includes('first_challenge_completed'));
  assert.ok(unlocks.includes('challenge_champion'));
  assert.ok(unlocks.includes('community_participant'));
  assert.ok(unlocks.includes('watch_party_attendee'));
  assert.ok(unlocks.includes('watch_party_host'));
  assert.ok(unlocks.includes('consistent_participant'));
});
