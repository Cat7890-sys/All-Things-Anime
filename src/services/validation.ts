import type {
  CommunityCategory,
  CreateCommunityInput,
  CreatePostInput,
  CreateReportInput,
  LoginAccountInput,
  RegisterAccountInput,
  UpdateCommunityInput,
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

// ==========================================
// Build 04A: Community Validation
// ==========================================

export const COMMUNITY_NAME_MIN = 3;
export const COMMUNITY_NAME_MAX = 50;
export const COMMUNITY_SLUG_MIN = 3;
export const COMMUNITY_SLUG_MAX = 40;
export const COMMUNITY_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const COMMUNITY_DESC_MIN = 10;
export const COMMUNITY_DESC_MAX = 500;
export const COMMUNITY_MAX_TAGS = 8;
export const COMMUNITY_TAG_MAX_LEN = 30;
export const COMMUNITY_MAX_RULES = 10;
export const COMMUNITY_RULE_MIN_LEN = 3;
export const COMMUNITY_RULE_MAX_LEN = 180;
export const JOIN_REQUEST_MESSAGE_MAX = 300;
export const COMMUNITY_IMAGE_URL_MAX = 1000;

export const COMMUNITY_CATEGORIES: readonly CommunityCategory[] = [
  'Shonen',
  'Seinen',
  'Shojo',
  'Mecha & Sci-Fi',
  'Fantasy & Isekai',
  'Slice of Life',
  'Animation & Sakuga',
  'Manga & Light Novels',
  'General',
] as const;

export function slugifyCommunityName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, COMMUNITY_SLUG_MAX);
}

export function validateCommunityName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Community name is required.';
  }
  if (trimmed.length < COMMUNITY_NAME_MIN) {
    return `Community name must be at least ${COMMUNITY_NAME_MIN} characters.`;
  }
  if (trimmed.length > COMMUNITY_NAME_MAX) {
    return `Community name must be ${COMMUNITY_NAME_MAX} characters or fewer.`;
  }
  return null;
}

export function validateCommunitySlug(slug: string): string | null {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) {
    return 'Community URL slug is required.';
  }
  if (normalized.length < COMMUNITY_SLUG_MIN) {
    return `Community slug must be at least ${COMMUNITY_SLUG_MIN} characters.`;
  }
  if (normalized.length > COMMUNITY_SLUG_MAX) {
    return `Community slug must be ${COMMUNITY_SLUG_MAX} characters or fewer.`;
  }
  if (!COMMUNITY_SLUG_REGEX.test(normalized)) {
    return 'Slug may only contain lowercase letters, numbers, and single hyphens between words.';
  }
  return null;
}

export function validateCommunityDescription(description: string): string | null {
  const trimmed = description.trim();
  if (!trimmed) {
    return 'Community description is required.';
  }
  if (trimmed.length < COMMUNITY_DESC_MIN) {
    return `Description must be at least ${COMMUNITY_DESC_MIN} characters.`;
  }
  if (trimmed.length > COMMUNITY_DESC_MAX) {
    return `Description must be ${COMMUNITY_DESC_MAX} characters or fewer.`;
  }
  return null;
}

export function validateCommunityCategory(category: string): string | null {
  if (!COMMUNITY_CATEGORIES.includes(category as CommunityCategory)) {
    return 'Please select a valid anime community category.';
  }
  return null;
}

export function validateCommunityTags(tags: string[]): string | null {
  const cleaned = tags.map((t) => t.trim()).filter(Boolean);
  if (cleaned.length > COMMUNITY_MAX_TAGS) {
    return `You can add up to ${COMMUNITY_MAX_TAGS} anime tags.`;
  }
  for (const tag of cleaned) {
    if (tag.length > COMMUNITY_TAG_MAX_LEN) {
      return `Each anime tag must be ${COMMUNITY_TAG_MAX_LEN} characters or fewer.`;
    }
  }
  return null;
}

export function validateCommunityRules(rules: string[]): string | null {
  const cleaned = rules.map((r) => r.trim()).filter(Boolean);
  if (cleaned.length > COMMUNITY_MAX_RULES) {
    return `You can define up to ${COMMUNITY_MAX_RULES} community rules.`;
  }
  for (const rule of cleaned) {
    if (rule.length < COMMUNITY_RULE_MIN_LEN) {
      return `Each community rule must be at least ${COMMUNITY_RULE_MIN_LEN} characters.`;
    }
    if (rule.length > COMMUNITY_RULE_MAX_LEN) {
      return `Each community rule must be ${COMMUNITY_RULE_MAX_LEN} characters or fewer.`;
    }
  }
  return null;
}

export function validateOptionalCommunityImageUrl(url?: string): string | null {
  const trimmed = (url || '').trim();
  if (!trimmed) return null;
  if (trimmed.length > COMMUNITY_IMAGE_URL_MAX) {
    return `Image URL must be ${COMMUNITY_IMAGE_URL_MAX} characters or fewer.`;
  }
  if (!trimmed.startsWith('https://')) {
    return 'Image URL must start with https://.';
  }
  try {
    new URL(trimmed);
  } catch {
    return 'Please enter a valid HTTPS image URL.';
  }
  return null;
}

export function validateJoinRequestMessage(message: string): string | null {
  if (message.trim().length > JOIN_REQUEST_MESSAGE_MAX) {
    return `Membership request note must be ${JOIN_REQUEST_MESSAGE_MAX} characters or fewer.`;
  }
  return null;
}

export function validateCreateCommunityForm(
  input: CreateCommunityInput
): string | null {
  const nameErr = validateCommunityName(input.name);
  if (nameErr) return nameErr;

  const slugErr = validateCommunitySlug(input.slug);
  if (slugErr) return slugErr;

  const descErr = validateCommunityDescription(input.description);
  if (descErr) return descErr;

  const catErr = validateCommunityCategory(input.category);
  if (catErr) return catErr;

  const tagsErr = validateCommunityTags(input.animeTags);
  if (tagsErr) return tagsErr;

  const rulesErr = validateCommunityRules(input.rules);
  if (rulesErr) return rulesErr;

  if (input.avatarFile) {
    const fileErr = validatePostImageFile(input.avatarFile);
    if (fileErr) return fileErr;
  } else {
    const urlErr = validateOptionalCommunityImageUrl(input.avatarUrl);
    if (urlErr) return urlErr;
  }

  if (input.coverFile) {
    const fileErr = validatePostImageFile(input.coverFile);
    if (fileErr) return fileErr;
  } else {
    const urlErr = validateOptionalCommunityImageUrl(input.coverUrl);
    if (urlErr) return urlErr;
  }

  return null;
}

export function validateUpdateCommunityForm(
  input: UpdateCommunityInput
): string | null {
  const nameErr = validateCommunityName(input.name);
  if (nameErr) return nameErr;

  const descErr = validateCommunityDescription(input.description);
  if (descErr) return descErr;

  const catErr = validateCommunityCategory(input.category);
  if (catErr) return catErr;

  const tagsErr = validateCommunityTags(input.animeTags);
  if (tagsErr) return tagsErr;

  const rulesErr = validateCommunityRules(input.rules);
  if (rulesErr) return rulesErr;

  if (input.avatarFile) {
    const fileErr = validatePostImageFile(input.avatarFile);
    if (fileErr) return fileErr;
  } else if (!input.removeAvatar) {
    const urlErr = validateOptionalCommunityImageUrl(input.avatarUrl);
    if (urlErr) return urlErr;
  }

  if (input.coverFile) {
    const fileErr = validatePostImageFile(input.coverFile);
    if (fileErr) return fileErr;
  } else if (!input.removeCover) {
    const urlErr = validateOptionalCommunityImageUrl(input.coverUrl);
    if (urlErr) return urlErr;
  }

  return null;
}

// ==========================================
// Build 04B: Private Messaging Validation
// ==========================================

export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_REQUEST_MAX_LENGTH = 1000;
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const GROUP_NAME_MIN_LENGTH = 2;
export const GROUP_NAME_MAX_LENGTH = 60;
export const GROUP_DESC_MAX_LENGTH = 300;
export const GROUP_MAX_PARTICIPANTS = 25;
export const TYPING_STALE_MS = 8000;
export const PRESENCE_ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export function buildDirectConversationId(uidA: string, uidB: string): string {
  return uidA < uidB ? `dm__${uidA}__${uidB}` : `dm__${uidB}__${uidA}`;
}

export function buildDirectKey(uidA: string, uidB: string): string {
  return uidA < uidB ? `${uidA}__${uidB}` : `${uidB}__${uidA}`;
}

export function validateMessageText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return 'Message cannot be empty.';
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return `Message must be ${MESSAGE_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function validateMessageRequestText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return 'Please write an introductory message to send a request.';
  }
  if (trimmed.length > MESSAGE_REQUEST_MAX_LENGTH) {
    return `Message request must be ${MESSAGE_REQUEST_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function canEditMessageWithinWindow(
  createdAt: Date | null,
  nowMs: number = Date.now()
): boolean {
  if (!createdAt) return false;
  return nowMs - createdAt.getTime() <= MESSAGE_EDIT_WINDOW_MS;
}

export function validateGroupName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Group name is required.';
  }
  if (trimmed.length < GROUP_NAME_MIN_LENGTH) {
    return `Group name must be at least ${GROUP_NAME_MIN_LENGTH} characters.`;
  }
  if (trimmed.length > GROUP_NAME_MAX_LENGTH) {
    return `Group name must be ${GROUP_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function validateGroupDescription(description: string): string | null {
  if (description.trim().length > GROUP_DESC_MAX_LENGTH) {
    return `Group description must be ${GROUP_DESC_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function validateGroupParticipants(
  creatorId: string,
  participantIds: string[]
): string | null {
  const uniqueOthers = Array.from(
    new Set(
      participantIds.map((id) => id.trim()).filter((id) => id && id !== creatorId)
    )
  );
  if (uniqueOthers.length === 0) {
    return 'Select at least one verified member to start a group conversation.';
  }
  if (uniqueOthers.length + 1 > GROUP_MAX_PARTICIPANTS) {
    return `Group conversations support up to ${GROUP_MAX_PARTICIPANTS} participants total.`;
  }
  return null;
}

export function validateCreateGroupForm(
  creatorId: string,
  input: {
    name: string;
    description: string;
    participantIds: string[];
    avatarUrl?: string;
    avatarFile?: { size: number; type: string; name?: string } | null;
  }
): string | null {
  const nameErr = validateGroupName(input.name);
  if (nameErr) return nameErr;

  const descErr = validateGroupDescription(input.description);
  if (descErr) return descErr;

  const partErr = validateGroupParticipants(creatorId, input.participantIds);
  if (partErr) return partErr;

  if (input.avatarFile) {
    const fileErr = validatePostImageFile(input.avatarFile);
    if (fileErr) return fileErr;
  } else {
    const urlErr = validateOptionalCommunityImageUrl(input.avatarUrl);
    if (urlErr) return urlErr;
  }

  return null;
}

export function validateUpdateGroupForm(input: {
  name: string;
  description: string;
  avatarUrl?: string;
  avatarFile?: { size: number; type: string; name?: string } | null;
  removeAvatar?: boolean;
}): string | null {
  const nameErr = validateGroupName(input.name);
  if (nameErr) return nameErr;

  const descErr = validateGroupDescription(input.description);
  if (descErr) return descErr;

  if (input.avatarFile) {
    const fileErr = validatePostImageFile(input.avatarFile);
    if (fileErr) return fileErr;
  } else if (!input.removeAvatar) {
    const urlErr = validateOptionalCommunityImageUrl(input.avatarUrl);
    if (urlErr) return urlErr;
  }

  return null;
}

export function isValidDirectRecipient(
  senderId: string,
  recipientId: string
): string | null {
  if (!senderId || !recipientId) {
    return 'Both sender and recipient accounts are required.';
  }
  if (senderId === recipientId) {
    return 'You cannot send a private message to your own account.';
  }
  return null;
}

// ==========================================
// Build 06: Complete Personalisation Validation
// ==========================================

export const WATCHLIST_STATUSES = [
  'watching',
  'planning',
  'completed',
  'on_hold',
  'dropped',
] as const;

export const APPROVED_ACCENT_COLORS = [
  'red',
  'crimson',
  'amber',
  'violet',
  'azure',
  'emerald',
] as const;

export const APPROVED_THEMES = ['dark', 'light', 'system'] as const;
export const APPROVED_FEED_DENSITIES = ['comfortable', 'compact'] as const;
export const APPROVED_FEED_TABS = [
  'for_you',
  'following',
  'communities',
  'trending',
  'latest',
] as const;

export const COLLECTION_TITLE_MIN = 3;
export const COLLECTION_TITLE_MAX = 60;
export const COLLECTION_DESC_MAX = 500;
export const COLLECTION_MAX_ITEMS = 100;
export const PERSONAL_NOTES_MAX = 1000;

export function validateWatchlistStatus(status: string): string | null {
  if (!WATCHLIST_STATUSES.includes(status as (typeof WATCHLIST_STATUSES)[number])) {
    return 'Please select a valid watchlist status (Watching, Planning, Completed, On Hold, or Dropped).';
  }
  return null;
}

export function validateWatchedEpisodes(
  episodesWatched: number,
  totalEpisodes: number | null
): string | null {
  if (typeof episodesWatched !== 'number' || isNaN(episodesWatched)) {
    return 'Episodes watched must be a valid number.';
  }
  if (episodesWatched < 0) {
    return 'Episodes watched cannot be negative.';
  }
  if (totalEpisodes !== null && totalEpisodes > 0 && episodesWatched > totalEpisodes) {
    return `Episodes watched (${episodesWatched}) cannot exceed the confirmed total of ${totalEpisodes} episodes.`;
  }
  return null;
}

export function validateAnimeRating(
  rating: number | null | undefined
): string | null {
  if (rating === null || rating === undefined || rating === 0) {
    return null; // Unrated is valid
  }
  if (typeof rating !== 'number' || isNaN(rating)) {
    return 'Rating must be a valid number between 1 and 10.';
  }
  if (rating < 1 || rating > 10) {
    return 'Rating must be between 1 and 10.';
  }
  return null;
}

export function validatePersonalNotes(notes: string): string | null {
  if (notes && notes.length > PERSONAL_NOTES_MAX) {
    return `Personal notes must be ${PERSONAL_NOTES_MAX} characters or fewer.`;
  }
  return null;
}

export function validateCollectionTitle(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) {
    return 'Collection title is required.';
  }
  if (trimmed.length < COLLECTION_TITLE_MIN) {
    return `Title must be at least ${COLLECTION_TITLE_MIN} characters.`;
  }
  if (trimmed.length > COLLECTION_TITLE_MAX) {
    return `Title must be ${COLLECTION_TITLE_MAX} characters or fewer.`;
  }
  return null;
}

export function validateCollectionDescription(description: string): string | null {
  if (description && description.length > COLLECTION_DESC_MAX) {
    return `Description must be ${COLLECTION_DESC_MAX} characters or fewer.`;
  }
  return null;
}

export function validateCollectionVisibility(visibility: string): string | null {
  if (visibility !== 'private' && visibility !== 'public') {
    return 'Visibility must be either private or public.';
  }
  return null;
}

export function validateCollectionItemsCount(count: number): string | null {
  if (count > COLLECTION_MAX_ITEMS) {
    return `A collection can contain up to ${COLLECTION_MAX_ITEMS} anime entries.`;
  }
  return null;
}

export function validateThemePreference(theme: string): string | null {
  if (!APPROVED_THEMES.includes(theme as (typeof APPROVED_THEMES)[number])) {
    return 'Theme must be dark, light, or system.';
  }
  return null;
}

export function validateAccentColor(color: string): string | null {
  if (!APPROVED_ACCENT_COLORS.includes(color as (typeof APPROVED_ACCENT_COLORS)[number])) {
    return 'Please select an approved ATA accent colour.';
  }
  return null;
}

export function validateFeedDensity(density: string): string | null {
  if (!APPROVED_FEED_DENSITIES.includes(density as (typeof APPROVED_FEED_DENSITIES)[number])) {
    return 'Feed density must be comfortable or compact.';
  }
  return null;
}

export function validateDefaultFeedTab(tab: string): string | null {
  if (!APPROVED_FEED_TABS.includes(tab as (typeof APPROVED_FEED_TABS)[number])) {
    return 'Please select a valid default feed tab.';
  }
  return null;
}


