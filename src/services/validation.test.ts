import assert from 'node:assert/strict';
import {
  normalizeEmail,
  normalizeUsername,
  slugifyCommunityName,
  validateAnimeTitle,
  validateAvatarUrl,
  validateBio,
  validateCommentContent,
  validateCommunityCategory,
  validateCommunityDescription,
  validateCommunityName,
  validateCommunityRules,
  validateCommunitySlug,
  validateCommunityTags,
  validateCreateCommunityForm,
  validateDisplayName,
  validateEmail,
  validateJoinRequestMessage,
  validateLoginForm,
  validatePassword,
  validatePostContent,
  validatePostForm,
  validatePostImageFile,
  validateProfileEditForm,
  validateRegistrationForm,
  validateReportDetails,
  validateSpoilerLabel,
  validateUpdateCommunityForm,
  validateUsername,
} from './validation.ts';

// 1. Email validation
assert.equal(validateEmail('fan@ata.example'), null);
assert.ok(validateEmail(''));
assert.ok(validateEmail('not-an-email'));
assert.equal(normalizeEmail('  Fan@ATA.Example '), 'fan@ata.example');

// 2. Password strength enforcement
assert.equal(validatePassword('Cosmic2026'), null);
assert.ok(validatePassword('short1A'));
assert.ok(validatePassword('alllowercase1'));
assert.ok(validatePassword('ALLUPPERCASE1'));
assert.ok(validatePassword('NoNumbersHere'));

// 3. Username rules and reserved handles
assert.equal(validateUsername('Kiri_01'), null);
assert.equal(normalizeUsername('Kiri_01'), 'kiri_01');
assert.ok(validateUsername('ab')); // too short
assert.ok(validateUsername('a'.repeat(21))); // too long
assert.ok(validateUsername('bad-handle!')); // invalid char
assert.ok(validateUsername('admin')); // reserved handle

// 4. Display name, bio, and avatar URL safety
assert.equal(validateDisplayName('Ren Takahashi'), null);
assert.ok(validateDisplayName('A')); // too short
assert.equal(validateBio('Anime and mecha enthusiast.'), null);
assert.ok(validateBio('x'.repeat(281))); // exceeds 280 chars
assert.equal(validateAvatarUrl(''), null);
assert.equal(validateAvatarUrl('https://cdn.example.com/avatar.png'), null);
assert.ok(validateAvatarUrl('javascript:alert(1)')); // rejects unsafe URI scheme
assert.ok(validateAvatarUrl('http://insecure.example.com/a.png')); // requires https

// 5. Registration form validation (including password confirmation)
const validRegErrors = validateRegistrationForm({
  email: 'ren@example.com',
  password: 'Password123',
  confirmPassword: 'Password123',
  username: 'ren_takahashi',
  displayName: 'Ren Takahashi',
});
assert.deepEqual(validRegErrors, {});

const mismatchRegErrors = validateRegistrationForm({
  email: 'ren@example.com',
  password: 'Password123',
  confirmPassword: 'DifferentPassword123',
  username: 'ren_takahashi',
  displayName: 'Ren Takahashi',
});
assert.ok(mismatchRegErrors.confirmPassword);

// 6. Login form validation
assert.deepEqual(
  validateLoginForm({
    email: 'ren@example.com',
    password: 'any',
    rememberSession: true,
  }),
  {}
);
assert.ok(
  validateLoginForm({
    email: 'invalid',
    password: '',
    rememberSession: false,
  }).email
);

// 7. Profile edit validation
assert.deepEqual(
  validateProfileEditForm({
    displayName: 'Ren Takahashi',
    bio: 'Mecha fan.',
    avatarUrl: '',
  }),
  {}
);

// 8. Build 03: Post content, anime association, spoiler label, and image checks
assert.equal(validatePostContent('Episode 12 pacing was phenomenal.'), null);
assert.ok(validatePostContent('   ')); // empty after trim
assert.ok(validatePostContent('a'.repeat(1501))); // exceeds 1500 chars
assert.equal(validateAnimeTitle('Mob Psycho 100'), null);
assert.ok(validateAnimeTitle('a'.repeat(101))); // exceeds 100 chars
assert.equal(validateSpoilerLabel('Season 2 Finale'), null);
assert.ok(validateSpoilerLabel('a'.repeat(81))); // exceeds 80 chars

assert.equal(
  validatePostImageFile({ size: 1024 * 512, type: 'image/webp', name: 'scene.webp' }),
  null
);
assert.ok(
  validatePostImageFile({ size: 1024, type: 'image/svg+xml', name: 'bad.svg' })
); // rejects SVG
assert.ok(
  validatePostImageFile({ size: 6 * 1024 * 1024, type: 'image/png', name: 'huge.png' })
); // exceeds 5MB
assert.ok(
  validatePostImageFile({ size: 0, type: 'image/jpeg', name: 'empty.jpg' })
);

assert.equal(
  validatePostForm({
    content: 'Great match cut in episode 4.',
    animeTitle: 'Frieren',
    hasSpoiler: true,
    spoilerLabel: 'Episode 4',
  }),
  null
);
assert.ok(
  validatePostForm({
    content: '',
    animeTitle: 'Frieren',
    hasSpoiler: false,
    spoilerLabel: '',
  })
);

// 9. Build 03: Comment & moderation report validation
assert.equal(validateCommentContent('Agreed — the soundtrack elevated that scene.'), null);
assert.ok(validateCommentContent('   '));
assert.ok(validateCommentContent('c'.repeat(801)));

assert.equal(validateReportDetails({ details: 'Contains untagged finale spoiler.' }), null);
assert.ok(validateReportDetails({ details: 'd'.repeat(501) }));

// 10. Build 04A: Community name, slug, description, category, tags, rules, join request
assert.equal(slugifyCommunityName('Sakuga Frame Study!!'), 'sakuga-frame-study');
assert.equal(validateCommunityName('Sakuga Frame Study'), null);
assert.ok(validateCommunityName('AB')); // too short
assert.ok(validateCommunityName('n'.repeat(51))); // too long

assert.equal(validateCommunitySlug('sakuga-frame-study'), null);
assert.ok(validateCommunitySlug('ab')); // too short
assert.ok(validateCommunitySlug('Sakuga_Club')); // uppercase/underscore disallowed
assert.ok(validateCommunitySlug('sakuga--study')); // double hyphen disallowed

assert.equal(
  validateCommunityDescription('Deep breakdowns of keyframe animation and scene layouts.'),
  null
);
assert.ok(validateCommunityDescription('Too short'));

assert.equal(validateCommunityCategory('Mecha & Sci-Fi'), null);
assert.ok(validateCommunityCategory('Invalid Genre'));

assert.equal(validateCommunityTags(['Frieren', 'Sakuga', 'Fantasy']), null);
assert.ok(
  validateCommunityTags(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
); // max 8 tags
assert.ok(validateCommunityTags(['t'.repeat(31)])); // max 30 chars per tag

assert.equal(
  validateCommunityRules(['Tag all manga spoilers cleanly.', 'Keep critiques constructive.']),
  null
);
assert.ok(validateCommunityRules(['No'])); // rule min 3 chars
assert.ok(validateCommunityRules(Array.from({ length: 11 }, (_, i) => `Rule ${i + 1} detail`))); // max 10 rules

assert.equal(validateJoinRequestMessage('Looking forward to weekly watch threads!'), null);
assert.ok(validateJoinRequestMessage('m'.repeat(301))); // max 300 chars

assert.equal(
  validateCreateCommunityForm({
    name: 'Orbital Hangar Guild',
    slug: 'orbital-hangar-guild',
    description: 'Mechanical design, retro OVA craft, and orbital battleships.',
    category: 'Mecha & Sci-Fi',
    animeTags: ['Gundam', 'Macross'],
    rules: ['Credit artists and key animators when posting cuts.'],
    visibility: 'public',
    avatarUrl: 'https://cdn.example.com/club-avatar.png',
    coverUrl: '',
  }),
  null
);

assert.ok(
  validateCreateCommunityForm({
    name: 'Orbital Hangar Guild',
    slug: 'orbital-hangar-guild',
    description: 'Mechanical design, retro OVA craft, and orbital battleships.',
    category: 'Mecha & Sci-Fi',
    animeTags: ['Gundam'],
    rules: [],
    visibility: 'private',
    avatarUrl: 'http://insecure.example.com/club.png',
  })
); // rejects non-HTTPS image URL

assert.equal(
  validateUpdateCommunityForm({
    name: 'Orbital Hangar Guild',
    description: 'Mechanical design, retro OVA craft, and orbital battleships.',
    category: 'Mecha & Sci-Fi',
    animeTags: ['Gundam', 'Patlabor'],
    rules: ['Respect spoiler tags on new episodes.'],
    removeCover: true,
    coverUrl: 'not-even-used-when-removed',
  }),
  null
);

console.log('All ATA Build 02, Build 03 & Build 04A validation assertions passed.');
