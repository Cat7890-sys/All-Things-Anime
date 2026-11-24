import assert from 'node:assert/strict';
import {
  computeScheduledStartUtcMs,
  INDEPENDENT_WATCH_NOTICE,
  isValidIanaTimezone,
  validateWatchPartyForm,
  validateWatchPartyMessage,
} from '../validation.ts';
import {
  computeWatchPartyParticipantPoints,
  deriveWatchPartyLifecycleStatus,
  formatCountdownLabel,
} from '../challenges/gamificationRules.ts';
import type { CreateWatchPartyInput } from '../../types/index.ts';

// 1. IANA timezone validation
assert.equal(isValidIanaTimezone('Africa/Johannesburg'), true);
assert.equal(isValidIanaTimezone('UTC'), true);
assert.equal(isValidIanaTimezone('America/New_York'), true);
assert.equal(isValidIanaTimezone('Asia/Tokyo'), true);
assert.equal(isValidIanaTimezone('Fake/Zone_404'), false);

// 2. Timezone start UTC millisecond computation
const startJhb = computeScheduledStartUtcMs(
  '2026-06-15',
  '20:00',
  'Africa/Johannesburg'
);
const startUtc = computeScheduledStartUtcMs(
  '2026-06-15',
  '18:00',
  'UTC'
);
// South Africa is UTC+2 without DST, so 20:00 SAST is 18:00 UTC
assert.equal(startJhb, startUtc);

// 3. Option A strict invariant: Form requires independent watch notice agreement
const validPartyInput: CreateWatchPartyInput = {
  title: 'Demon Slayer Season Finale Watch',
  description: 'Join the community discussion while watching the season finale on your own service.',
  animeId: 101922,
  animeTitle: 'Demon Slayer: Kimetsu no Yaiba',
  animeCoverUrl: 'https://cdn.example.com/ds.jpg',
  episodeNumber: 26,
  scheduledDate: '2026-06-20',
  startTime: '19:30',
  timezone: 'Africa/Johannesburg',
  estimatedDurationMinutes: 45,
  participantLimit: 50,
  visibility: 'public',
  discussionEnabled: true,
  independentWatchNoticeAcknowledged: true,
};

assert.equal(validateWatchPartyForm(validPartyInput), null);

// Unacknowledged Option A notice rejection
assert.equal(
  validateWatchPartyForm({
    ...validPartyInput,
    independentWatchNoticeAcknowledged: false,
  }),
  'You must acknowledge the independent legal watching notice to schedule a watch party.'
);

// Invalid time format rejection
assert.equal(
  validateWatchPartyForm({
    ...validPartyInput,
    startTime: '25:99',
  }),
  'Start time must use 24-hour HH:MM format.'
);

// Invalid duration rejection
assert.equal(
  validateWatchPartyForm({
    ...validPartyInput,
    estimatedDurationMinutes: 500,
  }),
  'Estimated duration must be between 10 and 480 minutes.'
);

// 4. Watch Party discussion message validation
assert.equal(
  validateWatchPartyMessage('That opening sequence animation was breathtaking!'),
  null
);

assert.equal(
  validateWatchPartyMessage('   '),
  'Message cannot be empty.'
);

assert.equal(
  validateWatchPartyMessage('a'.repeat(601)),
  'Discussion messages must be 600 characters or fewer.'
);

// 5. Watch Party lifecycle status derivation
const partyStartMs = 1_700_000_000_000;
const durationMin = 30;
const beforeStartMs = partyStartMs - 100_000;
const duringPartyMs = partyStartMs + 10 * 60 * 1000;
const afterPartyMs = partyStartMs + 45 * 60 * 1000;

assert.equal(
  deriveWatchPartyLifecycleStatus('scheduled', partyStartMs, durationMin, beforeStartMs),
  'scheduled'
);
assert.equal(
  deriveWatchPartyLifecycleStatus('scheduled', partyStartMs, durationMin, duringPartyMs),
  'live'
);
assert.equal(
  deriveWatchPartyLifecycleStatus('scheduled', partyStartMs, durationMin, afterPartyMs),
  'completed'
);
assert.equal(
  deriveWatchPartyLifecycleStatus('cancelled', partyStartMs, durationMin, duringPartyMs),
  'cancelled'
);

// 6. Countdown label formatting
assert.equal(
  formatCountdownLabel(partyStartMs, durationMin, 'cancelled', beforeStartMs),
  'Cancelled'
);
assert.equal(
  formatCountdownLabel(partyStartMs, durationMin, 'scheduled', duringPartyMs),
  'Watch Window Active Now'
);
assert.equal(
  formatCountdownLabel(partyStartMs, durationMin, 'scheduled', afterPartyMs),
  'Completed'
);

const labelInHours = formatCountdownLabel(
  partyStartMs + 3 * 3600 * 1000 + 15 * 60 * 1000,
  durationMin,
  'scheduled',
  partyStartMs
);
assert.equal(labelInHours, 'Starts in 3h 15m');

// 7. Watch party participant scoring
assert.equal(computeWatchPartyParticipantPoints('joined'), 0);
assert.equal(computeWatchPartyParticipantPoints('attending'), 15);
assert.equal(computeWatchPartyParticipantPoints('completed'), 40);

console.log('All Watch Party service & Option A validation tests passed!');
