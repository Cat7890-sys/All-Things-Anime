export type AniListSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

export type AniListAiringStatus =
  | 'FINISHED'
  | 'RELEASING'
  | 'NOT_YET_RELEASED'
  | 'CANCELLED'
  | 'HIATUS';

export type AniListMediaFormat =
  | 'TV'
  | 'TV_SHORT'
  | 'MOVIE'
  | 'SPECIAL'
  | 'OVA'
  | 'ONA'
  | 'MUSIC';

export type DiscoveryCategoryKey =
  | 'trending'
  | 'seasonal'
  | 'currently_airing'
  | 'upcoming'
  | 'popular'
  | 'top_rated';

export interface AniListRawTitle {
  english?: string | null;
  romaji?: string | null;
  native?: string | null;
}

export interface AniListRawCoverImage {
  extraLarge?: string | null;
  large?: string | null;
  color?: string | null;
}

export interface AniListRawFuzzyDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

export interface AniListRawNextAiringEpisode {
  episode?: number | null;
  timeUntilAiring?: number | null;
  airingAt?: number | null;
}

export interface AniListRawRanking {
  rank?: number | null;
  type?: string | null;
  allTime?: boolean | null;
  year?: number | null;
  season?: string | null;
  context?: string | null;
}

export interface AniListRawStudioNode {
  name?: string | null;
  isAnimationStudio?: boolean | null;
}

export interface AniListRawTag {
  name?: string | null;
  rank?: number | null;
  isGeneralSpoiler?: boolean | null;
  isMediaSpoiler?: boolean | null;
  isAdult?: boolean | null;
}

export interface AniListRawRelationEdge {
  relationType?: string | null;
  node?: AniListRawMedia | null;
}

export interface AniListRawRecommendationNode {
  rating?: number | null;
  mediaRecommendation?: AniListRawMedia | null;
}

export interface AniListRawMedia {
  id?: number | null;
  isAdult?: boolean | null;
  title?: AniListRawTitle | null;
  coverImage?: AniListRawCoverImage | null;
  bannerImage?: string | null;
  averageScore?: number | null;
  popularity?: number | null;
  trending?: number | null;
  episodes?: number | null;
  status?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  startDate?: AniListRawFuzzyDate | null;
  format?: string | null;
  genres?: Array<string | null> | null;
  tags?: Array<AniListRawTag | null> | null;
  description?: string | null;
  siteUrl?: string | null;
  nextAiringEpisode?: AniListRawNextAiringEpisode | null;
  studios?: {
    nodes?: Array<AniListRawStudioNode | null> | null;
  } | null;
  rankings?: Array<AniListRawRanking | null> | null;
  relations?: {
    edges?: Array<AniListRawRelationEdge | null> | null;
  } | null;
  recommendations?: {
    nodes?: Array<AniListRawRecommendationNode | null> | null;
  } | null;
}

export interface AniListGraphQLError {
  message?: string;
  status?: number;
}

export interface AniListGraphQLResponse<TData> {
  data?: TData;
  errors?: AniListGraphQLError[];
}

export interface AniListPageMediaData {
  Page?: {
    media?: Array<AniListRawMedia | null> | null;
  } | null;
}

export interface AniListSingleMediaData {
  Media?: AniListRawMedia | null;
}

export interface RelatedAnimeSummary {
  relationType: string;
  anime: NormalizedAnime;
}

export interface RecommendedAnimeSummary {
  rating: number;
  anime: NormalizedAnime;
}

export interface NormalizedAnime {
  id: number;
  title: {
    english: string | null;
    romaji: string | null;
    native: string | null;
    display: string;
  };
  coverImage: {
    extraLarge: string | null;
    large: string | null;
    best: string | null;
    color: string | null;
  };
  bannerImage: string | null;
  averageScore: number | null;
  popularity: number | null;
  trending: number | null;
  trendingRank: number | null;
  episodes: number | null;
  status: AniListAiringStatus | 'UNKNOWN';
  statusLabel: string;
  season: AniListSeason | null;
  seasonYear: number | null;
  seasonLabel: string | null;
  startDate: {
    year: number | null;
    month: number | null;
    day: number | null;
    formatted: string | null;
  };
  format: AniListMediaFormat | 'UNKNOWN';
  formatLabel: string;
  genres: string[];
  tags?: string[];
  description: string | null;
  nextAiringEpisode: {
    episode: number;
    timeUntilAiring: number;
    airingAt: number;
  } | null;
  studios: string[];
  siteUrl: string;
  relations?: RelatedAnimeSummary[];
  recommendations?: RecommendedAnimeSummary[];
  isAdult: false;
}

export interface SeasonInfo {
  season: AniListSeason;
  seasonYear: number;
  label: string;
  key: string;
}

export type AniListDataSource = 'network' | 'cache' | 'stale-cache';

export interface DiscoveryCategoryResult {
  category: DiscoveryCategoryKey;
  items: NormalizedAnime[];
  seasonInfo?: SeasonInfo;
  source: AniListDataSource;
  isStale: boolean;
  fetchedAt: number;
  expiresAt: number;
  warningMessage?: string;
}

export interface SearchAnimeResult {
  query: string;
  items: NormalizedAnime[];
  source: AniListDataSource;
  isStale: boolean;
  fetchedAt: number;
  expiresAt: number;
  warningMessage?: string;
}

export interface AnimeDetailResult {
  anime: NormalizedAnime | null;
  source: AniListDataSource;
  isStale: boolean;
  fetchedAt: number;
  expiresAt: number;
  warningMessage?: string;
}

export interface DiscoveryCategoryMeta {
  id: DiscoveryCategoryKey;
  label: string;
  eyebrow: string;
  description: string;
}

