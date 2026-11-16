import type {
  CreatePostInput,
  CreateReportInput,
  LoginAccountInput,
  RegisterAccountInput,
  UpdatePostInput,
  UpdateProfileInput,
  ValidationErrors,
} from '../types';

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST_MAX_LENGTH = 1500;
export const ANIME_TITLE_MAX_LENGTH = 100;
export const SPOILER_LABEL_MAX_LENGTH = 80;
export const COMMENT_MAX_LENGTH = 800;
export const REPORT_DETAILS_MAX_LENGTH = 500;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'ata',
  'ata_official',
  'moderator',
  'mod',
  'support',
  'system',
  'root',
  'staff',
  'official',
]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Email address is required.';
  }
  if (trimmed.length > 254 || !EMAIL_REGEX.test(trimmed)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 128) {
    return 'Password must be 128 characters or fewer.';
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include uppercase, lowercase, and at least one number.';
  }
  return null;
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) {
    return 'Username is required.';
  }
  if (trimmed.length < 3 || trimmed.length > 20) {
    return 'Username must be between 3 and 20 characters.';
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return 'Username may only use letters, numbers, and underscores (_).';
  }
  if (RESERVED_USERNAMES.has(trimmed.toLowerCase())) {
    return 'This username is reserved. Please choose another.';
  }
  return null;
}

export function validateDisplayName(displayName: string): string | null {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return 'Display name is required.';
  }
  if (trimmed.length < 2 || trimmed.length > 40) {
    return 'Display name must be between 2 and 40 characters.';
  }
  return null;
}

export function validateBio(bio: string): string | null {
  if (bio.trim().length > 280) {
    return 'Bio must be 280 characters or fewer.';
  }
  return null;
}

export function validateAvatarUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > 500) {
    return 'Avatar URL must be 500 characters or fewer.';
  }
  if (!trimmed.startsWith('https://')) {
    return 'Avatar URL must begin with https:// (or leave blank for the default cosmic avatar).';
  }
  try {
    new URL(trimmed);
  } catch {
    return 'Please enter a valid URL.';
  }
  return null;
}

export function validateRegistrationForm(
  input: RegisterAccountInput
): ValidationErrors<RegisterAccountInput> {
  const errors: ValidationErrors<RegisterAccountInput> = {};

  const emailErr = validateEmail(input.email);
  if (emailErr) errors.email = emailErr;

  const passwordErr = validatePassword(input.password);
  if (passwordErr) errors.password = passwordErr;

  if (!input.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  const usernameErr = validateUsername(input.username);
  if (usernameErr) errors.username = usernameErr;

  const displayErr = validateDisplayName(input.displayName);
  if (displayErr) errors.displayName = displayErr;

  return errors;
}

export function validateLoginForm(
  input: LoginAccountInput
): ValidationErrors<LoginAccountInput> {
  const errors: ValidationErrors<LoginAccountInput> = {};

  const emailErr = validateEmail(input.email);
  if (emailErr) errors.email = emailErr;

  if (!input.password) {
    errors.password = 'Password is required.';
  }

  return errors;
}

export function validateProfileEditForm(
  input: UpdateProfileInput
): ValidationErrors<UpdateProfileInput> {
  const errors: ValidationErrors<UpdateProfileInput> = {};

  const displayErr = validateDisplayName(input.displayName);
  if (displayErr) errors.displayName = displayErr;

  const bioErr = validateBio(input.bio);
  if (bioErr) errors.bio = bioErr;

  const avatarErr = validateAvatarUrl(input.avatarUrl);
  if (avatarErr) errors.avatarUrl = avatarErr;

  return errors;
}

// ==========================================
// Build 03: Post, Image, Comment & Report Validation
// ==========================================

export function validatePostContent(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return 'Post content cannot be empty.';
  }
  if (trimmed.length > POST_MAX_LENGTH) {
    return `Post content must be ${POST_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function validateAnimeTitle(animeTitle: string): string | null {
  if (animeTitle.trim().length > ANIME_TITLE_MAX_LENGTH) {
    return `Anime title must be ${ANIME_TITLE_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function validateSpoilerLabel(spoilerLabel: string): string | null {
  if (spoilerLabel.trim().length > SPOILER_LABEL_MAX_LENGTH) {
    return `Spoiler label must be ${SPOILER_LABEL_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function validatePostImageFile(
  file: { size: number; type: string; name?: string } | null | undefined
): string | null {
  if (!file) return null;
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return 'Only JPEG, PNG, WebP, or GIF images are allowed.';
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Image size must be 5 MB or smaller.';
  }
  if (file.size <= 0) {
    return 'Selected image file appears to be empty.';
  }
  return null;
}

export function validatePostForm(
  input: CreatePostInput | UpdatePostInput
): string | null {
  const contentErr = validatePostContent(input.content);
  if (contentErr) return contentErr;

  const animeErr = validateAnimeTitle(input.animeTitle);
  if (animeErr) return animeErr;

  const spoilerErr = validateSpoilerLabel(input.spoilerLabel);
  if (spoilerErr) return spoilerErr;

  if ('imageFile' in input && input.imageFile) {
    const imgErr = validatePostImageFile(input.imageFile);
    if (imgErr) return imgErr;
  }

  return null;
}

export function validateCommentContent(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return 'Comment cannot be empty.';
  }
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    return `Comment must be ${COMMENT_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function validateReportDetails(
  input: Pick<CreateReportInput, 'details'>
): string | null {
  if (input.details.trim().length > REPORT_DETAILS_MAX_LENGTH) {
    return `Report details must be ${REPORT_DETAILS_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}
