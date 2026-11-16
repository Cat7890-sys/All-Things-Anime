import {
  ATA_BRAND,
  SAMPLE_COMMUNITY_HIGHLIGHTS,
  SAMPLE_DISCOVERY_SERIES,
  SAMPLE_DISCUSSIONS,
  SAMPLE_TRENDING_ANIME,
} from '../assets/sampleData';
import type {
  CommunityHighlight,
  DataBoundaryResult,
  DiscoverySeriesItem,
  DiscussionCategory,
  DiscussionThread,
  TrendingAnimeItem,
} from '../types';
import type {
  AccountServiceBoundary,
  CommunityServiceBoundary,
  DiscoveryServiceBoundary,
  FeedServiceBoundary,
} from './firebaseBoundary';

function wrapDemoResult<T>(data: T): DataBoundaryResult<T> {
  return {
    data,
    source: 'demonstration',
    status: 'foundation-preview',
    disclaimer: ATA_BRAND.demonstrationNotice,
  };
}

class SampleContentService
  implements
    FeedServiceBoundary,
    DiscoveryServiceBoundary,
    CommunityServiceBoundary,
    AccountServiceBoundary
{
  async getSampleDiscussions(
    category: DiscussionCategory = 'All'
  ): Promise<DataBoundaryResult<DiscussionThread[]>> {
    const filtered =
      category === 'All'
        ? SAMPLE_DISCUSSIONS
        : SAMPLE_DISCUSSIONS.filter((item) => item.category === category);
    return wrapDemoResult(filtered);
  }

  async getTrendingAnime(): Promise<DataBoundaryResult<TrendingAnimeItem[]>> {
    return wrapDemoResult(SAMPLE_TRENDING_ANIME);
  }

  async getFeaturedSeries(): Promise<DataBoundaryResult<DiscoverySeriesItem[]>> {
    return wrapDemoResult(SAMPLE_DISCOVERY_SERIES);
  }

  async getCommunityHighlights(): Promise<
    DataBoundaryResult<CommunityHighlight[]>
  > {
    return wrapDemoResult(SAMPLE_COMMUNITY_HIGHLIGHTS);
  }

  getConnectionStatus() {
    return {
      isConnected: true,
      provider: 'firebase-auth' as const,
      reason: 'Build 02 connected Firebase Auth & Firestore accounts; feeds and discovery remain demonstration previews.',
    };
  }
}

export const sampleContentService = new SampleContentService();
