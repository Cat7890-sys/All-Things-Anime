export type NavDestinationId =
  | 'home'
  | 'discover'
  | 'communities'
  | 'messages'
  | 'notifications'
  | 'profile';

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

export type AccountStatus = 'pending_verification' | 'active';

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
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AtaPublicProfile {
  uid: string;
  username: string;
  usernameLowercase: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
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
}

export type AuthViewMode = 'login' | 'register' | 'reset';

export type ValidationErrors<T> = Partial<Record<keyof T, string>>;

// ==========================================
// Build 03: Social Feed, Reactions, Comments, Follows, Safety
// ==========================================

export type FeedTabMode = 'community' | 'following';

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

export type ReportTargetType = 'post' | 'comment' | 'community';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'unmarked_spoiler'
  | 'hate_speech'
  | 'inappropriate_community'
  | 'rule_violation'
  | 'other';

export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  postId: string;
  communityId?: string;
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
