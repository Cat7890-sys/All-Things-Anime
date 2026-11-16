import assert from 'node:assert/strict';
import {
  normalizeEmail,
  normalizeUsername,
  validateAvatarUrl,
  validateBio,
  validateDisplayName,
  validateEmail,
  validateLoginForm,
  validatePassword,
  validateProfileEditForm,
  validateRegistrationForm,
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

console.log('All ATA Build 02 validation assertions passed.');
