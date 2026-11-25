import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import type { BlockedUserRecord } from '../types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  getCachedValue,
  getOrFetch,
  invalidateCacheKey,
} from './memoryCache';

const SOCIAL_GRAPH_TTL_MS = 3 * 60_000;
const STATUS_CHECK_TTL_MS = 2 * 60_000;

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return null;
}

export async function checkFollowStatus(
  followerId: string,
  targetUserId: string
): Promise<boolean> {
  if (!followerId || !targetUserId || followerId === targetUserId) {
    return false;
  }
  const cachedFollowing = getCachedValue<string[]>(`followingIds:${followerId}`);
  if (cachedFollowing !== undefined) {
    return cachedFollowing.includes(targetUserId);
  }
  const followId = `${followerId}__${targetUserId}`;
  return getOrFetch(
    `followStatus:${followerId}:${targetUserId}`,
    async () => {
      try {
        const snap = await getDoc(doc(db, 'follows', followId));
        return snap.exists();
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `follows/${followId}`);
      }
    },
    { ttlMs: STATUS_CHECK_TTL_MS, uid: followerId }
  );
}

export async function fetchFollowingIds(
  followerId: string,
  forceRefresh = false
): Promise<string[]> {
  if (!followerId) return [];
  const cacheKey = `followingIds:${followerId}`;
  if (forceRefresh) {
    invalidateCacheKey(cacheKey);
  }
  return getOrFetch(
    cacheKey,
    async () => {
      try {
        const q = query(
          collection(db, 'follows'),
          where('followerId', '==', followerId),
          limit(500)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => String(d.data().followingId));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'follows');
      }
    },
    { ttlMs: SOCIAL_GRAPH_TTL_MS, uid: followerId }
  );
}

export async function followUser(
  followerId: string,
  targetUserId: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== followerId) {
    throw new Error('Please sign in to follow users.');
  }
  if (!currentUser.emailVerified) {
    throw new Error('Please verify your email address before following users.');
  }
  if (followerId === targetUserId) {
    throw new Error('You cannot follow your own account.');
  }

  await currentUser.getIdToken(true);

  const followId = `${followerId}__${targetUserId}`;
  try {
    await runTransaction(db, async (transaction) => {
      const followRef = doc(db, 'follows', followId);
      const targetProfileRef = doc(db, 'publicProfiles', targetUserId);
      const ownProfileRef = doc(db, 'publicProfiles', followerId);

      const [followSnap, targetSnap, ownSnap] = await Promise.all([
        transaction.get(followRef),
        transaction.get(targetProfileRef),
        transaction.get(ownProfileRef),
      ]);

      if (followSnap.exists()) {
        throw new Error('You are already following this user.');
      }
      if (!targetSnap.exists()) {
        throw new Error('Target profile does not exist.');
      }

      const targetFollowers =
        typeof targetSnap.data().followersCount === 'number'
          ? targetSnap.data().followersCount
          : 0;

      const ownFollowing =
        ownSnap.exists() && typeof ownSnap.data().followingCount === 'number'
          ? ownSnap.data().followingCount
          : 0;

      transaction.set(followRef, {
        id: followId,
        followerId,
        followingId: targetUserId,
        createdAt: serverTimestamp(),
      });

      transaction.update(targetProfileRef, {
        followersCount: targetFollowers + 1,
      });

      if (ownSnap.exists()) {
        transaction.update(ownProfileRef, {
          followingCount: ownFollowing + 1,
        });
      }
    });
    invalidateCacheKey(`followingIds:${followerId}`);
    invalidateCacheKey(`followStatus:${followerId}:${targetUserId}`);
    invalidateCacheKey(`publicProfile:${followerId}`);
    invalidateCacheKey(`publicProfile:${targetUserId}`);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('already following') ||
        error.message.includes('Target profile'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `follows/${followId}`);
  }
}

export async function unfollowUser(
  followerId: string,
  targetUserId: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== followerId) {
    throw new Error('Please sign in to unfollow users.');
  }
  if (!currentUser.emailVerified) {
    throw new Error('Please verify your email address first.');
  }

  await currentUser.getIdToken(true);

  const followId = `${followerId}__${targetUserId}`;
  try {
    await runTransaction(db, async (transaction) => {
      const followRef = doc(db, 'follows', followId);
      const targetProfileRef = doc(db, 'publicProfiles', targetUserId);
      const ownProfileRef = doc(db, 'publicProfiles', followerId);

      const [followSnap, targetSnap, ownSnap] = await Promise.all([
        transaction.get(followRef),
        transaction.get(targetProfileRef),
        transaction.get(ownProfileRef),
      ]);

      if (!followSnap.exists()) {
        return;
      }

      transaction.delete(followRef);

      if (
        targetSnap.exists() &&
        typeof targetSnap.data().followersCount === 'number' &&
        targetSnap.data().followersCount >= 1
      ) {
        transaction.update(targetProfileRef, {
          followersCount: targetSnap.data().followersCount - 1,
        });
      }

      if (
        ownSnap.exists() &&
        typeof ownSnap.data().followingCount === 'number' &&
        ownSnap.data().followingCount >= 1
      ) {
        transaction.update(ownProfileRef, {
          followingCount: ownSnap.data().followingCount - 1,
        });
      }
    });
    invalidateCacheKey(`followingIds:${followerId}`);
    invalidateCacheKey(`followStatus:${followerId}:${targetUserId}`);
    invalidateCacheKey(`publicProfile:${followerId}`);
    invalidateCacheKey(`publicProfile:${targetUserId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `follows/${followId}`);
  }
}

export async function fetchBlockedUsers(
  blockerId: string,
  forceRefresh = false
): Promise<BlockedUserRecord[]> {
  if (!blockerId) return [];
  const cacheKey = `blockedUsers:${blockerId}`;
  if (forceRefresh) {
    invalidateCacheKey(cacheKey);
  }
  return getOrFetch(
    cacheKey,
    async () => {
      try {
        const q = query(
          collection(db, 'blocks'),
          where('blockerId', '==', blockerId),
          limit(500)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            blockerId: String(data.blockerId || ''),
            blockedId: String(data.blockedId || ''),
            blockedUsername: String(data.blockedUsername || ''),
            createdAt: toDateOrNull(data.createdAt),
          };
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'blocks');
      }
    },
    { ttlMs: SOCIAL_GRAPH_TTL_MS, uid: blockerId }
  );
}

export async function checkBlockBetween(
  uidA: string,
  uidB: string
): Promise<{ blockedByMe: boolean; blockedByThem: boolean }> {
  if (!uidA || !uidB || uidA === uidB) {
    return { blockedByMe: false, blockedByThem: false };
  }
  return getOrFetch(
    `blockBetween:${uidA}:${uidB}`,
    async () => {
      try {
        const cachedBlocked = getCachedValue<BlockedUserRecord[]>(
          `blockedUsers:${uidA}`
        );
        if (cachedBlocked !== undefined) {
          const blockedByMe = cachedBlocked.some((b) => b.blockedId === uidB);
          const theirSnap = await getDoc(doc(db, 'blocks', `${uidB}__${uidA}`));
          return {
            blockedByMe,
            blockedByThem: theirSnap.exists(),
          };
        }
        const [mySnap, theirSnap] = await Promise.all([
          getDoc(doc(db, 'blocks', `${uidA}__${uidB}`)),
          getDoc(doc(db, 'blocks', `${uidB}__${uidA}`)),
        ]);
        return {
          blockedByMe: mySnap.exists(),
          blockedByThem: theirSnap.exists(),
        };
      } catch {
        return { blockedByMe: false, blockedByThem: false };
      }
    },
    { ttlMs: STATUS_CHECK_TTL_MS, uid: uidA }
  );
}

export async function blockUser(
  blockerId: string,
  blockedId: string,
  blockedUsername: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== blockerId) {
    throw new Error('Please sign in to block users.');
  }
  if (!currentUser.emailVerified) {
    throw new Error('Please verify your email address first.');
  }
  if (blockerId === blockedId) {
    throw new Error('You cannot block yourself.');
  }

  await currentUser.getIdToken(true);

  const blockId = `${blockerId}__${blockedId}`;
  try {
    await setDoc(doc(db, 'blocks', blockId), {
      id: blockId,
      blockerId,
      blockedId,
      blockedUsername,
      createdAt: serverTimestamp(),
    });
    invalidateCacheKey(`blockedUsers:${blockerId}`);
    invalidateCacheKey(`blockBetween:${blockerId}:${blockedId}`);
    invalidateCacheKey(`blockBetween:${blockedId}:${blockerId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `blocks/${blockId}`);
  }

  // Also unfollow if currently following
  try {
    const isFollowing = await checkFollowStatus(blockerId, blockedId);
    if (isFollowing) {
      await unfollowUser(blockerId, blockedId);
    }
  } catch {
    // Non-fatal if follow cleanup fails
  }
}

export async function unblockUser(
  blockerId: string,
  blockedId: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== blockerId) {
    throw new Error('Please sign in to unblock users.');
  }
  if (!currentUser.emailVerified) {
    throw new Error('Please verify your email address first.');
  }

  await currentUser.getIdToken(true);

  const blockId = `${blockerId}__${blockedId}`;
  try {
    await deleteDoc(doc(db, 'blocks', blockId));
    invalidateCacheKey(`blockedUsers:${blockerId}`);
    invalidateCacheKey(`blockBetween:${blockerId}:${blockedId}`);
    invalidateCacheKey(`blockBetween:${blockedId}:${blockerId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `blocks/${blockId}`);
  }
}
