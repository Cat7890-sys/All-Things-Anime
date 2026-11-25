import assert from 'node:assert/strict';
import {
  getFirestoreDiagnosticsSnapshot,
  resetFirestoreDiagnostics,
  sanitizeDiagnosticKey,
} from './firestoreDiagnostics.ts';
import {
  clearAllCache,
  clearUserScopedCache,
  getCachedValue,
  getMemoryCacheSize,
  getOrFetch,
  invalidateCacheKey,
  invalidateCachePrefix,
  setCacheValue,
} from './memoryCache.ts';
import {
  clearAllSharedSubscriptions,
  clearUserSharedSubscriptions,
  getSharedChannelConsumerCount,
  getSharedSubscriptionCount,
  subscribeShared,
} from './sharedSubscriptionManager.ts';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests(): Promise<void> {
  // =========================================================
  // 1. Shared Subscription Deduplication & Replay
  // =========================================================
  clearAllSharedSubscriptions();
  resetFirestoreDiagnostics();

  let underlyingCreates = 0;
  let underlyingTeardowns = 0;
  let emitSnapshot!: (val: string[]) => void;
  let emitStreamError!: (msg: string) => void;

  const receivedA: string[][] = [];
  const receivedB: string[][] = [];
  const receivedLate: string[][] = [];
  const errorsReceived: string[] = [];

  const factory = (
    onVal: (v: string[]) => void,
    onErr: (e: string) => void
  ) => {
    underlyingCreates += 1;
    emitSnapshot = onVal;
    emitStreamError = onErr;
    return () => {
      underlyingTeardowns += 1;
    };
  };

  const unsubA = subscribeShared(
    'notifications:user_alpha_1234567890:50',
    'notificationService',
    factory,
    (v) => receivedA.push(v),
    (e) => errorsReceived.push(e),
    { uid: 'user_alpha_1234567890' }
  );

  const unsubB = subscribeShared(
    'notifications:user_alpha_1234567890:50',
    'notificationService',
    factory,
    (v) => receivedB.push(v),
    (e) => errorsReceived.push(e),
    { uid: 'user_alpha_1234567890' }
  );

  assert.equal(underlyingCreates, 1, 'Multiple consumers must share 1 listener');
  assert.equal(getSharedSubscriptionCount(), 1);
  assert.equal(
    getSharedChannelConsumerCount('notifications:user_alpha_1234567890:50'),
    2
  );

  emitSnapshot(['n1', 'n2']);
  assert.deepEqual(receivedA, [['n1', 'n2']]);
  assert.deepEqual(receivedB, [['n1', 'n2']]);

  // Late consumer receives immediate cached replay without creating a new listener
  const unsubLate = subscribeShared(
    'notifications:user_alpha_1234567890:50',
    'notificationService',
    factory,
    (v) => receivedLate.push(v),
    undefined,
    { uid: 'user_alpha_1234567890' }
  );
  assert.equal(underlyingCreates, 1);
  assert.deepEqual(receivedLate, [['n1', 'n2']]);
  assert.equal(
    getSharedChannelConsumerCount('notifications:user_alpha_1234567890:50'),
    3
  );

  // Double unsubscribe must be idempotent and not remove other active consumers
  unsubA();
  unsubA();
  assert.equal(
    getSharedChannelConsumerCount('notifications:user_alpha_1234567890:50'),
    2
  );
  assert.equal(underlyingTeardowns, 0);

  unsubB();
  assert.equal(
    getSharedChannelConsumerCount('notifications:user_alpha_1234567890:50'),
    1
  );
  assert.equal(underlyingTeardowns, 0);

  // Last consumer triggers immediate teardown
  unsubLate();
  assert.equal(underlyingTeardowns, 1);
  assert.equal(getSharedSubscriptionCount(), 0);

  // Error propagation and late error replay
  const unsubErr1 = subscribeShared(
    'messages:conv_xyz',
    'messageService',
    factory,
    () => {},
    (e) => errorsReceived.push(`c1:${e}`)
  );
  emitStreamError('permission-denied');
  const unsubErr2 = subscribeShared(
    'messages:conv_xyz',
    'messageService',
    factory,
    () => {},
    (e) => errorsReceived.push(`c2:${e}`)
  );
  assert.deepEqual(errorsReceived, ['c1:permission-denied', 'c2:permission-denied']);
  unsubErr1();
  unsubErr2();
  assert.equal(getSharedSubscriptionCount(), 0);

  // =========================================================
  // 2. Mount / Unmount Churn Loop & Diagnostics Tracking
  // =========================================================
  clearAllSharedSubscriptions();
  resetFirestoreDiagnostics();
  let churnTeardowns = 0;

  for (let i = 0; i < 40; i += 1) {
    const unsub1 = subscribeShared(
      'communityPosts:global:15',
      'postService',
      (emit) => {
        emit([`post_${i}`]);
        return () => {
          churnTeardowns += 1;
        };
      },
      () => {}
    );
    const unsub2 = subscribeShared(
      'communityPosts:global:15',
      'postService',
      () => () => {},
      () => {}
    );
    unsub1();
    unsub2();
  }

  assert.equal(churnTeardowns, 40);
  assert.equal(getSharedSubscriptionCount(), 0);

  const diagSnap = getFirestoreDiagnosticsSnapshot();
  assert.equal(diagSnap.activeCount, 0);
  assert.equal(diagSnap.totalListenersCreated, 40);
  assert.equal(diagSnap.totalSubscriptionsReused, 40);
  assert.equal(diagSnap.totalListenersCleanedUp, 40);
  assert.equal(diagSnap.duplicateWarningsCount, 0);

  // Diagnostics UID redaction (no full user UID leaked)
  const sanitized = sanitizeDiagnosticKey(
    'notifications:Np7DpdmeRWNmDbiXjM9bj2XzQDG3:50'
  );
  assert.equal(sanitized, 'notifications:Np7D…:50');
  assert.equal(sanitized.includes('Np7DpdmeRWNmDbiXjM9bj2XzQDG3'), false);

  // =========================================================
  // 3. Account Switch & Logout Isolation for Listeners & Cache
  // =========================================================
  clearAllSharedSubscriptions();
  clearAllCache();

  let userATornDown = 0;
  let userBTornDown = 0;
  let publicTornDown = 0;

  subscribeShared(
    'userPrefs:uid_A_long_account',
    'userPreferencesService',
    () => () => {
      userATornDown += 1;
    },
    () => {},
    undefined,
    { uid: 'uid_A_long_account' }
  );
  subscribeShared(
    'userPrefs:uid_B_long_account',
    'userPreferencesService',
    () => () => {
      userBTornDown += 1;
    },
    () => {},
    undefined,
    { uid: 'uid_B_long_account' }
  );
  subscribeShared(
    'communityPosts:global:15',
    'postService',
    () => () => {
      publicTornDown += 1;
    },
    () => {}
  );

  setCacheValue('userPrefs:uid_A_long_account', { theme: 'dark' }, {
    ttlMs: 60_000,
    uid: 'uid_A_long_account',
  });
  setCacheValue('userPrefs:uid_B_long_account', { theme: 'light' }, {
    ttlMs: 60_000,
    uid: 'uid_B_long_account',
  });
  setCacheValue('catalogueOverrides:all', { 1: { title: 'Test' } }, {
    ttlMs: 60_000,
  });

  clearUserSharedSubscriptions('uid_A_long_account');
  clearUserScopedCache('uid_A_long_account');

  assert.equal(userATornDown, 1, 'User A listeners must tear down on switch/logout');
  assert.equal(userBTornDown, 0, 'User B listeners must remain untouched');
  assert.equal(publicTornDown, 0, 'Public listeners must remain untouched');
  assert.equal(getCachedValue('userPrefs:uid_A_long_account'), undefined);
  assert.deepEqual(getCachedValue('userPrefs:uid_B_long_account'), {
    theme: 'light',
  });
  assert.deepEqual(getCachedValue('catalogueOverrides:all'), {
    1: { title: 'Test' },
  });

  clearAllSharedSubscriptions();
  assert.equal(getSharedSubscriptionCount(), 0);

  // =========================================================
  // 4. Memory Cache: Single-Flight, TTL Expiry, Invalidation & Bound
  // =========================================================
  clearAllCache();

  let fetchCount = 0;
  const concurrent = await Promise.all([
    getOrFetch(
      'publicCollections:30',
      async () => {
        fetchCount += 1;
        await sleep(10);
        return ['col1', 'col2'];
      },
      { ttlMs: 5000 }
    ),
    getOrFetch(
      'publicCollections:30',
      async () => {
        fetchCount += 1;
        return ['col1', 'col2'];
      },
      { ttlMs: 5000 }
    ),
    getOrFetch(
      'publicCollections:30',
      async () => {
        fetchCount += 1;
        return ['col1', 'col2'];
      },
      { ttlMs: 5000 }
    ),
  ]);

  assert.equal(fetchCount, 1, 'Concurrent calls must share one in-flight fetch');
  assert.deepEqual(concurrent, [
    ['col1', 'col2'],
    ['col1', 'col2'],
    ['col1', 'col2'],
  ]);

  // Cached hit avoids fetch
  await getOrFetch(
    'publicCollections:30',
    async () => {
      fetchCount += 1;
      return ['stale'];
    },
    { ttlMs: 5000 }
  );
  assert.equal(fetchCount, 1);

  // Invalidation by key and prefix
  invalidateCacheKey('publicCollections:30');
  await getOrFetch(
    'publicCollections:30',
    async () => {
      fetchCount += 1;
      return ['fresh'];
    },
    { ttlMs: 5000 }
  );
  assert.equal(fetchCount, 2);

  setCacheValue('challenges:list:all:anon', ['c1'], { ttlMs: 5000 });
  setCacheValue('challenges:list:comm_1:shared', ['c2'], { ttlMs: 5000 });
  invalidateCachePrefix('challenges:list:');
  assert.equal(getCachedValue('challenges:list:all:anon'), undefined);
  assert.equal(getCachedValue('challenges:list:comm_1:shared'), undefined);

  // TTL expiration triggers fresh fetch
  let ttlFetchCount = 0;
  await getOrFetch(
    'ephemeral:key',
    async () => {
      ttlFetchCount += 1;
      return 'v1';
    },
    { ttlMs: 15 }
  );
  await sleep(30);
  const afterExpiry = await getOrFetch(
    'ephemeral:key',
    async () => {
      ttlFetchCount += 1;
      return 'v2';
    },
    { ttlMs: 1000 }
  );
  assert.equal(ttlFetchCount, 2);
  assert.equal(afterExpiry, 'v2');

  // Bounded capacity eviction (max 500)
  clearAllCache();
  for (let i = 0; i < 550; i += 1) {
    setCacheValue(`bound:${i}`, i, { ttlMs: 60_000 });
  }
  assert.ok(
    getMemoryCacheSize() <= 500,
    `Cache size ${getMemoryCacheSize()} exceeded max 500`
  );
  assert.equal(getCachedValue('bound:0'), undefined);
  assert.equal(getCachedValue('bound:549'), 549);

  // =========================================================
  // 5. Post-Implementation Safety Review Regression Tests
  // =========================================================
  // 5a. Cross-UID collision on same shared key never replays stale snapshot
  clearAllSharedSubscriptions();
  let userACreates = 0;
  let userATeardowns = 0;
  let userBCreates = 0;
  let emitUserA!: (val: string) => void;
  const userAReceived: string[] = [];
  const userBReceived: string[] = [];

  subscribeShared<string>(
    'collision:channel',
    'test',
    (emit) => {
      userACreates += 1;
      emitUserA = emit;
      return () => {
        userATeardowns += 1;
      };
    },
    (val) => userAReceived.push(val),
    undefined,
    { uid: 'uid_alpha_1' }
  );
  emitUserA('secret-alpha-data');
  assert.deepEqual(userAReceived, ['secret-alpha-data']);

  const unsubCollisionB = subscribeShared<string>(
    'collision:channel',
    'test',
    (emit) => {
      userBCreates += 1;
      emit('fresh-beta-data');
      return () => {};
    },
    (val) => userBReceived.push(val),
    undefined,
    { uid: 'uid_beta_2' }
  );

  assert.equal(userACreates, 1);
  assert.equal(userATeardowns, 1, 'Previous UID channel must tear down on UID mismatch');
  assert.equal(userBCreates, 1);
  assert.deepEqual(
    userBReceived,
    ['fresh-beta-data'],
    'New UID consumer must never receive previous UID cached replay'
  );
  unsubCollisionB();

  // 5b. Failed getOrFetch must not poison cache and next call must retry
  clearAllCache();
  let failAttempts = 0;
  await assert.rejects(
    () =>
      getOrFetch(
        'flaky:key',
        async () => {
          failAttempts += 1;
          throw new Error('transient-firestore-error');
        },
        { ttlMs: 10_000 }
      ),
    /transient-firestore-error/
  );
  assert.equal(getCachedValue('flaky:key'), undefined);
  const recovered = await getOrFetch(
    'flaky:key',
    async () => {
      failAttempts += 1;
      return 'recovered-value';
    },
    { ttlMs: 10_000 }
  );
  assert.equal(failAttempts, 2);
  assert.equal(recovered, 'recovered-value');
  assert.equal(getCachedValue('flaky:key'), 'recovered-value');

  // 5c. Mid-flight invalidateCacheKey / invalidateCachePrefix prevent stale cache writeback
  clearAllCache();
  let resolveStaleKey!: (val: string) => void;
  const staleKeyPromise = getOrFetch(
    'collectionById:col_1',
    () =>
      new Promise<string>((resolve) => {
        resolveStaleKey = resolve;
      }),
    { ttlMs: 60_000 }
  );
  invalidateCacheKey('collectionById:col_1');
  resolveStaleKey('stale-before-mutation');
  assert.equal(await staleKeyPromise, 'stale-before-mutation');
  assert.equal(
    getCachedValue('collectionById:col_1'),
    undefined,
    'Resolved stale in-flight request must not repopulate cache after key invalidation'
  );

  let resolveStalePrefix!: (val: string) => void;
  const stalePrefixPromise = getOrFetch(
    'communities:popular:global',
    () =>
      new Promise<string>((resolve) => {
        resolveStalePrefix = resolve;
      }),
    { ttlMs: 60_000 }
  );
  invalidateCachePrefix('communities:popular:');
  resolveStalePrefix('stale-community-list');
  assert.equal(await stalePrefixPromise, 'stale-community-list');
  assert.equal(
    getCachedValue('communities:popular:global'),
    undefined,
    'Resolved stale in-flight request must not repopulate cache after prefix invalidation'
  );

  // 5d. Mid-flight clearUserScopedCache prevents cross-account writeback while preserving public in-flight
  clearAllCache();
  let resolveUserFlight!: (val: string) => void;
  let resolvePublicFlight!: (val: string) => void;
  const userFlight = getOrFetch(
    'private:doc',
    () =>
      new Promise<string>((resolve) => {
        resolveUserFlight = resolve;
      }),
    { ttlMs: 60_000, uid: 'uid_session_1' }
  );
  const publicFlight = getOrFetch(
    'public:doc',
    () =>
      new Promise<string>((resolve) => {
        resolvePublicFlight = resolve;
      }),
    { ttlMs: 60_000 }
  );

  clearUserScopedCache();
  resolveUserFlight('stale-user-secret');
  resolvePublicFlight('safe-public-data');
  await Promise.all([userFlight, publicFlight]);

  assert.equal(
    getCachedValue('private:doc'),
    undefined,
    'User-scoped in-flight fetch must not write back after logout cache clear'
  );
  assert.equal(
    getCachedValue('public:doc'),
    'safe-public-data',
    'Public non-user-scoped in-flight fetch should remain valid across user logout clear'
  );

  clearAllCache();
  clearAllSharedSubscriptions();
  resetFirestoreDiagnostics();
  console.log('All Firestore optimisation unit tests passed!');
}

void runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
