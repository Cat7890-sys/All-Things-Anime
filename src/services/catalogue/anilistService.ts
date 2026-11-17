import type {
  AniListAiringStatus,
  AniListGraphQLResponse,
  AniListMediaFormat,
  AniListPageMediaData,
  AniListRawFuzzyDate,
  AniListRawMedia,
  AniListSeason,
  AniListSingleMediaData,
  AnimeDetailResult,
  DiscoveryCategoryKey,
  DiscoveryCategoryMeta,
  DiscoveryCategoryResult,
  NormalizedAnime,
  RecommendedAnimeSummary,
  RelatedAnimeSummary,
  SearchAnimeResult,
  SeasonInfo,
} from './anilistTypes';

export const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';
export const DEFAULT_DISCOVERY_PER_PAGE = 15;

export const DEFAULT_ANILIST_CACHE_TTLS_MS: Record<
  DiscoveryCategoryKey | 'detail' | 'search',
  number
> = {
  trending: 15 * 60 * 1000, // 15 minutes
  currently_airing: 30 * 60 * 1000, // 30 minutes
  upcoming: 60 * 60 * 1000, // 60 minutes
  seasonal: 60 * 60 * 1000, // 60 minutes
  popular: 6 * 60 * 60 * 1000, // 6 hours
  top_rated: 12 * 60 * 60 * 1000, // 12 hours
  detail: 6 * 60 * 60 * 1000, // 6 hours
  search: 10 * 60 * 1000, // 10 minutes
};

export const DISCOVERY_CATEGORIES_META: DiscoveryCategoryMeta[] = [
  {
    id: 'trending',
    label: 'Trending Now',
    eyebrow: 'Live Momentum',
    description: 'Series gaining the fastest community momentum right now.',
  },
  {
    id: 'seasonal',
    label: 'Seasonal',
    eyebrow: 'Current Cour',
    description: 'Featured series from the active anime broadcast season.',
  },
  {
    id: 'currently_airing',
    label: 'Currently Airing',
    eyebrow: 'On Air',
    description: 'Ongoing anime releasing new episodes week by week.',
  },
  {
    id: 'upcoming',
    label: 'Upcoming',
    eyebrow: 'Next Releases',
    description: 'Announced titles scheduled for upcoming broadcast seasons.',
  },
  {
    id: 'popular',
    label: 'Popular',
    eyebrow: 'All-Time Reach',
    description: 'Widely watched series across the global anime catalogue.',
  },
  {
    id: 'top_rated',
    label: 'Top Rated',
    eyebrow: 'Highest Rated',
    description: 'Critically acclaimed titles ranked by verified community scores.',
  },
];

export type AniListErrorCode =
  | 'OFFLINE'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'GRAPHQL_ERROR'
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE'
  | 'ABORTED';

export class AniListApiError extends Error {
  readonly code: AniListErrorCode;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(
    code: AniListErrorCode,
    message: string,
    options?: { status?: number; retryAfterMs?: number }
  ) {
    super(message);
    this.name = 'AniListApiError';
    this.code = code;
    this.status = options?.status;
    this.retryAfterMs = options?.retryAfterMs;
  }
}

const ANILIST_MEDIA_FIELDS_FRAGMENT = `
  fragment MediaDiscoveryFields on Media {
    id
    isAdult
    title {
      romaji
      english
      native
    }
    coverImage {
      extraLarge
      large
      color
    }
    bannerImage
    averageScore
    popularity
    trending
    episodes
    status
    season
    seasonYear
    startDate {
      year
      month
      day
    }
    format
    genres
    tags {
      name
      rank
      isGeneralSpoiler
      isMediaSpoiler
      isAdult
    }
    description(asHtml: false)
    siteUrl
    nextAiringEpisode {
      episode
      timeUntilAiring
      airingAt
    }
    studios(isMain: true) {
      nodes {
        name
        isAnimationStudio
      }
    }
    rankings {
      rank
      type
      allTime
      year
      season
      context
    }
  }
`;

const ANILIST_SUMMARY_FIELDS_FRAGMENT = `
  fragment MediaSummaryFields on Media {
    id
    type
    isAdult
    title {
      romaji
      english
      native
    }
    coverImage {
      extraLarge
      large
      color
    }
    averageScore
    popularity
    episodes
    status
    season
    seasonYear
    format
    genres
    siteUrl
    studios(isMain: true) {
      nodes {
        name
        isAnimationStudio
      }
    }
  }
`;

export const DISCOVER_CATEGORY_QUERY = `
  query DiscoverAnimeCategory(
    $page: Int = 1,
    $perPage: Int = 15,
    $sort: [MediaSort],
    $status: MediaStatus,
    $season: MediaSeason,
    $seasonYear: Int,
    $averageScoreGreater: Int,
    $isAdult: Boolean = false
  ) {
    Page(page: $page, perPage: $perPage) {
      media(
        type: ANIME,
        isAdult: $isAdult,
        sort: $sort,
        status: $status,
        season: $season,
        seasonYear: $seasonYear,
        averageScore_greater: $averageScoreGreater
      ) {
        ...MediaDiscoveryFields
      }
    }
  }
  ${ANILIST_MEDIA_FIELDS_FRAGMENT}
`;

export const SEARCH_ANIME_QUERY = `
  query SearchAnimeCatalogue(
    $search: String,
    $page: Int = 1,
    $perPage: Int = 15,
    $genreIn: [String],
    $formatIn: [MediaFormat],
    $sort: [MediaSort] = [SEARCH_MATCH, POPULARITY_DESC],
    $isAdult: Boolean = false
  ) {
    Page(page: $page, perPage: $perPage) {
      media(
        type: ANIME,
        isAdult: $isAdult,
        search: $search,
        genre_in: $genreIn,
        format_in: $formatIn,
        sort: $sort
      ) {
        ...MediaDiscoveryFields
      }
    }
  }
  ${ANILIST_MEDIA_FIELDS_FRAGMENT}
`;

export const DISCOVER_ANIME_BY_ID_QUERY = `
  query DiscoverAnimeById($id: Int!, $isAdult: Boolean = false) {
    Media(id: $id, type: ANIME, isAdult: $isAdult) {
      ...MediaDiscoveryFields
      relations {
        edges {
          relationType(version: 2)
          node {
            ...MediaSummaryFields
          }
        }
      }
      recommendations(sort: [RATING_DESC, ID], perPage: 8) {
        nodes {
          rating
          mediaRecommendation {
            ...MediaSummaryFields
          }
        }
      }
    }
  }
  ${ANILIST_MEDIA_FIELDS_FRAGMENT}
  ${ANILIST_SUMMARY_FIELDS_FRAGMENT}
`;

const SEASON_DISPLAY_NAMES: Record<AniListSeason, string> = {
  WINTER: 'Winter',
  SPRING: 'Spring',
  SUMMER: 'Summer',
  FALL: 'Fall',
};

/**
 * Calculates the active AniList season and year from a calendar date.
 *
 * Mapping:
 * - December, January, February -> WINTER
 * - March, April, May -> SPRING
 * - June, July, August -> SUMMER
 * - September, October, November -> FALL
 *
 * December belongs to the upcoming Winter broadcast cycle (year + 1) so
 * December, January, and February resolve continuously to the same Winter year
 * without jumping backward or splitting across New Year's Eve.
 */
export function getCurrentAnimeSeason(date: Date = new Date()): SeasonInfo {
  const month = date.getMonth(); // 0-11
  const calendarYear = date.getFullYear();

  let season: AniListSeason;
  let seasonYear = calendarYear;

  if (month === 11) {
    season = 'WINTER';
    seasonYear = calendarYear + 1;
  } else if (month === 0 || month === 1) {
    season = 'WINTER';
    seasonYear = calendarYear;
  } else if (month >= 2 && month <= 4) {
    season = 'SPRING';
  } else if (month >= 5 && month <= 7) {
    season = 'SUMMER';
  } else {
    season = 'FALL';
  }

  const label = `${SEASON_DISPLAY_NAMES[season]} ${seasonYear}`;
  return {
    season,
    seasonYear,
    label,
    key: `${season}_${seasonYear}`,
  };
}

const VALID_SEASONS = new Set<AniListSeason>([
  'WINTER',
  'SPRING',
  'SUMMER',
  'FALL',
]);

const VALID_STATUSES = new Set<AniListAiringStatus>([
  'FINISHED',
  'RELEASING',
  'NOT_YET_RELEASED',
  'CANCELLED',
  'HIATUS',
]);

const VALID_FORMATS = new Set<AniListMediaFormat>([
  'TV',
  'TV_SHORT',
  'MOVIE',
  'SPECIAL',
  'OVA',
  'ONA',
  'MUSIC',
]);

const STATUS_LABELS: Record<AniListAiringStatus | 'UNKNOWN', string> = {
  RELEASING: 'Currently Airing',
  NOT_YET_RELEASED: 'Upcoming',
  FINISHED: 'Completed',
  HIATUS: 'On Hiatus',
  CANCELLED: 'Cancelled',
  UNKNOWN: 'Status TBA',
};

const FORMAT_LABELS: Record<AniListMediaFormat | 'UNKNOWN', string> = {
  TV: 'TV Series',
  TV_SHORT: 'TV Short',
  MOVIE: 'Movie',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Music',
  UNKNOWN: 'Anime',
};

const MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function sanitizeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function cleanTextField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '...',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, code) => {
    const lower = String(code).toLowerCase();
    if (lower in NAMED_HTML_ENTITIES) {
      return NAMED_HTML_ENTITIES[lower];
    }
    if (lower.startsWith('#x')) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    if (lower.startsWith('#')) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return match;
  });
}

export function sanitizeAniListDescription(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withLineBreaks = trimmed
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');

  const decoded = decodeHtmlEntities(withLineBreaks)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return decoded.length > 0 ? decoded : null;
}

export function formatFuzzyDate(
  date: AniListRawFuzzyDate | null | undefined
): string | null {
  if (!date) return null;
  const year = typeof date.year === 'number' && date.year > 0 ? date.year : null;
  const month =
    typeof date.month === 'number' && date.month >= 1 && date.month <= 12
      ? date.month
      : null;
  const day =
    typeof date.day === 'number' && date.day >= 1 && date.day <= 31
      ? date.day
      : null;

  if (!year && !month && !day) return null;
  if (year && month && day) {
    return `${MONTH_SHORT_NAMES[month - 1]} ${day}, ${year}`;
  }
  if (year && month) {
    return `${MONTH_SHORT_NAMES[month - 1]} ${year}`;
  }
  if (year) {
    return String(year);
  }
  return null;
}

export function formatTimeUntilAiring(secondsUntilAiring: number): string {
  if (!Number.isFinite(secondsUntilAiring) || secondsUntilAiring <= 0) {
    return 'Airing soon';
  }
  const totalMinutes = Math.floor(secondsUntilAiring / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${Math.max(1, minutes)}m`;
}

export function formatAnimeEpisodes(
  episodes: number | null,
  status: AniListAiringStatus | 'UNKNOWN'
): string {
  if (typeof episodes === 'number' && episodes > 0) {
    return episodes === 1 ? '1 Ep' : `${episodes} Eps`;
  }
  if (status === 'RELEASING') return 'Ongoing';
  return 'Eps TBA';
}

export function normalizeAniListMedia(
  raw: AniListRawMedia | null | undefined,
  options?: { listTrendingPosition?: number }
): NormalizedAnime | null {
  if (!raw || typeof raw.id !== 'number' || !Number.isFinite(raw.id)) {
    return null;
  }

  // Defensive adult-content exclusion: require explicit isAdult === false
  if (raw.isAdult !== false) {
    return null;
  }

  const english = cleanTextField(raw.title?.english);
  const romaji = cleanTextField(raw.title?.romaji);
  const native = cleanTextField(raw.title?.native);
  const displayTitle = english || romaji || native || 'Untitled Anime';

  const extraLargeCover = sanitizeHttpsUrl(raw.coverImage?.extraLarge);
  const largeCover = sanitizeHttpsUrl(raw.coverImage?.large);
  const bestCover = extraLargeCover || largeCover || null;
  const coverColor =
    typeof raw.coverImage?.color === 'string' &&
    /^#[0-9a-fA-F]{3,8}$/.test(raw.coverImage.color.trim())
      ? raw.coverImage.color.trim()
      : null;

  const status: AniListAiringStatus | 'UNKNOWN' =
    typeof raw.status === 'string' &&
    VALID_STATUSES.has(raw.status as AniListAiringStatus)
      ? (raw.status as AniListAiringStatus)
      : 'UNKNOWN';

  const format: AniListMediaFormat | 'UNKNOWN' =
    typeof raw.format === 'string' &&
    VALID_FORMATS.has(raw.format as AniListMediaFormat)
      ? (raw.format as AniListMediaFormat)
      : 'UNKNOWN';

  const season: AniListSeason | null =
    typeof raw.season === 'string' &&
    VALID_SEASONS.has(raw.season as AniListSeason)
      ? (raw.season as AniListSeason)
      : null;

  const seasonYear =
    typeof raw.seasonYear === 'number' &&
    Number.isFinite(raw.seasonYear) &&
    raw.seasonYear > 1900
      ? raw.seasonYear
      : null;

  const seasonLabel =
    season && seasonYear
      ? `${SEASON_DISPLAY_NAMES[season]} ${seasonYear}`
      : season
        ? SEASON_DISPLAY_NAMES[season]
        : seasonYear
          ? String(seasonYear)
          : null;

  const averageScore =
    typeof raw.averageScore === 'number' &&
    Number.isFinite(raw.averageScore) &&
    raw.averageScore > 0
      ? Math.round(raw.averageScore)
      : null;

  const episodes =
    typeof raw.episodes === 'number' &&
    Number.isFinite(raw.episodes) &&
    raw.episodes > 0
      ? raw.episodes
      : null;

  const trending =
    typeof raw.trending === 'number' &&
    Number.isFinite(raw.trending) &&
    raw.trending >= 0
      ? raw.trending
      : null;

  const popularity =
    typeof raw.popularity === 'number' &&
    Number.isFinite(raw.popularity) &&
    raw.popularity >= 0
      ? raw.popularity
      : null;

  const genres = Array.isArray(raw.genres)
    ? raw.genres
        .filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
        .map((g) => g.trim())
    : [];

  const studios = Array.isArray(raw.studios?.nodes)
    ? raw.studios.nodes
        .filter(
          (node): node is { name: string; isAnimationStudio?: boolean | null } =>
            Boolean(node && typeof node.name === 'string' && node.name.trim())
        )
        .map((node) => node.name.trim())
    : [];

  const uniqueStudios = Array.from(new Set(studios));

  const nextAiringEpisode =
    raw.nextAiringEpisode &&
    typeof raw.nextAiringEpisode.episode === 'number' &&
    typeof raw.nextAiringEpisode.timeUntilAiring === 'number' &&
    typeof raw.nextAiringEpisode.airingAt === 'number'
      ? {
          episode: raw.nextAiringEpisode.episode,
          timeUntilAiring: raw.nextAiringEpisode.timeUntilAiring,
          airingAt: raw.nextAiringEpisode.airingAt,
        }
      : null;

  let trendingRank: number | null =
    typeof options?.listTrendingPosition === 'number' &&
    options.listTrendingPosition > 0
      ? options.listTrendingPosition
      : null;

  if (trendingRank === null && Array.isArray(raw.rankings)) {
    const popularOrTrendingRank = raw.rankings.find(
      (r) =>
        r &&
        typeof r.rank === 'number' &&
        r.rank > 0 &&
        (r.type === 'TRENDING' ||
          (r.context || '').toLowerCase().includes('trending'))
    );
    if (popularOrTrendingRank && typeof popularOrTrendingRank.rank === 'number') {
      trendingRank = popularOrTrendingRank.rank;
    }
  }

  const startDate = {
    year:
      typeof raw.startDate?.year === 'number' && raw.startDate.year > 0
        ? raw.startDate.year
        : null,
    month:
      typeof raw.startDate?.month === 'number' &&
      raw.startDate.month >= 1 &&
      raw.startDate.month <= 12
        ? raw.startDate.month
        : null,
    day:
      typeof raw.startDate?.day === 'number' &&
      raw.startDate.day >= 1 &&
      raw.startDate.day <= 31
        ? raw.startDate.day
        : null,
    formatted: formatFuzzyDate(raw.startDate),
  };

  const safeSiteUrl =
    sanitizeHttpsUrl(raw.siteUrl) || `https://anilist.co/anime/${raw.id}`;

  const tags = Array.isArray(raw.tags)
    ? Array.from(
        new Set(
          raw.tags
            .filter(
              (t): t is { name: string; isAdult?: boolean | null; isGeneralSpoiler?: boolean | null; isMediaSpoiler?: boolean | null; rank?: number | null } =>
                Boolean(
                  t &&
                    typeof t.name === 'string' &&
                    t.name.trim().length > 0 &&
                    t.isAdult !== true &&
                    t.isGeneralSpoiler !== true &&
                    t.isMediaSpoiler !== true &&
                    (typeof t.rank !== 'number' || t.rank >= 45)
                )
            )
            .map((t) => t.name.trim())
        )
      ).slice(0, 10)
    : undefined;

  const seenRelatedIds = new Set<number>([raw.id]);
  const relations: RelatedAnimeSummary[] | undefined = Array.isArray(
    raw.relations?.edges
  )
    ? raw.relations.edges
        .map((edge): RelatedAnimeSummary | null => {
          if (!edge?.node) return null;
          const nodeType = (edge.node as AniListRawMedia & { type?: string | null }).type;
          if (nodeType && nodeType !== 'ANIME') return null;
          const normalizedChild = normalizeAniListMedia(edge.node);
          if (!normalizedChild || seenRelatedIds.has(normalizedChild.id)) {
            return null;
          }
          seenRelatedIds.add(normalizedChild.id);
          return {
            relationType:
              typeof edge.relationType === 'string' && edge.relationType.trim()
                ? edge.relationType.replace(/_/g, ' ')
                : 'RELATED',
            anime: normalizedChild,
          };
        })
        .filter((item): item is RelatedAnimeSummary => item !== null)
    : undefined;

  const seenRecIds = new Set<number>([raw.id]);
  const recommendations: RecommendedAnimeSummary[] | undefined = Array.isArray(
    raw.recommendations?.nodes
  )
    ? raw.recommendations.nodes
        .map((node): RecommendedAnimeSummary | null => {
          if (!node?.mediaRecommendation) return null;
          const nodeType = (
            node.mediaRecommendation as AniListRawMedia & { type?: string | null }
          ).type;
          if (nodeType && nodeType !== 'ANIME') return null;
          const normalizedRec = normalizeAniListMedia(node.mediaRecommendation);
          if (!normalizedRec || seenRecIds.has(normalizedRec.id)) {
            return null;
          }
          seenRecIds.add(normalizedRec.id);
          return {
            rating: typeof node.rating === 'number' ? node.rating : 0,
            anime: normalizedRec,
          };
        })
        .filter((item): item is RecommendedAnimeSummary => item !== null)
    : undefined;

  return {
    id: raw.id,
    title: {
      english,
      romaji,
      native,
      display: displayTitle,
    },
    coverImage: {
      extraLarge: extraLargeCover,
      large: largeCover,
      best: bestCover,
      color: coverColor,
    },
    bannerImage: sanitizeHttpsUrl(raw.bannerImage),
    averageScore,
    popularity,
    trending,
    trendingRank,
    episodes,
    status,
    statusLabel: STATUS_LABELS[status],
    season,
    seasonYear,
    seasonLabel,
    startDate,
    format,
    formatLabel: FORMAT_LABELS[format],
    genres,
    ...(tags && tags.length > 0 ? { tags } : {}),
    description: sanitizeAniListDescription(raw.description),
    nextAiringEpisode,
    studios: uniqueStudios,
    siteUrl: safeSiteUrl,
    ...(relations && relations.length > 0 ? { relations } : {}),
    ...(recommendations && recommendations.length > 0
      ? { recommendations }
      : {}),
    isAdult: false,
  };
}

export function parseAniListNumericId(animeId: string | number): number | null {
  if (typeof animeId === 'number') {
    return Number.isInteger(animeId) && animeId > 0 ? animeId : null;
  }
  const trimmed = String(animeId || '').trim();
  if (!trimmed) return null;
  const direct = /^\d+$/.test(trimmed) ? Number(trimmed) : null;
  if (direct && Number.isInteger(direct) && direct > 0) return direct;
  const prefixed = /^anilist-(\d+)$/i.exec(trimmed);
  if (prefixed) {
    const n = Number(prefixed[1]);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface CacheEnvelope<T> {
  version: 1;
  fetchedAt: number;
  expiresAt: number;
  seasonKey?: string;
  data: T;
}

export interface AniListClientConfig {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  storage?: StorageLike | null;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  isOnline?: () => boolean;
  ttls?: Partial<Record<DiscoveryCategoryKey | 'detail' | 'search', number>>;
  minRequestIntervalMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

export interface GetCategoryOptions {
  perPage?: number;
  forceRefresh?: boolean;
  signal?: AbortSignal;
  date?: Date;
}

export interface SearchAnimeOptions {
  perPage?: number;
  genres?: string[];
  formats?: AniListMediaFormat[];
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

export interface GetAnimeDetailOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

const CACHE_KEY_PREFIX = 'ata:anilist:v1:';

function getBrowserStorageSafe(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  if (signal?.aborted) {
    return Promise.reject(new AniListApiError('ABORTED', 'Request cancelled.'));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AniListApiError('ABORTED', 'Request cancelled.'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function awaitWithAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new AniListApiError('ABORTED', 'Request cancelled.'));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new AniListApiError('ABORTED', 'Request cancelled.'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

function parseRetryAfterMs(headerValue: string | null, nowMs: number): number | undefined {
  if (!headerValue) return undefined;
  const trimmed = headerValue.trim();
  if (!trimmed) return undefined;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 15_000);
  }
  const timestamp = Date.parse(trimmed);
  if (Number.isFinite(timestamp)) {
    return Math.min(Math.max(0, timestamp - nowMs), 15_000);
  }
  return undefined;
}

export function buildCategoryVariables(
  category: DiscoveryCategoryKey,
  options: { perPage: number; seasonInfo?: SeasonInfo }
): Record<string, unknown> {
  const base = {
    page: 1,
    perPage: options.perPage,
    isAdult: false,
  };

  switch (category) {
    case 'trending':
      return {
        ...base,
        sort: ['TRENDING_DESC', 'POPULARITY_DESC'],
      };
    case 'popular':
      return {
        ...base,
        sort: ['POPULARITY_DESC'],
      };
    case 'currently_airing':
      return {
        ...base,
        status: 'RELEASING',
        sort: ['POPULARITY_DESC'],
      };
    case 'upcoming':
      return {
        ...base,
        status: 'NOT_YET_RELEASED',
        sort: ['POPULARITY_DESC'],
      };
    case 'top_rated':
      return {
        ...base,
        sort: ['SCORE_DESC'],
        averageScoreGreater: 1,
      };
    case 'seasonal': {
      const seasonInfo = options.seasonInfo ?? getCurrentAnimeSeason();
      return {
        ...base,
        season: seasonInfo.season,
        seasonYear: seasonInfo.seasonYear,
        sort: ['POPULARITY_DESC'],
      };
    }
  }
}

export function createAniListClient(config: AniListClientConfig = {}) {
  const endpoint = config.endpoint ?? ANILIST_GRAPHQL_ENDPOINT;
  const fetchImpl =
    config.fetchImpl ??
    ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const storage =
    config.storage === undefined ? getBrowserStorageSafe() : config.storage;
  const now = config.now ?? (() => Date.now());
  const sleep = config.sleep ?? defaultSleep;
  const isOnline =
    config.isOnline ??
    (() =>
      typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
        ? navigator.onLine
        : true);
  const ttls: Record<DiscoveryCategoryKey | 'detail' | 'search', number> = {
    ...DEFAULT_ANILIST_CACHE_TTLS_MS,
    ...(config.ttls ?? {}),
  };
  const minRequestIntervalMs = config.minRequestIntervalMs ?? 120;
  const maxRetries = config.maxRetries ?? 2;
  const retryBaseDelayMs = config.retryBaseDelayMs ?? 600;

  const memoryCache = new Map<string, CacheEnvelope<unknown>>();
  const inFlightRequests = new Map<string, Promise<unknown>>();
  let throttleQueue: Promise<void> = Promise.resolve();
  let lastNetworkAttemptAt = 0;

  function readCache<T>(
    key: string,
    validate: (data: unknown) => T | null
  ): { envelope: CacheEnvelope<T>; isExpired: boolean } | null {
    const currentNow = now();
    let candidate: unknown = memoryCache.get(key);

    if (!candidate && storage) {
      try {
        const raw = storage.getItem(key);
        if (raw) {
          candidate = JSON.parse(raw);
        }
      } catch {
        try {
          storage.removeItem(key);
        } catch {
          // Ignore storage cleanup failures
        }
        return null;
      }
    }

    if (!candidate || typeof candidate !== 'object') {
      return null;
    }

    const env = candidate as Partial<CacheEnvelope<unknown>>;
    if (
      env.version !== 1 ||
      typeof env.fetchedAt !== 'number' ||
      typeof env.expiresAt !== 'number'
    ) {
      return null;
    }

    const validatedData = validate(env.data);
    if (validatedData === null) {
      return null;
    }

    const normalizedEnvelope: CacheEnvelope<T> = {
      version: 1,
      fetchedAt: env.fetchedAt,
      expiresAt: env.expiresAt,
      seasonKey: typeof env.seasonKey === 'string' ? env.seasonKey : undefined,
      data: validatedData,
    };

    memoryCache.set(key, normalizedEnvelope);
    return {
      envelope: normalizedEnvelope,
      isExpired: currentNow >= normalizedEnvelope.expiresAt,
    };
  }

  function writeCache<T>(
    key: string,
    data: T,
    ttlMs: number,
    seasonKey?: string
  ): CacheEnvelope<T> {
    const fetchedAt = now();
    const envelope: CacheEnvelope<T> = {
      version: 1,
      fetchedAt,
      expiresAt: fetchedAt + Math.max(0, ttlMs),
      ...(seasonKey ? { seasonKey } : {}),
      data,
    };
    memoryCache.set(key, envelope);
    if (storage) {
      try {
        storage.setItem(key, JSON.stringify(envelope));
      } catch {
        // Ignore storage quota / private mode failures; memory cache still works
      }
    }
    return envelope;
  }

  async function waitForThrottleSlot(): Promise<void> {
    if (minRequestIntervalMs <= 0) return;
    const previous = throttleQueue;
    let release!: () => void;
    throttleQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const elapsed = now() - lastNetworkAttemptAt;
      if (lastNetworkAttemptAt > 0 && elapsed < minRequestIntervalMs) {
        await sleep(minRequestIntervalMs - elapsed);
      }
      lastNetworkAttemptAt = now();
    } finally {
      release();
    }
  }

  async function executeGraphQL<TData>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<TData> {
    let attempt = 0;

    while (true) {
      await waitForThrottleSlot();

      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        });
      } catch (error) {
        if (error instanceof AniListApiError) throw error;
        if (attempt < maxRetries) {
          const delayMs = retryBaseDelayMs * Math.pow(2, attempt);
          attempt += 1;
          await sleep(delayMs);
          continue;
        }
        throw new AniListApiError(
          'NETWORK_ERROR',
          'Unable to reach AniList right now. Please check your connection and try again.'
        );
      }

      if (response.status === 429) {
        const retryAfterMs = parseRetryAfterMs(
          response.headers.get('Retry-After'),
          now()
        );
        if (attempt < maxRetries) {
          const backoffMs =
            retryAfterMs ?? retryBaseDelayMs * Math.pow(2, attempt);
          attempt += 1;
          await sleep(backoffMs);
          continue;
        }
        throw new AniListApiError(
          'RATE_LIMITED',
          'AniList is temporarily rate-limiting requests. Please wait a moment and try again.',
          { status: 429, retryAfterMs }
        );
      }

      if (response.status >= 500) {
        if (attempt < maxRetries) {
          const backoffMs = retryBaseDelayMs * Math.pow(2, attempt);
          attempt += 1;
          await sleep(backoffMs);
          continue;
        }
        throw new AniListApiError(
          'HTTP_ERROR',
          'AniList is temporarily unavailable. Please try again shortly.',
          { status: response.status }
        );
      }

      let payload: AniListGraphQLResponse<TData>;
      try {
        payload = (await response.json()) as AniListGraphQLResponse<TData>;
      } catch {
        throw new AniListApiError(
          'INVALID_RESPONSE',
          'Received an unexpected response from AniList.',
          { status: response.status }
        );
      }

      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        throw new AniListApiError(
          'GRAPHQL_ERROR',
          'AniList could not complete this catalogue query. Please try again.',
          { status: response.status }
        );
      }

      if (!response.ok || !payload.data) {
        throw new AniListApiError(
          'HTTP_ERROR',
          'Unable to load anime data from AniList right now.',
          { status: response.status }
        );
      }

      return payload.data;
    }
  }

  function deduplicate<T>(
    flightKey: string,
    runner: () => Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    let shared = inFlightRequests.get(flightKey) as Promise<T> | undefined;
    if (!shared) {
      shared = runner().finally(() => {
        if (inFlightRequests.get(flightKey) === shared) {
          inFlightRequests.delete(flightKey);
        }
      });
      inFlightRequests.set(flightKey, shared);
    }
    return awaitWithAbort(shared, signal);
  }

  function validateCachedAnimeList(raw: unknown): NormalizedAnime[] | null {
    if (!Array.isArray(raw)) return null;
    const validItems = raw.filter(
      (item): item is NormalizedAnime =>
        Boolean(
          item &&
            typeof item === 'object' &&
            typeof (item as NormalizedAnime).id === 'number' &&
            (item as NormalizedAnime).isAdult === false &&
            (item as NormalizedAnime).title &&
            typeof (item as NormalizedAnime).title.display === 'string'
        )
    );
    return validItems;
  }

  function validateCachedAnimeDetail(raw: unknown): NormalizedAnime | null {
    if (!raw || typeof raw !== 'object') return null;
    const candidate = raw as NormalizedAnime;
    if (
      typeof candidate.id !== 'number' ||
      candidate.isAdult !== false ||
      !candidate.title ||
      typeof candidate.title.display !== 'string'
    ) {
      return null;
    }
    return candidate;
  }

  async function getCategory(
    category: DiscoveryCategoryKey,
    options: GetCategoryOptions = {}
  ): Promise<DiscoveryCategoryResult> {
    if (options.signal?.aborted) {
      throw new AniListApiError('ABORTED', 'Request cancelled.');
    }

    const perPage = Math.max(1, Math.min(25, options.perPage ?? DEFAULT_DISCOVERY_PER_PAGE));
    const seasonInfo =
      category === 'seasonal'
        ? getCurrentAnimeSeason(options.date)
        : undefined;

    const cacheKey =
      category === 'seasonal' && seasonInfo
        ? `${CACHE_KEY_PREFIX}category:${category}:${seasonInfo.key}:perPage=${perPage}`
        : `${CACHE_KEY_PREFIX}category:${category}:perPage=${perPage}`;

    const cached = readCache<NormalizedAnime[]>(cacheKey, validateCachedAnimeList);

    if (!options.forceRefresh && cached && !cached.isExpired) {
      return {
        category,
        items: cached.envelope.data,
        ...(seasonInfo ? { seasonInfo } : {}),
        source: 'cache',
        isStale: false,
        fetchedAt: cached.envelope.fetchedAt,
        expiresAt: cached.envelope.expiresAt,
      };
    }

    if (!isOnline()) {
      if (cached) {
        return {
          category,
          items: cached.envelope.data,
          ...(seasonInfo ? { seasonInfo } : {}),
          source: 'stale-cache',
          isStale: true,
          fetchedAt: cached.envelope.fetchedAt,
          expiresAt: cached.envelope.expiresAt,
          warningMessage:
            'You are currently offline. Showing previously cached AniList data.',
        };
      }
      throw new AniListApiError(
        'OFFLINE',
        'You are currently offline and no cached AniList data is available for this category.'
      );
    }

    const flightKey = options.forceRefresh ? `${cacheKey}:refresh` : cacheKey;

    try {
      const envelope = await deduplicate(
        flightKey,
        async () => {
          const variables = buildCategoryVariables(category, {
            perPage,
            seasonInfo,
          });
          const data = await executeGraphQL<AniListPageMediaData>(
            DISCOVER_CATEGORY_QUERY,
            variables
          );

          const rawList = data.Page?.media ?? [];
          const normalized = rawList
            .map((rawItem, idx) =>
              normalizeAniListMedia(rawItem, {
                listTrendingPosition:
                  category === 'trending' ? idx + 1 : undefined,
              })
            )
            .filter((item): item is NormalizedAnime => {
              if (!item) return false;
              if (category === 'top_rated') {
                return item.averageScore !== null && item.averageScore > 0;
              }
              return true;
            });

          return writeCache(
            cacheKey,
            normalized,
            ttls[category],
            seasonInfo?.key
          );
        },
        options.signal
      );

      return {
        category,
        items: envelope.data,
        ...(seasonInfo ? { seasonInfo } : {}),
        source: 'network',
        isStale: false,
        fetchedAt: envelope.fetchedAt,
        expiresAt: envelope.expiresAt,
      };
    } catch (error) {
      if (error instanceof AniListApiError && error.code === 'ABORTED') {
        throw error;
      }
      if (cached) {
        return {
          category,
          items: cached.envelope.data,
          ...(seasonInfo ? { seasonInfo } : {}),
          source: 'stale-cache',
          isStale: true,
          fetchedAt: cached.envelope.fetchedAt,
          expiresAt: cached.envelope.expiresAt,
          warningMessage:
            'Unable to refresh live AniList data right now. Showing previously cached entries.',
        };
      }
      throw error instanceof AniListApiError
        ? error
        : new AniListApiError(
            'NETWORK_ERROR',
            'Unable to load anime data from AniList right now.'
          );
    }
  }

  async function getAnimeById(
    animeId: number,
    options: GetAnimeDetailOptions = {}
  ): Promise<AnimeDetailResult> {
    if (options.signal?.aborted) {
      throw new AniListApiError('ABORTED', 'Request cancelled.');
    }

    if (!Number.isInteger(animeId) || animeId <= 0) {
      return {
        anime: null,
        source: 'cache',
        isStale: false,
        fetchedAt: now(),
        expiresAt: now(),
      };
    }

    const cacheKey = `${CACHE_KEY_PREFIX}detail:${animeId}`;
    const cached = readCache<NormalizedAnime>(
      cacheKey,
      validateCachedAnimeDetail
    );

    if (!options.forceRefresh && cached && !cached.isExpired) {
      return {
        anime: cached.envelope.data,
        source: 'cache',
        isStale: false,
        fetchedAt: cached.envelope.fetchedAt,
        expiresAt: cached.envelope.expiresAt,
      };
    }

    if (!isOnline()) {
      if (cached) {
        return {
          anime: cached.envelope.data,
          source: 'stale-cache',
          isStale: true,
          fetchedAt: cached.envelope.fetchedAt,
          expiresAt: cached.envelope.expiresAt,
          warningMessage:
            'You are offline. Showing cached anime details.',
        };
      }
      throw new AniListApiError(
        'OFFLINE',
        'You are offline and this anime title has not been cached.'
      );
    }

    const flightKey = options.forceRefresh ? `${cacheKey}:refresh` : cacheKey;

    try {
      const envelope = await deduplicate(
        flightKey,
        async () => {
          const data = await executeGraphQL<AniListSingleMediaData>(
            DISCOVER_ANIME_BY_ID_QUERY,
            { id: animeId, isAdult: false }
          );
          const normalized = normalizeAniListMedia(data.Media);
          if (!normalized) {
            return null;
          }
          return writeCache(cacheKey, normalized, ttls.detail);
        },
        options.signal
      );

      if (!envelope) {
        return {
          anime: null,
          source: 'network',
          isStale: false,
          fetchedAt: now(),
          expiresAt: now(),
        };
      }

      return {
        anime: envelope.data,
        source: 'network',
        isStale: false,
        fetchedAt: envelope.fetchedAt,
        expiresAt: envelope.expiresAt,
      };
    } catch (error) {
      if (error instanceof AniListApiError && error.code === 'ABORTED') {
        throw error;
      }
      if (cached) {
        return {
          anime: cached.envelope.data,
          source: 'stale-cache',
          isStale: true,
          fetchedAt: cached.envelope.fetchedAt,
          expiresAt: cached.envelope.expiresAt,
          warningMessage:
            'Unable to refresh anime details. Showing cached information.',
        };
      }
      throw error instanceof AniListApiError
        ? error
        : new AniListApiError(
            'NETWORK_ERROR',
            'Unable to load anime details from AniList right now.'
          );
    }
  }

  async function searchAnime(
    queryText: string,
    options: SearchAnimeOptions = {}
  ): Promise<SearchAnimeResult> {
    if (options.signal?.aborted) {
      throw new AniListApiError('ABORTED', 'Request cancelled.');
    }

    const trimmedQuery = queryText.trim();
    const genres = (options.genres || []).map((g) => g.trim()).filter(Boolean);
    const formats = (options.formats || []).filter(Boolean);
    const perPage = Math.max(1, Math.min(25, options.perPage ?? 12));

    if (!trimmedQuery && genres.length === 0 && formats.length === 0) {
      const fallbackPopular = await getCategory('popular', {
        perPage,
        signal: options.signal,
      });
      return {
        query: '',
        items: fallbackPopular.items,
        source: fallbackPopular.source,
        isStale: fallbackPopular.isStale,
        fetchedAt: fallbackPopular.fetchedAt,
        expiresAt: fallbackPopular.expiresAt,
        warningMessage: fallbackPopular.warningMessage,
      };
    }

    const cacheKey = `${CACHE_KEY_PREFIX}search:q=${trimmedQuery.toLowerCase()}:g=${genres
      .slice()
      .sort()
      .join(',')}:f=${formats.slice().sort().join(',')}:perPage=${perPage}`;

    const cached = readCache<NormalizedAnime[]>(cacheKey, validateCachedAnimeList);

    if (!options.forceRefresh && cached && !cached.isExpired) {
      return {
        query: trimmedQuery,
        items: cached.envelope.data,
        source: 'cache',
        isStale: false,
        fetchedAt: cached.envelope.fetchedAt,
        expiresAt: cached.envelope.expiresAt,
      };
    }

    if (!isOnline()) {
      if (cached) {
        return {
          query: trimmedQuery,
          items: cached.envelope.data,
          source: 'stale-cache',
          isStale: true,
          fetchedAt: cached.envelope.fetchedAt,
          expiresAt: cached.envelope.expiresAt,
          warningMessage:
            'You are currently offline. Showing cached AniList search results.',
        };
      }
      throw new AniListApiError(
        'OFFLINE',
        'You are offline and this anime search is not cached.'
      );
    }

    const flightKey = options.forceRefresh ? `${cacheKey}:refresh` : cacheKey;

    try {
      const envelope = await deduplicate(
        flightKey,
        async () => {
          const variables: Record<string, unknown> = {
            page: 1,
            perPage,
            isAdult: false,
            sort: trimmedQuery
              ? ['SEARCH_MATCH', 'POPULARITY_DESC']
              : ['POPULARITY_DESC'],
          };
          if (trimmedQuery) variables.search = trimmedQuery;
          if (genres.length > 0) variables.genreIn = genres;
          if (formats.length > 0) variables.formatIn = formats;

          const data = await executeGraphQL<AniListPageMediaData>(
            SEARCH_ANIME_QUERY,
            variables
          );

          const normalized = (data.Page?.media ?? [])
            .map((rawItem) => normalizeAniListMedia(rawItem))
            .filter((item): item is NormalizedAnime => item !== null);

          return writeCache(cacheKey, normalized, ttls.search);
        },
        options.signal
      );

      return {
        query: trimmedQuery,
        items: envelope.data,
        source: 'network',
        isStale: false,
        fetchedAt: envelope.fetchedAt,
        expiresAt: envelope.expiresAt,
      };
    } catch (error) {
      if (error instanceof AniListApiError && error.code === 'ABORTED') {
        throw error;
      }
      if (cached) {
        return {
          query: trimmedQuery,
          items: cached.envelope.data,
          source: 'stale-cache',
          isStale: true,
          fetchedAt: cached.envelope.fetchedAt,
          expiresAt: cached.envelope.expiresAt,
          warningMessage:
            'Unable to reach AniList right now. Showing previously cached search results.',
        };
      }
      throw error instanceof AniListApiError
        ? error
        : new AniListApiError(
            'NETWORK_ERROR',
            'Unable to search anime on AniList right now.'
          );
    }
  }

  function clearCache(): void {
    memoryCache.clear();
    if (!storage) return;
    try {
      const keysToRemove: string[] = [];
      const maybeStorage = storage as StorageLike & {
        length?: number;
        key?: (index: number) => string | null;
      };
      if (typeof maybeStorage.length === 'number' && typeof maybeStorage.key === 'function') {
        for (let i = 0; i < maybeStorage.length; i += 1) {
          const k = maybeStorage.key(i);
          if (k && k.startsWith(CACHE_KEY_PREFIX)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => storage.removeItem(k));
      }
    } catch {
      // Ignore storage errors
    }
  }

  return {
    getCategory,
    getAnimeById,
    searchAnime,
    clearCache,
  };
}

export const anilistService = createAniListClient();
