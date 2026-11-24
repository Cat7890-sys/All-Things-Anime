export type NavDestinationId =
  | 'home'
  | 'discover'
  | 'communities'
  | 'messages'
  | 'notifications'
  | 'profile'
  | 'my-anime'
  | 'anime-tracker'
  | 'collections'
  | 'personalisation'
  | 'calendar'
  | 'news'
  | 'challenges'
  | 'journey';

export interface NavDestination {
  id: NavDestinationId;
  label: string;
  shortLabel: string;
  description: string;
  isImplemented: boolean;
}

export type DiscussionCategory = 'All' | 'Story & Lore' | 'Animation' | 'Debates';

export interface DiscussionThread {
  id: string;
  title: string;
  excerpt: string;
  fullSampleBody: string;
  authorHandle: string;
  authorDisplay: string;
  category: Exclude<DiscussionCategory, 'All'>;
  seriesTitle: string;
  sampleReplyCount: number;
  sampleUpvotes: number;
  sampleTimestamp: string;
  isDemonstration: true;
}

export interface TrendingAnimeItem {
  id: string;
  rank: number;
  title: string;
  genre: string;
  format: string;
  episodeCount: number;
  discussionVolumeLabel: string;
  isDemonstration: true;
}

export interface CommunityHighlight {
  id: string;
  name: string;
  focus: string;
  summary: string;
  sampleMemberCount: string;
  isDemonstration: true;
}

export interface DiscoverySeriesItem {
  id: string;
  title: string;
  originalTitleNote: string;
  genre: string;
  releaseSeason: string;
  episodeCount: number;
  synopsis: string;
  studioLabel: string;
  coverImageUrl: string;
  coverAlt: string;
  isDemonstration: true;
}

export interface ComingSoonFeatureSpec {
  id: NavDestinationId;
  title: string;
  subtitle: string;
  overview: string;
  plannedCapabilities: Array<{
    index: string;
    title: string;
    detail: string;
  }>;
  milestoneNote: string;
}

export type ServiceBoundaryStatus = 'foundation-preview';

export interface DataBoundaryResult<T> {
  data: T;
  source: 'demonstration';
  status: ServiceBoundaryStatus;
  disclaimer: string;
}

// ==========================================
// Build 02: Independent ATA Accounts & Profiles
// ==========================================

export type AccountStatus =
  | 'pending_verification'
  | 'active'
  | 'suspended'
  | 'banned'
  | 'deletion_requested';

export interface AtaUserAccount {
  uid: string;
  username: string;
  usernameLowercase: string;
  displayName: string;
  email: string;
  bio: string;
  avatarUrl: string;
  emailVerified: boolean;
  accountStatus: AccountStatus;
  suspensionReason?: string;
  suspendedUntil?: Date | null;
  banReason?: string;
  isVerifiedBadge?: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AnimeActivitySummary {
  totalTracked: number;
  totalCompleted: number;
  totalWatching: number;
  totalEpisodesWatched: number;
  favouriteGenres: string[];
}

export interface AtaPublicProfile {
  uid: string;
  username: string;
  usernameLowercase: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl?: string;
  accentColor?: string;
  favouriteQuote?: string;
  favouriteAnimeTitles?: string[];
  favouriteCharacters?: string[];
  favouriteGenres?: string[];
  showAnimeActivity?: boolean;
  animeActivitySummary?: AnimeActivitySummary;
  followersCount: number;
  followingCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface RegisterAccountInput {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  displayName: string;
}

export interface LoginAccountInput {
  email: string;
  password: string;
  rememberSession: boolean;
}

export interface UpdateProfileInput {
  displayName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl?: string;
  accentColor?: string;
  favouriteQuote?: string;
  favouriteAnimeTitles?: string[];
  favouriteCharacters?: string[];
  favouriteGenres?: string[];
  showAnimeActivity?: boolean;
  animeActivitySummary?: AnimeActivitySummary;
}

export type AuthViewMode = 'login' | 'register' | 'reset';

export type ValidationErrors<T> = Partial<Record<keyof T, string>>;

// ==========================================
// Build 03 & 06: Social Feed, Reactions, Comments, Follows, Personalised Feeds
// ==========================================

export type FeedTabMode =
  | 'community'
  | 'for_you'
  | 'following'
  | 'communities'
  | 'trending'
  | 'latest';

export interface AtaPost {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  content: string;
  animeTitle: string;
  hasSpoiler: boolean;
  spoilerLabel: string;
  imageUrl: string;
  imagePath: string;
  likeCount: number;
  commentCount: number;
  isEdited: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreatePostInput {
  content: string;
  animeTitle: string;
  hasSpoiler: boolean;
  spoilerLabel: string;
  imageFile?: File | null;
}

export interface UpdatePostInput {
  content: string;
  animeTitle: string;
  hasSpoiler: boolean;
  spoilerLabel: string;
}

export interface AtaComment {
  id: string;
  postId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  content: string;
  parentCommentId: string;
  replyToAuthorUsername: string;
  hasSpoiler: boolean;
  isEdited: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateCommentInput {
  content: string;
  parentCommentId?: string;
  replyToAuthorUsername?: string;
  hasSpoiler?: boolean;
}

export type ReportTargetType =
  | 'post'
  | 'comment'
  | 'community'
  | 'message'
  | 'conversation'
  | 'profile'
  | 'collection'
  | 'challenge'
  | 'watch_party'
  | 'watch_party_message';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'unmarked_spoiler'
  | 'hate_speech'
  | 'inappropriate_community'
  | 'rule_violation'
  | 'copyright_infringement'
  | 'impersonation'
  | 'other';

export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  postId: string;
  communityId?: string;
  conversationId?: string;
  targetAuthorId: string;
  reason: ReportReason;
  details: string;
}

export interface BlockedUserRecord {
  id: string;
  blockerId: string;
  blockedId: string;
  blockedUsername: string;
  createdAt: Date | null;
}

// ==========================================
// Build 04A: Anime Communities & Scoped Discussions
// ==========================================

export type CommunityCategory =
  | 'Shonen'
  | 'Seinen'
  | 'Shojo'
  | 'Mecha & Sci-Fi'
  | 'Fantasy & Isekai'
  | 'Slice of Life'
  | 'Animation & Sakuga'
  | 'Manga & Light Novels'
  | 'General';

export type CommunityVisibility = 'public' | 'private';
export type CommunityStatus = 'active' | 'archived';
export type CommunityRole = 'owner' | 'moderator' | 'member';
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AtaCommunity {
  id: string;
  name: string;
  nameLowercase: string;
  slug: string;
  description: string;
  avatarUrl: string;
  avatarPath: string;
  coverUrl: string;
  coverPath: string;
  category: CommunityCategory;
  animeTags: string[];
  rules: string[];
  ownerId: string;
  moderatorIds: string[];
  memberCount: number;
  visibility: CommunityVisibility;
  status: CommunityStatus;
  isFeatured: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateCommunityInput {
  name: string;
  slug: string;
  description: string;
  category: CommunityCategory;
  animeTags: string[];
  rules: string[];
  visibility: CommunityVisibility;
  avatarUrl?: string;
  coverUrl?: string;
  avatarFile?: File | null;
  coverFile?: File | null;
}

export interface UpdateCommunityInput {
  name: string;
  description: string;
  category: CommunityCategory;
  animeTags: string[];
  rules: string[];
  avatarUrl?: string;
  coverUrl?: string;
  avatarFile?: File | null;
  coverFile?: File | null;
  removeAvatar?: boolean;
  removeCover?: boolean;
}

export interface CommunityMembership {
  id: string;
  communityId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: CommunityRole;
  joinedAt: Date | null;
  updatedAt: Date | null;
}

export interface CommunityJoinRequest {
  id: string;
  communityId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  message: string;
  status: JoinRequestStatus;
  reviewedBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// ==========================================
// Build 04B: Private Messaging System
// ==========================================

export type ConversationType = 'direct' | 'group';
export type ConversationStatus = 'active' | 'archived';
export type ConversationMemberRole = 'owner' | 'admin' | 'member';
export type MessageType = 'text' | 'system';
export type MessageRequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled';
export type MessageRequestPermission = 'everyone' | 'following' | 'mutuals';

export interface AtaMessageSettings {
  uid: string;
  allowRequests: boolean;
  requestPermission: MessageRequestPermission;
  readReceiptsEnabled: boolean;
  onlineStatusVisible: boolean;
  typingIndicatorsEnabled: boolean;
  updatedAt: Date | null;
}

export interface UpdateMessageSettingsInput {
  allowRequests: boolean;
  requestPermission: MessageRequestPermission;
  readReceiptsEnabled: boolean;
  onlineStatusVisible: boolean;
  typingIndicatorsEnabled: boolean;
}

export interface AtaUserPresence {
  uid: string;
  status: 'online' | 'away';
  visible: boolean;
  lastActiveAt: Date | null;
  updatedAt: Date | null;
}

export interface AtaConversation {
  id: string;
  type: ConversationType;
  directKey: string;
  name: string;
  description: string;
  avatarUrl: string;
  avatarPath: string;
  ownerId: string;
  adminIds: string[];
  participantIds: string[];
  lastMessageText: string;
  lastMessageSenderId: string;
  lastMessageType: 'text' | 'system' | 'none';
  lastMessageAt: Date | null;
  status: ConversationStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AtaConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: ConversationMemberRole;
  unreadCount: number;
  lastReadAt: Date | null;
  muted: boolean;
  archived: boolean;
  joinedAt: Date | null;
  updatedAt: Date | null;
}

export interface AtaMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl: string;
  messageType: MessageType;
  text: string;
  replyToMessageId: string;
  replyToPreview: string;
  replyToSenderName: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date | null;
}

export interface AtaMessageRequest {
  id: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl: string;
  recipientId: string;
  recipientUsername: string;
  recipientDisplayName: string;
  recipientAvatarUrl: string;
  initialMessage: string;
  status: MessageRequestStatus;
  conversationId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AtaTypingIndicator {
  uid: string;
  displayName: string;
  isTyping: boolean;
  updatedAt: Date | null;
}

export interface CreateGroupConversationInput {
  name: string;
  description: string;
  participantIds: string[];
  avatarUrl?: string;
  avatarFile?: File | null;
}

export interface UpdateGroupConversationInput {
  name: string;
  description: string;
  avatarUrl?: string;
  avatarFile?: File | null;
  removeAvatar?: boolean;
}

export type MessagingNotificationEventType =
  | 'new_message_request'
  | 'accepted_message_request'
  | 'new_direct_message'
  | 'new_group_message'
  | 'group_membership_change';

export interface MessagingNotificationEvent {
  type: MessagingNotificationEventType;
  recipientIds: string[];
  actorId: string;
  conversationId?: string;
  requestId?: string;
  neutralPreviewText: string;
  createdAtMs: number;
}

// ==========================================
// Build 05: Notification Centre & Real-Time Alerts
// ==========================================

export type NotificationCategory =
  | 'social'
  | 'followers'
  | 'communities'
  | 'messaging'
  | 'groups'
  | 'system';

export type NotificationType =
  | 'like_post'
  | 'comment_post'
  | 'reply_comment'
  | 'mention'
  | 'new_follower'
  | 'join_request'
  | 'approve_request'
  | 'decline_request'
  | 'remove_member'
  | 'change_role'
  | 'transfer_owner'
  | 'community_announcement'
  | 'new_message_request'
  | 'accepted_message_request'
  | 'new_direct_message'
  | 'new_group_message'
  | 'group_added'
  | 'group_removed'
  | 'group_admin_promote'
  | 'group_update'
  | 'system_notice'
  | 'challenge_invite'
  | 'challenge_reminder'
  | 'challenge_completed'
  | 'watch_party_invite'
  | 'watch_party_joined'
  | 'watch_party_reminder'
  | 'watch_party_cancelled'
  | 'watch_party_updated'
  | 'community_challenge_created'
  | 'achievement_unlocked';

export interface AtaNotification {
  id: string;
  recipientId: string;
  actorId?: string;
  actorUsername?: string;
  actorDisplayName?: string;
  actorAvatarUrl?: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  targetType?:
    | 'post'
    | 'comment'
    | 'profile'
    | 'community'
    | 'conversation'
    | 'message_request'
    | 'group'
    | 'challenge'
    | 'watch_party'
    | 'system';
  targetId?: string;
  route?: string;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: Date | null;
  readAt: Date | null;
  dedupeKey: string;
  metadata?: Record<string, string>;
}

export interface AtaNotificationSettings {
  userId: string;
  enabled: boolean;
  socialEnabled: boolean;
  followersEnabled: boolean;
  communitiesEnabled: boolean;
  messagingEnabled: boolean;
  groupsEnabled: boolean;
  systemEnabled: boolean;
  popupEnabled: boolean;
  soundEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // e.g. "22:00"
  quietHoursEnd: string;   // e.g. "08:00"
  timezone: string;
  updatedAt: Date | null;
}

export type UpdateNotificationSettingsInput = Partial<
  Omit<AtaNotificationSettings, 'userId' | 'updatedAt'>
>;

// ==========================================
// Build 06: Complete Personalisation
// ==========================================

import type { NormalizedAnime } from '../services/catalogue/anilistTypes';

export type AtaThemePreference = 'dark' | 'light' | 'system';
export type AtaAccentColor = 'red' | 'crimson' | 'amber' | 'violet' | 'azure' | 'emerald';
export type AtaFeedDensity = 'comfortable' | 'compact';
export type DefaultFeedTab = 'for_you' | 'following' | 'communities' | 'trending' | 'latest';

export type RecommendationCategoryId =
  | 'recommended_for_you'
  | 'because_you_watched'
  | 'similar_anime'
  | 'hidden_gems'
  | 'trending_in_interests'
  | 'continue_exploring';

export type RecommendationDiversity = 'focused' | 'balanced' | 'diverse';

export interface DashboardWidgetConfig {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
}

export interface AtaUserPreferences {
  userId: string;
  themePreference: AtaThemePreference;
  accentColor: AtaAccentColor;
  feedDensity: AtaFeedDensity;
  reducedMotion: boolean;
  defaultFeed: DefaultFeedTab;
  hiddenTopics: string[];
  hiddenGenres: string[];
  recommendationsEnabled: boolean;
  onboardingCompleted: boolean;
  profileBannerUrl?: string;
  profileAccentColor?: string;
  favouriteQuote?: string;
  favouriteAnimeTitles: string[];
  favouriteCharacters: string[];
  favouriteGenres: string[];
  favouriteThemes: string[];
  preferredFormats: string[];
  preferredPeriods: string[];
  favouriteStudios: string[];
  preferredTypes: string[];
  avoidAnimeIds: string[];
  avoidAnimeTitles: string[];
  topicsToAvoid: string[];
  preferredRecommendationCategories: RecommendationCategoryId[];
  prioritiseAiring: boolean;
  prioritiseCompleted: boolean;
  includeOlderAnime: boolean;
  prioritiseHighlyRated: boolean;
  showLesserKnown: boolean;
  recommendationDiversity: RecommendationDiversity;
  showAnimeStatsOnProfile: boolean;
  showFavouriteAnimeOnProfile: boolean;
  showCollectionsOnProfile: boolean;
  dashboardWidgets: DashboardWidgetConfig[];
  updatedAt: Date | null;
}

export type UpdateUserPreferencesInput = Partial<
  Omit<AtaUserPreferences, 'userId' | 'updatedAt'>
>;

// Legacy Curated Anime Catalogue Type (preserved for backwards compatibility)
export interface AnimeCatalogueItem {
  id: string;
  title: string;
  romajiTitle: string;
  englishTitle: string;
  genres: string[];
  format: 'TV Series' | 'Movie' | 'OVA' | 'ONA' | 'Special';
  episodes: number | null; // null if unconfirmed or ongoing
  seasonYear: string;
  synopsis: string;
  coverImage: string;
  score: number;
  characters: string[];
  tags: string[];
  isFeatured?: boolean;
}

// Watchlist and Anime Tracker
export type WatchlistStatus =
  | 'watching'
  | 'planning'
  | 'completed'
  | 'on_hold'
  | 'dropped';

export interface UserAnimeListItem {
  id: string; // animeId
  userId: string;
  animeId: string;
  animeTitle: string;
  animeCoverUrl: string;
  genres: string[];
  studios: string[];
  format: string;
  seasonYear: number | null;
  totalEpisodes: number | null; // verified when known, otherwise null
  episodesWatched: number;
  status: WatchlistStatus;
  userRating: number | null; // 1-10 or null
  startDate: string | null; // YYYY-MM-DD
  completionDate: string | null; // YYYY-MM-DD
  personalNotes: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface UpsertAnimeListItemInput {
  animeId: string;
  animeTitle: string;
  animeCoverUrl: string;
  genres: string[];
  studios?: string[];
  format: string;
  seasonYear?: number | null;
  totalEpisodes: number | null;
  episodesWatched: number;
  status: WatchlistStatus;
  userRating?: number | null;
  startDate?: string | null;
  completionDate?: string | null;
  personalNotes?: string;
}

// Custom Anime Collections
export type CollectionVisibility = 'private' | 'public';

export interface CollectionItem {
  id: string; // animeId
  animeId: string;
  title: string;
  coverImage: string;
  format?: string;
  note?: string;
  position: number;
  addedAt: Date | null;
}

export interface UserCollection {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  ownerAvatarUrl: string;
  title: string;
  description: string;
  coverImageUrl: string;
  visibility: CollectionVisibility;
  items: CollectionItem[];
  itemCount: number;
  likeCount: number;
  saveCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateCollectionInput {
  title: string;
  description: string;
  coverImageUrl?: string;
  visibility: CollectionVisibility;
  items?: Omit<CollectionItem, 'addedAt'>[];
}

export interface UpdateCollectionInput {
  title?: string;
  description?: string;
  coverImageUrl?: string;
  visibility?: CollectionVisibility;
  items?: Omit<CollectionItem, 'addedAt'>[];
}

// Recommendation Engine & Feedback
export type RecommendationFeedbackType =
  | 'like'
  | 'dislike'
  | 'not_interested'
  | 'saved';

export interface RecommendationFeedback {
  animeId: string;
  feedbackType: RecommendationFeedbackType;
  reason?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AnimeRecommendation {
  anime: NormalizedAnime;
  category: RecommendationCategoryId;
  score: number;
  reasonCategory:
    | 'Recommended For You'
    | 'Because You Watched'
    | 'Similar Anime'
    | 'Hidden Gems'
    | 'Trending In Your Interests'
    | 'Continue Exploring';
  reasonDetail: string;
  matchedSignals: string[];
  seedAnimeTitle?: string;
}

export interface MonthlyActivityPoint {
  monthKey: string;
  label: string;
  updatedCount: number;
  completedCount: number;
}

// Personal Statistics & Insights
export interface PersonalAnimeInsights {
  totalTracked: number;
  totalCompleted: number;
  totalWatching: number;
  totalPlanning: number;
  totalOnHold: number;
  totalDropped: number;
  totalEpisodesWatched: number;
  averageRating: number | null;
  completionRate: number;
  genreDistribution: Record<string, number>;
  ratingDistribution: Record<number, number>;
  formatDistribution: Record<string, number>;
  studioDistribution: Record<string, number>;
  statusDistribution: Record<WatchlistStatus, number>;
  monthlyActivity: MonthlyActivityPoint[];
  recentWatchlistChanges: UserAnimeListItem[];
  totalCollections: number;
}

// ==========================================
// Build 07A: Anime Companion Experience
// ==========================================

export interface WatchReminder {
  id: string; // animeId_episodeNumber
  userId: string;
  animeId: string;
  animeTitle: string;
  animeCoverUrl: string;
  episodeNumber: number;
  airingAt: number; // Unix timestamp in seconds
  offsetMinutes: number; // e.g. 0, 15, 60
  isNotified?: boolean;
  createdAt: Date | null;
}

export type NewsCategory = 'Industry' | 'Releases' | 'Reviews' | 'Interviews' | 'Events';

export interface AnimeNewsArticle {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  category: NewsCategory;
  publishedAt: string;
  summary: string;
  imageUrl: string;
  author: string;
  isBookmarked?: boolean;
  isSamplePreview?: boolean;
}

export interface WatchJourneyMilestone {
  id: string;
  title: string;
  description: string;
  icon: string;
  achieved: boolean;
  progressText: string;
}

// ==========================================
// Build 08A: Where to Watch (Free Streaming Directory)
// ==========================================

export type StreamingAccessModel = 'Free with Ads' | 'Free';
export type StreamingAvailabilityType =
  | 'full_series'
  | 'selected_episodes'
  | 'promotional'
  | 'movie';
export type StreamingVerificationStatus =
  | 'verified'
  | 'unverified'
  | 'needs_review';

export interface StreamingProvider {
  id: string;
  name: string;
  shortLabel: string;
  accentHex: string;
  logoUrl?: string;
  description: string;
  supportedCountries: string[];
  officialUrl: string;
  allowedDomains: string[];
  accessModel: StreamingAccessModel;
  isFree: boolean;
  isLegitimate: boolean;
  verificationStatus: StreamingVerificationStatus;
  lastVerifiedAt: string;
}

export interface AnimeStreamingAvailability {
  id: string;
  animeId: number;
  animeTitle: string;
  providerId: string;
  providerName: string;
  countryCode: string;
  isFree: boolean;
  isLegitimate: boolean;
  officialUrl: string;
  accessModel: StreamingAccessModel;
  availabilityType: StreamingAvailabilityType;
  verificationStatus: StreamingVerificationStatus;
  lastVerifiedAt: string;
  source: string;
  notes?: string;
}

export interface StreamingAvailabilityReport {
  id: string;
  userId: string;
  animeId: number;
  animeTitle: string;
  countryCode: string;
  providerId?: string;
  providerName?: string;
  reason: string;
  details: string;
  status: 'open' | 'reviewed';
  createdAt: Date | null;
}

// ==========================================
// Build 08B: Three-Admin System, Dashboard & Legal Compliance
// ==========================================

export type AdminSeatId = 'owner' | 'platform_admin' | 'content_admin';
export type AdminRole = 'owner' | 'platform_admin' | 'content_admin';
export type AdminSeatStatus = 'active' | 'restricted' | 'revoked';

export type AdminPermission =
  | 'user_management'
  | 'account_moderation'
  | 'user_reports'
  | 'content_moderation'
  | 'community_management'
  | 'copyright_complaints'
  | 'user_feedback'
  | 'announcements'
  | 'platform_statistics'
  | 'operational_monitoring'
  | 'catalogue_management'
  | 'metadata_corrections'
  | 'featured_content'
  | 'seasonal_displays'
  | 'anime_news'
  | 'recommendations'
  | 'where_to_watch'
  | 'country_availability'
  | 'streaming_verification'
  | 'legal_compliance'
  | 'security_incidents'
  | 'admin_management'
  | 'audit_logs'
  | 'system_health';

export interface AdminAccountRecord {
  uid: string;
  seatId: AdminSeatId;
  role: AdminRole;
  displayLabel: string;
  email: string;
  permissions: AdminPermission[];
  status: AdminSeatStatus;
  restrictionReason?: string;
  assignedByUid: string;
  assignedAt: Date | null;
  updatedAt: Date | null;
  lastLoginAt?: Date | null;
}

export interface AdminSeatSummary {
  seatId: AdminSeatId;
  title: string;
  description: string;
  occupied: boolean;
  uid: string;
  email: string;
  displayLabel: string;
  role: AdminRole;
  permissions: AdminPermission[];
  status: AdminSeatStatus;
  restrictionReason?: string;
  updatedAt: Date | null;
  lastLoginAt?: Date | null;
}

export type ModerationDecisionStatus =
  | 'pending'
  | 'under_review'
  | 'action_taken'
  | 'dismissed'
  | 'escalated';

export type ModerationContentStatus = 'active' | 'removed_by_moderator' | 'restored';

export interface AdminReportRecord {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  postId: string;
  communityId?: string;
  conversationId?: string;
  targetAuthorId: string;
  reason: ReportReason;
  details: string;
  status: 'open' | ModerationDecisionStatus;
  reviewNotes?: string;
  reviewedByUid?: string;
  reviewedAt?: Date | null;
  createdAt: Date | null;
}

export interface ModerationDecisionRecord {
  id: string;
  targetType: ReportTargetType | 'user';
  targetId: string;
  action: 'remove' | 'restore' | 'dismiss' | 'escalate' | 'suspend' | 'ban' | 'restore_account';
  reason: string;
  evidenceSummary: string;
  actorUid: string;
  actorRole: AdminRole;
  createdAt: Date | null;
}

export interface CopyrightComplaint {
  id: string;
  reporterUid: string;
  claimantName: string;
  claimantEmail: string;
  rightsHolderOrganization: string;
  workTitle: string;
  targetType: 'post' | 'comment' | 'community' | 'collection' | 'news' | 'streaming_link' | 'other';
  targetReference: string;
  description: string;
  goodFaithConfirmed: boolean;
  accuracyConfirmed: boolean;
  status: ModerationDecisionStatus;
  resolutionNotes?: string;
  handledByUid?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AccountDeletionRequest {
  id: string;
  userId: string;
  username: string;
  email: string;
  reason: string;
  acknowledgedIrreversible: boolean;
  status: 'pending' | 'under_review' | 'completed' | 'declined';
  reviewNotes?: string;
  reviewedByUid?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface UserFeedbackRecord {
  id: string;
  userId: string;
  category: 'bug' | 'feature_request' | 'accessibility' | 'safety' | 'streaming' | 'general';
  subject: string;
  message: string;
  pageContext: string;
  status: 'open' | 'reviewed' | 'resolved';
  adminNotes?: string;
  reviewedByUid?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface PlatformAnnouncement {
  id: string;
  title: string;
  body: string;
  kind: 'general' | 'maintenance' | 'safety' | 'feature';
  audience: 'all_users' | 'selected_users';
  targetUserIds: string[];
  isActive: boolean;
  sendInAppNotification: boolean;
  createdByUid: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  archivedAt?: Date | null;
}

export interface CatalogueOverrideRecord {
  id: string; // String(animeId)
  animeId: number;
  animeTitle: string;
  overrideTitle?: string;
  overrideSynopsis?: string;
  editorialNote?: string;
  isFeatured: boolean;
  isTrendingOverride: boolean;
  isSeasonalHighlight: boolean;
  recommendationPinned: boolean;
  isHiddenFromCatalogue: boolean;
  metadataIssueFlag: boolean;
  updatedByUid: string;
  updatedAt: Date | null;
}

export interface AdminNewsArticle extends AnimeNewsArticle {
  status: 'published' | 'draft' | 'archived';
  isFeatured: boolean;
  createdByUid: string;
  updatedAt: Date | null;
}

export interface AdminAuditLogEntry {
  id: string;
  actorUid: string;
  actorRole: AdminRole | 'system' | 'anonymous';
  actorSeatId: AdminSeatId | 'system' | 'none';
  actionType: string;
  targetCollection: string;
  targetId: string;
  summary: string;
  source: 'cloud_function' | 'admin_console';
  createdAt: Date | null;
}

export interface AdminLoginEvent {
  id: string;
  actorUid: string;
  emailMasked: string;
  seatId: AdminSeatId | 'unknown';
  outcome: 'login_success' | 'login_denied' | 'login_failed' | 'logout' | 'reauth_success' | 'reauth_failed';
  reason: string;
  createdAt: Date | null;
}

export interface SecurityIncidentRecord {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'investigating' | 'contained' | 'resolved';
  summary: string;
  remediationSteps: string;
  regulatorsNotified: boolean;
  reportedByUid: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface LegalDocumentOverride {
  id: 'privacy-policy' | 'terms' | 'cookie-policy' | 'refund-policy' | 'community-guidelines';
  title: string;
  customSummary: string;
  guidelinesList: string[];
  lastUpdatedLabel: string;
  updatedByUid: string;
  updatedAt: Date | null;
}

export type LegalPageSlug =
  | 'privacy-policy'
  | 'terms'
  | 'cookie-policy'
  | 'refund-policy'
  | 'community-guidelines';

export type AppRouteView =
  | { kind: 'destination'; destination: NavDestinationId }
  | { kind: 'legal'; slug: LegalPageSlug }
  | { kind: 'admin-login' }
  | { kind: 'admin-dashboard' };

// ==========================================
// Build 09: Community Anime Challenges & Watch Parties (Option A)
// ==========================================

export type ChallengeCategory =
  | 'Seasonal Watch'
  | 'Genre Marathon'
  | 'Classic Essentials'
  | 'Studio Spotlight'
  | 'Movie Night'
  | 'Community Special';

export type ChallengeDifficulty = 'casual' | 'standard' | 'hardcore';
export type ChallengeDurationType = 'weekly' | 'monthly' | 'seasonal' | 'custom';
export type ChallengeLifecycleStatus = 'upcoming' | 'active' | 'completed' | 'archived';
export type ChallengeVisibility = 'public' | 'community';

export interface ChallengeAnimeTarget {
  animeId: number;
  title: string;
  coverImage: string;
  totalEpisodes: number | null;
  format?: string;
}

export interface AnimeChallenge {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  durationType: ChallengeDurationType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  animeTargets: ChallengeAnimeTarget[];
  requirementsText: string;
  participantLimit: number | null;
  participantCount: number;
  completedCount: number;
  visibility: ChallengeVisibility;
  communityId: string;
  communityName: string;
  communityVisibility: 'public' | 'private' | 'none';
  creatorId: string;
  creatorUsername: string;
  creatorDisplayName: string;
  status: ChallengeLifecycleStatus;
  isFeatured: boolean;
  moderationStatus: 'active' | 'removed_by_moderator' | 'suspended';
  moderationReason?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ChallengeParticipation {
  id: string; // {challengeId}__{userId}
  challengeId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  communityId: string;
  completedAnimeIds: number[];
  episodeProgressMap: Record<string, number>;
  totalAnimeCount: number;
  progressPercent: number;
  status: 'active' | 'completed';
  pointsAwarded: number;
  trackerSynced: boolean;
  joinedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateChallengeInput {
  title: string;
  description: string;
  coverImageUrl?: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  durationType: ChallengeDurationType;
  startDate: string;
  endDate: string;
  animeTargets: ChallengeAnimeTarget[];
  requirementsText: string;
  participantLimit: number | null;
  visibility: ChallengeVisibility;
  communityId?: string;
  communityName?: string;
  communityVisibility?: 'public' | 'private' | 'none';
}

export interface UpdateChallengeInput {
  title: string;
  description: string;
  coverImageUrl?: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  durationType: ChallengeDurationType;
  startDate: string;
  endDate: string;
  animeTargets: ChallengeAnimeTarget[];
  requirementsText: string;
  participantLimit: number | null;
  status?: ChallengeLifecycleStatus;
}

export type WatchPartyVisibility = 'public' | 'private' | 'community';
export type WatchPartyStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';
export type WatchPartyRsvpStatus = 'joined' | 'attending' | 'completed';

export interface WatchParty {
  id: string;
  title: string;
  description: string;
  animeId: number;
  animeTitle: string;
  animeCoverUrl: string;
  episodeNumber: number | null;
  scheduledDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  timezone: string; // IANA timezone string e.g. Africa/Johannesburg
  scheduledStartAtMs: number;
  estimatedDurationMinutes: number;
  participantLimit: number | null;
  participantCount: number;
  attendingCount: number;
  completedCount: number;
  visibility: WatchPartyVisibility;
  communityId: string;
  communityName: string;
  communityVisibility: 'public' | 'private' | 'none';
  invitedUserIds: string[];
  discussionEnabled: boolean;
  registrationClosed: boolean;
  creatorId: string;
  creatorUsername: string;
  creatorDisplayName: string;
  status: WatchPartyStatus;
  moderationStatus: 'active' | 'removed_by_moderator' | 'suspended';
  moderationReason?: string;
  independentWatchNotice: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface WatchPartyParticipant {
  id: string; // {partyId}__{userId}
  partyId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  rsvpStatus: WatchPartyRsvpStatus;
  reminderSet: boolean;
  joinedAt: Date | null;
  attendedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date | null;
}

export interface WatchPartyMessage {
  id: string;
  partyId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  content: string;
  hasSpoiler: boolean;
  isSystem: boolean;
  moderationStatus: 'active' | 'removed_by_moderator';
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateWatchPartyInput {
  title: string;
  description: string;
  animeId: number;
  animeTitle: string;
  animeCoverUrl: string;
  episodeNumber: number | null;
  scheduledDate: string;
  startTime: string;
  timezone: string;
  estimatedDurationMinutes: number;
  participantLimit: number | null;
  visibility: WatchPartyVisibility;
  communityId?: string;
  communityName?: string;
  communityVisibility?: 'public' | 'private' | 'none';
  invitedUserIds?: string[];
  discussionEnabled: boolean;
  independentWatchNoticeAcknowledged?: boolean;
}

export interface UpdateWatchPartyInput {
  title: string;
  description: string;
  episodeNumber: number | null;
  scheduledDate: string;
  startTime: string;
  timezone: string;
  estimatedDurationMinutes: number;
  participantLimit: number | null;
  discussionEnabled: boolean;
  registrationClosed?: boolean;
}

export type AchievementId =
  | 'first_challenge_joined'
  | 'first_challenge_completed'
  | 'challenge_champion'
  | 'community_participant'
  | 'watch_party_attendee'
  | 'watch_party_host'
  | 'consistent_participant';

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  criteriaLabel: string;
  accentTone: 'crimson' | 'emerald' | 'amber' | 'indigo' | 'sky';
}

export interface UserAchievement {
  id: string; // {userId}__{achievementId}
  userId: string;
  achievementId: AchievementId;
  title: string;
  description: string;
  sourceEventId: string;
  unlockedAt: Date | null;
}

export interface LeaderboardProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  totalPoints: number;
  challengePoints: number;
  watchPartyPoints: number;
  challengesJoined: number;
  challengesCompleted: number;
  watchPartiesAttended: number;
  watchPartiesHosted: number;
  updatedAt: Date | null;
}

export interface CommunityLeaderboardEntry {
  communityId: string;
  communityName: string;
  totalChallenges: number;
  totalParticipants: number;
  totalCompletions: number;
  totalScore: number;
}


