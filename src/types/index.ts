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

export type ReportTargetType = 'post' | 'comment';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'unmarked_spoiler'
  | 'hate_speech'
  | 'other';

export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  postId: string;
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
