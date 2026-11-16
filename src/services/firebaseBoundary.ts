import type {
  CommunityHighlight,
  DataBoundaryResult,
  DiscoverySeriesItem,
  DiscussionCategory,
  DiscussionThread,
  TrendingAnimeItem,
} from '../types';

/**
 * Clean service boundary definitions prepared for future Firebase / Firestore
 * integration. No Firebase SDK or credentials are imported in Build 01.
 */
export interface FeedServiceBoundary {
  getSampleDiscussions(
    category?: DiscussionCategory
  ): Promise<DataBoundaryResult<DiscussionThread[]>>;
}

export interface DiscoveryServiceBoundary {
  getTrendingAnime(): Promise<DataBoundaryResult<TrendingAnimeItem[]>>;
  getFeaturedSeries(): Promise<DataBoundaryResult<DiscoverySeriesItem[]>>;
}

export interface CommunityServiceBoundary {
  getCommunityHighlights(): Promise<DataBoundaryResult<CommunityHighlight[]>>;
}

export interface AuthBoundaryStatus {
  isConnected: boolean;
  provider: 'firebase-auth' | 'unconfigured';
  reason: string;
}

export interface AccountServiceBoundary {
  getConnectionStatus(): AuthBoundaryStatus;
}
