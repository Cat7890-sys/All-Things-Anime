import assert from 'node:assert/strict';
import {
  ANILIST_GRAPHQL_ENDPOINT,
  AniListApiError,
  buildCategoryVariables,
  createAniListClient,
  formatAnimeEpisodes,
  formatTimeUntilAiring,
  getCurrentAnimeSeason,
  normalizeAniListMedia,
  sanitizeAniListDescription,
  sanitizeHttpsUrl,
  type StorageLike,
} from './anilistService.ts';
import type { AniListRawMedia } from './anilistTypes.ts';

function createMemoryStorage(): StorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

function makeRawMedia(
  overrides: Partial<AniListRawMedia> = {}
): AniListRawMedia {
  return {
    id: 154587,
    isAdult: false,
    title: {
      english: "Frieren: Beyond Journey's End",
      romaji: 'Sousou no Frieren',
      native: '葬送のフリーレン',
    },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587.jpg',
      large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx154587.jpg',
      color: '#e4a15d',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587.jpg',
    averageScore: 91,
    popularity: 420000,
    trending: 88,
    episodes: 28,
    status: 'FINISHED',
    season: 'FALL',
    seasonYear: 2023,
    startDate: { year: 2023, month: 9, day: 29 },
    format: 'TV',
    genres: ['Adventure', 'Drama', 'Fantasy'],
    description: 'An elven mage reflects on mortality.<br><br><i>New journey &amp; hope.</i>',
    siteUrl: 'https://anilist.co/anime/154587',
    nextAiringEpisode: null,
    studios: {
      nodes: [{ name: 'Madhouse', isAnimationStudio: true }],
    },
    rankings: [{ rank: 1, type: 'RATED', allTime: true, context: 'highest rated' }],
    ...overrides,
  };
}

async function runTests() {
  // 1. Season mapping across all 12 months + Dec/Jan boundary
  const monthExpectations: Array<[number, number, 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL', number]> = [
    [2026, 0, 'WINTER', 2026],
    [2026, 1, 'WINTER', 2026],
    [2026, 2, 'SPRING', 2026],
    [2026, 3, 'SPRING', 2026],
    [2026, 4, 'SPRING', 2026],
    [2026, 5, 'SUMMER', 2026],
    [2026, 6, 'SUMMER', 2026],
    [2026, 7, 'SUMMER', 2026],
    [2026, 8, 'FALL', 2026],
    [2026, 9, 'FALL', 2026],
    [2026, 10, 'FALL', 2026],
    [2026, 11, 'WINTER', 2027],
  ];

  for (const [year, month, expectedSeason, expectedYear] of monthExpectations) {
    const info = getCurrentAnimeSeason(new Date(year, month, 15));
    assert.equal(info.season, expectedSeason);
    assert.equal(info.seasonYear, expectedYear);
  }

  // Exact Dec 31 -> Jan 1 rollover continuity
  const dec31 = getCurrentAnimeSeason(new Date(2026, 11, 31, 23, 59, 0));
  const jan1 = getCurrentAnimeSeason(new Date(2027, 0, 1, 0, 1, 0));
  assert.deepEqual(dec31, jan1);
  assert.equal(dec31.label, 'Winter 2027');

  // 2. Title fallback order & safe normalization
  const engItem = normalizeAniListMedia(makeRawMedia());
  assert.ok(engItem);
  assert.equal(engItem.title.display, "Frieren: Beyond Journey's End");
  assert.equal(
    engItem.description,
    'An elven mage reflects on mortality.\n\nNew journey & hope.'
  );

  const romajiItem = normalizeAniListMedia(
    makeRawMedia({
      title: { english: '   ', romaji: 'Sousou no Frieren', native: '葬送のフリーレン' },
    })
  );
  assert.equal(romajiItem?.title.display, 'Sousou no Frieren');

  const nativeItem = normalizeAniListMedia(
    makeRawMedia({
      title: { english: null, romaji: '', native: '葬送のフリーレン' },
    })
  );
  assert.equal(nativeItem?.title.display, '葬送のフリーレン');

  const untitledItem = normalizeAniListMedia(
    makeRawMedia({
      title: { english: null, romaji: null, native: null },
      coverImage: { extraLarge: 'javascript:alert(1)', large: 'http://insecure.example/a.jpg' },
      averageScore: null,
      episodes: null,
      genres: null,
      description: null,
      siteUrl: 'javascript:alert(1)',
    })
  );
  assert.ok(untitledItem);
  assert.equal(untitledItem.title.display, 'Untitled Anime');
  assert.equal(untitledItem.coverImage.best, null);
  assert.equal(untitledItem.averageScore, null);
  assert.equal(untitledItem.episodes, null);
  assert.deepEqual(untitledItem.genres, []);
  assert.equal(untitledItem.siteUrl, 'https://anilist.co/anime/154587');

  // URL and description sanitizer helpers
  assert.equal(sanitizeHttpsUrl('https://cdn.anilist.co/cover.jpg'), 'https://cdn.anilist.co/cover.jpg');
  assert.equal(sanitizeHttpsUrl('http://cdn.anilist.co/cover.jpg'), null);
  assert.equal(sanitizeHttpsUrl('javascript:alert(1)'), null);
  assert.equal(
    sanitizeAniListDescription('Hello&nbsp;&quot;World&quot;<br><b>Bold</b>'),
    'Hello "World"\nBold'
  );
  assert.equal(formatTimeUntilAiring(2 * 86400 + 5 * 3600 + 10), '2d 5h');
  assert.equal(formatAnimeEpisodes(null, 'RELEASING'), 'Ongoing');
  assert.equal(formatAnimeEpisodes(1, 'FINISHED'), '1 Ep');

  // 3. Adult content exclusion in variables and normalization
  const categories = [
    'trending',
    'seasonal',
    'currently_airing',
    'upcoming',
    'popular',
    'top_rated',
  ] as const;
  for (const cat of categories) {
    const vars = buildCategoryVariables(cat, { perPage: 15 });
    assert.equal(vars.isAdult, false);
  }
  assert.equal(normalizeAniListMedia(makeRawMedia({ isAdult: true })), null);
  assert.equal(normalizeAniListMedia(makeRawMedia({ isAdult: undefined })), null);
  assert.equal(normalizeAniListMedia(makeRawMedia({ isAdult: null })), null);

  // 4. Caching, TTL expiration, seasonal key rollover, corrupted storage recovery
  let clock = 1_000_000;
  let fetchCount = 0;
  const storage = createMemoryStorage();
  const capturedBodies: Array<{ query: string; variables: Record<string, unknown> }> = [];

  const mockFetch: typeof fetch = async (input, init) => {
    fetchCount += 1;
    assert.equal(input, ANILIST_GRAPHQL_ENDPOINT);
    assert.equal(init?.method, 'POST');
    const parsedBody = JSON.parse(String(init?.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };
    capturedBodies.push(parsedBody);

    return new Response(
      JSON.stringify({
        data: {
          Page: {
            media: [
              makeRawMedia({ id: 1, isAdult: false, averageScore: 90 }),
              makeRawMedia({ id: 2, isAdult: true, averageScore: 99 }), // Must be filtered out
              makeRawMedia({ id: 3, isAdult: false, averageScore: null }), // Filtered out in top_rated
            ],
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const client = createAniListClient({
    fetchImpl: mockFetch,
    storage,
    now: () => clock,
    sleep: async () => {},
    isOnline: () => true,
    ttls: { trending: 5_000, top_rated: 10_000, seasonal: 5_000 },
    minRequestIntervalMs: 0,
  });

  const firstTrending = await client.getCategory('trending');
  assert.equal(fetchCount, 1);
  assert.equal(firstTrending.source, 'network');
  assert.equal(firstTrending.items.length, 2); // id=2 (isAdult:true) excluded
  assert.equal(firstTrending.items[0].trendingRank, 1);
  assert.equal(capturedBodies[0].variables.isAdult, false);

  // Within TTL -> cache hit, no network fetch
  clock += 2_000;
  const cachedTrending = await client.getCategory('trending');
  assert.equal(fetchCount, 1);
  assert.equal(cachedTrending.source, 'cache');
  assert.equal(cachedTrending.isStale, false);

  // Past TTL -> network refresh
  clock += 5_000;
  const refreshedTrending = await client.getCategory('trending');
  assert.equal(fetchCount, 2);
  assert.equal(refreshedTrending.source, 'network');

  // Top rated excludes null score entries
  const topRated = await client.getCategory('top_rated');
  assert.equal(topRated.items.length, 1);
  assert.equal(topRated.items[0].id, 1);

  // Seasonal rollover creates distinct cache key
  const fallSeasonal = await client.getCategory('seasonal', {
    date: new Date(2026, 10, 30),
  });
  assert.equal(fallSeasonal.seasonInfo?.key, 'FALL_2026');
  const winterSeasonal = await client.getCategory('seasonal', {
    date: new Date(2026, 11, 1),
  });
  assert.equal(winterSeasonal.seasonInfo?.key, 'WINTER_2027');

  // Corrupted storage entry is safely ignored and refetched
  storage.setItem('ata:anilist:v1:category:popular:perPage=15', '{bad-json');
  const popularRes = await client.getCategory('popular');
  assert.equal(popularRes.source, 'network');
  assert.equal(popularRes.items.length, 2);

  // 5. Offline stale cache fallback vs uncached offline error
  let onlineFlag = true;
  let shouldFailNetwork = false;
  const offlineStorage = createMemoryStorage();
  const offlineClient = createAniListClient({
    fetchImpl: async () => {
      if (shouldFailNetwork) {
        throw new Error('Network unreachable');
      }
      return new Response(
        JSON.stringify({
          data: { Page: { media: [makeRawMedia({ id: 10, isAdult: false })] } },
        }),
        { status: 200 }
      );
    },
    storage: offlineStorage,
    now: () => clock,
    sleep: async () => {},
    isOnline: () => onlineFlag,
    ttls: { upcoming: 1_000 },
    minRequestIntervalMs: 0,
    maxRetries: 0,
  });

  await offlineClient.getCategory('upcoming');
  clock += 5_000; // expire TTL
  onlineFlag = false;

  const staleOffline = await offlineClient.getCategory('upcoming');
  assert.equal(staleOffline.source, 'stale-cache');
  assert.equal(staleOffline.isStale, true);
  assert.equal(staleOffline.items.length, 1);

  await assert.rejects(
    () => offlineClient.getCategory('popular'),
    (err: unknown) => err instanceof AniListApiError && err.code === 'OFFLINE'
  );

  // Network failure preserves stale cache
  onlineFlag = true;
  shouldFailNetwork = true;
  const staleOnError = await offlineClient.getCategory('upcoming');
  assert.equal(staleOnError.source, 'stale-cache');
  assert.equal(staleOnError.isStale, true);

  // 6. Request deduplication & independent AbortController cancellation
  let dedupFetchCalls = 0;
  let releasePendingFetch!: () => void;
  const dedupClient = createAniListClient({
    fetchImpl: async () => {
      dedupFetchCalls += 1;
      await new Promise<void>((resolve) => {
        releasePendingFetch = resolve;
      });
      return new Response(
        JSON.stringify({
          data: { Page: { media: [makeRawMedia({ id: 77, isAdult: false })] } },
        }),
        { status: 200 }
      );
    },
    storage: createMemoryStorage(),
    sleep: async () => {},
    isOnline: () => true,
    minRequestIntervalMs: 0,
  });

  const controllerA = new AbortController();
  const controllerB = new AbortController();
  const reqA = dedupClient.getCategory('trending', { signal: controllerA.signal });
  const reqB = dedupClient.getCategory('trending', { signal: controllerB.signal });
  await Promise.resolve();
  assert.equal(dedupFetchCalls, 1);

  controllerA.abort();
  await assert.rejects(
    () => reqA,
    (err: unknown) => err instanceof AniListApiError && err.code === 'ABORTED'
  );

  releasePendingFetch();
  const resB = await reqB;
  assert.equal(dedupFetchCalls, 1);
  assert.equal(resB.items[0].id, 77);

  // 7. Rate-limit (429) retry & GraphQL error never cached
  let rateAttempt = 0;
  const sleepDurations: number[] = [];
  const retryStorage = createMemoryStorage();
  const retryClient = createAniListClient({
    fetchImpl: async () => {
      rateAttempt += 1;
      if (rateAttempt === 1) {
        return new Response(JSON.stringify({ errors: [{ message: 'Too Many Requests' }] }), {
          status: 429,
          headers: { 'Retry-After': '1' },
        });
      }
      return new Response(
        JSON.stringify({
          data: {
            Media: makeRawMedia({ id: 500, isAdult: false }),
          },
        }),
        { status: 200 }
      );
    },
    storage: retryStorage,
    sleep: async (ms) => {
      sleepDurations.push(ms);
    },
    isOnline: () => true,
    minRequestIntervalMs: 0,
    maxRetries: 2,
  });

  const detailRes = await retryClient.getAnimeById(500);
  assert.equal(rateAttempt, 2);
  assert.deepEqual(sleepDurations, [1000]);
  assert.equal(detailRes.anime?.id, 500);

  // GraphQL errors throw and never cache
  const gqlErrorStorage = createMemoryStorage();
  const gqlErrorClient = createAniListClient({
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          errors: [{ message: 'Invalid query argument' }],
          data: null,
        }),
        { status: 400 }
      ),
    storage: gqlErrorStorage,
    sleep: async () => {},
    isOnline: () => true,
    minRequestIntervalMs: 0,
    maxRetries: 0,
  });

  await assert.rejects(
    () => gqlErrorClient.getCategory('trending'),
    (err: unknown) => err instanceof AniListApiError && err.code === 'GRAPHQL_ERROR'
  );
  assert.equal(gqlErrorStorage.store.size, 0);

  console.log('All anilistService tests passed.');
}

void runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
