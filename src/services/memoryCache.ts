/**
 * Bounded in-memory TTL cache with single-flight in-flight deduplication and
 * account-scoped isolation for Firestore query/document reads.
 */

interface CacheEntry<T> {
  value: T;
  expiresAtMs: number;
  uid?: string;
}

export interface MemoryCacheGetOrFetchOptions {
  /** Cache entry Time-To-Live in milliseconds. */
  ttlMs: number;
  /** Optional owner UID; entries with `uid` are cleared on logout/account switch. */
  uid?: string;
}

const DEFAULT_MAX_ENTRIES = 500;
const MAX_EPOCH_ENTRIES = 2000;

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const inFlightUids = new Map<string, string | undefined>();
const keyEpochs = new Map<string, number>();
let globalClearEpoch = 0;
let allUsersClearEpoch = 0;

function bumpKeyEpoch(key: string): void {
  const next = (keyEpochs.get(key) ?? 0) + 1;
  keyEpochs.delete(key);
  keyEpochs.set(key, next);
  while (keyEpochs.size > MAX_EPOCH_ENTRIES) {
    const oldestKey = keyEpochs.keys().next().value;
    if (oldestKey === undefined) break;
    keyEpochs.delete(oldestKey);
  }
}

function evictExpiredAndExcess(): void {
  const now = Date.now();
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expiresAtMs <= now) {
      cacheStore.delete(key);
    }
  }
  while (cacheStore.size > DEFAULT_MAX_ENTRIES) {
    const oldestKey = cacheStore.keys().next().value;
    if (oldestKey === undefined) break;
    cacheStore.delete(oldestKey);
  }
}

export function getCachedValue<T>(key: string): T | undefined {
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAtMs) {
    cacheStore.delete(key);
    return undefined;
  }
  // Refresh LRU recency
  cacheStore.delete(key);
  cacheStore.set(key, entry as CacheEntry<unknown>);
  return entry.value;
}

export function setCacheValue<T>(
  key: string,
  value: T,
  options: MemoryCacheGetOrFetchOptions
): void {
  if (options.ttlMs <= 0) return;
  cacheStore.delete(key);
  cacheStore.set(key, {
    value,
    expiresAtMs: Date.now() + options.ttlMs,
    uid: options.uid,
  });
  evictExpiredAndExcess();
}

/**
 * Returns a fresh cached value if present, or joins an in-flight request for
 * the same key, or executes `fetcher()` once and caches its resolved result.
 */
export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: MemoryCacheGetOrFetchOptions
): Promise<T> {
  const cached = getCachedValue<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  const existingFlight = inFlightRequests.get(key) as Promise<T> | undefined;
  if (existingFlight && inFlightUids.get(key) === options.uid) {
    return existingFlight;
  }

  const startGlobalEpoch = globalClearEpoch;
  const startAllUsersEpoch = allUsersClearEpoch;
  const startKeyEpoch = keyEpochs.get(key) ?? 0;

  let request!: Promise<T>;
  request = (async () => {
    try {
      const value = await fetcher();
      const notClearedGlobally = globalClearEpoch === startGlobalEpoch;
      const notInvalidatedByKey = (keyEpochs.get(key) ?? 0) === startKeyEpoch;
      const notClearedAllUsers =
        !options.uid || allUsersClearEpoch === startAllUsersEpoch;
      if (notClearedGlobally && notInvalidatedByKey && notClearedAllUsers) {
        setCacheValue(key, value, options);
      }
      return value;
    } finally {
      if (inFlightRequests.get(key) === request) {
        inFlightRequests.delete(key);
        inFlightUids.delete(key);
      }
    }
  })();

  inFlightRequests.set(key, request);
  inFlightUids.set(key, options.uid);
  return request;
}

export function invalidateCacheKey(key: string): void {
  bumpKeyEpoch(key);
  cacheStore.delete(key);
  inFlightRequests.delete(key);
  inFlightUids.delete(key);
}

export function invalidateCachePrefix(prefix: string): void {
  for (const key of Array.from(cacheStore.keys())) {
    if (key.startsWith(prefix)) {
      bumpKeyEpoch(key);
      cacheStore.delete(key);
    }
  }
  for (const key of Array.from(inFlightRequests.keys())) {
    if (key.startsWith(prefix)) {
      bumpKeyEpoch(key);
      inFlightRequests.delete(key);
      inFlightUids.delete(key);
    }
  }
}

export function clearUserScopedCache(uid?: string): void {
  for (const [key, entry] of Array.from(cacheStore.entries())) {
    if (uid ? entry.uid === uid : Boolean(entry.uid)) {
      bumpKeyEpoch(key);
      cacheStore.delete(key);
    }
  }
  if (uid) {
    for (const key of Array.from(inFlightRequests.keys())) {
      if (inFlightUids.get(key) === uid || key.includes(`:${uid}`)) {
        bumpKeyEpoch(key);
        inFlightRequests.delete(key);
        inFlightUids.delete(key);
      }
    }
  } else {
    allUsersClearEpoch += 1;
    for (const key of Array.from(inFlightRequests.keys())) {
      if (inFlightUids.get(key) !== undefined) {
        bumpKeyEpoch(key);
        inFlightRequests.delete(key);
        inFlightUids.delete(key);
      }
    }
  }
}

export function clearAllCache(): void {
  globalClearEpoch += 1;
  cacheStore.clear();
  inFlightRequests.clear();
  inFlightUids.clear();
  keyEpochs.clear();
}

export function getMemoryCacheSize(): number {
  return cacheStore.size;
}
