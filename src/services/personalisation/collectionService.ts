import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  CollectionItem,
  CreateCollectionInput,
  UpdateCollectionInput,
  UserCollection,
} from '../../types';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  getOrFetch,
  invalidateCacheKey,
  invalidateCachePrefix,
  setCacheValue,
} from '../memoryCache';
import { subscribeShared } from '../sharedSubscriptionManager';
import { getPublicProfile } from '../userProfileService';
import {
  COLLECTION_MAX_ITEMS,
  validateCollectionDescription,
  validateCollectionItemsCount,
  validateCollectionTitle,
  validateCollectionVisibility,
  validateOptionalHttpsUrl,
} from '../validation';

const USER_COLLECTIONS_CACHE_TTL_MS = 3 * 60_000;
const PUBLIC_COLLECTIONS_CACHE_TTL_MS = 3 * 60_000;
const COLLECTION_DOC_CACHE_TTL_MS = 2 * 60_000;
const USER_COLLECTIONS_QUERY_LIMIT = 100;

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (
    typeof value === 'object' &&
    value &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function normalizeCollectionItems(
  items: Omit<CollectionItem, 'addedAt'>[],
  now: Date = new Date()
): CollectionItem[] {
  const seen = new Set<string>();
  const normalized: CollectionItem[] = [];

  for (const it of items) {
    const animeId = String(it.animeId || '').trim();
    if (!animeId || seen.has(animeId)) continue;
    seen.add(animeId);

    const coverErr = validateOptionalHttpsUrl(
      it.coverImage,
      1000,
      'Item cover image URL'
    );
    if (coverErr) {
      throw new Error(coverErr);
    }

    const item: CollectionItem = {
      id: animeId,
      animeId,
      title: String(it.title || 'Untitled Anime').trim(),
      coverImage: String(it.coverImage || '').trim(),
      position: normalized.length,
      addedAt: now,
    };

    if (typeof it.format === 'string' && it.format.trim()) {
      item.format = it.format.trim();
    }
    if (typeof it.note === 'string' && it.note.trim()) {
      item.note = it.note.trim().slice(0, 280);
    }

    normalized.push(item);
  }

  return normalized;
}

export function addItemToCollectionList(
  existing: CollectionItem[],
  candidate: Omit<CollectionItem, 'addedAt' | 'position'>,
  now: Date = new Date()
): CollectionItem[] {
  const candidateId = String(candidate.animeId || '').trim();
  if (!candidateId) {
    throw new Error('Anime identifier is required.');
  }
  if (existing.some((it) => it.animeId === candidateId)) {
    throw new Error(`"${candidate.title}" is already in this collection.`);
  }
  if (existing.length >= COLLECTION_MAX_ITEMS) {
    throw new Error(
      `Collections can hold up to ${COLLECTION_MAX_ITEMS} anime titles.`
    );
  }
  return normalizeCollectionItems(
    [
      ...existing,
      {
        ...candidate,
        id: candidateId,
        animeId: candidateId,
        position: existing.length,
      },
    ],
    now
  );
}

export function mapDocToCollection(
  id: string,
  data: Record<string, unknown>
): UserCollection {
  const items = Array.isArray(data.items)
    ? (data.items as Record<string, unknown>[]).map((it, idx) => ({
        id: String(it.id || it.animeId || idx),
        animeId: String(it.animeId || ''),
        title: String(it.title || ''),
        coverImage: String(it.coverImage || ''),
        format: typeof it.format === 'string' ? it.format : undefined,
        note: typeof it.note === 'string' ? it.note : undefined,
        position: typeof it.position === 'number' ? it.position : idx,
        addedAt: toDateOrNull(it.addedAt),
      }))
    : [];

  return {
    id,
    ownerId: String(data.ownerId || ''),
    ownerUsername: String(data.ownerUsername || ''),
    ownerDisplayName: String(data.ownerDisplayName || 'ATA Member'),
    ownerAvatarUrl: String(data.ownerAvatarUrl || ''),
    title: String(data.title || 'Untitled Collection'),
    description: String(data.description || ''),
    coverImageUrl: String(data.coverImageUrl || ''),
    visibility: (data.visibility as 'private' | 'public') || 'private',
    items,
    itemCount: typeof data.itemCount === 'number' ? data.itemCount : items.length,
    likeCount: typeof data.likeCount === 'number' ? data.likeCount : 0,
    saveCount: typeof data.saveCount === 'number' ? data.saveCount : 0,
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function subscribeToUserCollections(
  userId: string,
  onCollections: (collections: UserCollection[]) => void,
  onError?: (errMessage: string) => void
): Unsubscribe {
  if (!userId) {
    onCollections([]);
    return () => {};
  }

  const channelKey = `userCollections:${userId}`;
  const q = query(
    collection(db, 'userCollections'),
    where('ownerId', '==', userId),
    orderBy('updatedAt', 'desc'),
    limit(USER_COLLECTIONS_QUERY_LIMIT)
  );

  return subscribeShared<UserCollection[]>(
    channelKey,
    'collectionService',
    (emitData, emitError) =>
      onSnapshot(
        q,
        (snapshot) => {
          const list = snapshot.docs.map((d) =>
            mapDocToCollection(d.id, d.data())
          );
          setCacheValue(channelKey, list, {
            ttlMs: USER_COLLECTIONS_CACHE_TTL_MS,
            uid: userId,
          });
          emitData(list);
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, 'userCollections');
          } catch (err) {
            emitError(
              err instanceof Error
                ? err.message
                : 'Unable to sync user collections.'
            );
          }
        }
      ),
    onCollections,
    onError,
    { uid: userId }
  );
}

export async function getUserCollections(
  userId: string
): Promise<UserCollection[]> {
  if (!userId) return [];
  const cacheKey = `userCollections:${userId}`;
  return getOrFetch(
    cacheKey,
    async () => {
      const q = query(
        collection(db, 'userCollections'),
        where('ownerId', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(USER_COLLECTIONS_QUERY_LIMIT)
      );
      try {
        const snap = await getDocs(q);
        return snap.docs.map((d) => mapDocToCollection(d.id, d.data()));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'userCollections');
      }
    },
    { ttlMs: USER_COLLECTIONS_CACHE_TTL_MS, uid: userId }
  );
}

export async function getPublicCollections(
  maxItems: number = 20
): Promise<UserCollection[]> {
  const safeLimit = Math.min(Math.max(1, maxItems), 50);
  return getOrFetch(
    `publicCollections:${safeLimit}`,
    async () => {
      const q = query(
        collection(db, 'userCollections'),
        where('visibility', '==', 'public'),
        orderBy('updatedAt', 'desc'),
        limit(safeLimit)
      );
      try {
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => mapDocToCollection(d.id, d.data()));
        for (const col of list) {
          setCacheValue(`collectionById:${col.id}`, col, {
            ttlMs: COLLECTION_DOC_CACHE_TTL_MS,
          });
        }
        return list;
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'userCollections');
      }
    },
    { ttlMs: PUBLIC_COLLECTIONS_CACHE_TTL_MS }
  );
}

export async function getPublicCollectionsByOwner(
  ownerId: string,
  maxItems: number = 10
): Promise<UserCollection[]> {
  if (!ownerId) return [];
  const safeLimit = Math.min(Math.max(1, maxItems), 30);
  return getOrFetch(
    `publicCollectionsByOwner:${ownerId}:${safeLimit}`,
    async () => {
      const q = query(
        collection(db, 'userCollections'),
        where('ownerId', '==', ownerId),
        where('visibility', '==', 'public'),
        orderBy('updatedAt', 'desc'),
        limit(safeLimit)
      );
      try {
        const snap = await getDocs(q);
        return snap.docs.map((d) => mapDocToCollection(d.id, d.data()));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'userCollections');
      }
    },
    { ttlMs: PUBLIC_COLLECTIONS_CACHE_TTL_MS }
  );
}

export async function getCollectionById(
  collectionId: string
): Promise<UserCollection | null> {
  if (!collectionId) return null;
  const path = `userCollections/${collectionId}`;
  return getOrFetch(
    `collectionById:${collectionId}`,
    async () => {
      try {
        const snap = await getDoc(doc(db, 'userCollections', collectionId));
        if (!snap.exists()) return null;
        return mapDocToCollection(snap.id, snap.data());
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    },
    { ttlMs: COLLECTION_DOC_CACHE_TTL_MS }
  );
}

export async function createCollection(
  ownerId: string,
  input: CreateCollectionInput
): Promise<UserCollection> {
  if (!ownerId) {
    throw new Error('You must be signed in to create a collection.');
  }
  if (auth.currentUser && !auth.currentUser.emailVerified) {
    throw new Error(
      'Please verify your email address before creating a collection.'
    );
  }

  const titleErr = validateCollectionTitle(input.title);
  if (titleErr) throw new Error(titleErr);

  const descErr = validateCollectionDescription(input.description);
  if (descErr) throw new Error(descErr);

  const visErr = validateCollectionVisibility(input.visibility);
  if (visErr) throw new Error(visErr);

  const coverErr = validateOptionalHttpsUrl(
    input.coverImageUrl,
    1000,
    'Cover image URL'
  );
  if (coverErr) throw new Error(coverErr);

  if (input.items) {
    const countErr = validateCollectionItemsCount(input.items.length);
    if (countErr) throw new Error(countErr);
  }

  const profile = await getPublicProfile(ownerId).catch(() => null);
  const colRef = doc(collection(db, 'userCollections'));
  const collectionId = colRef.id;

  const now = new Date();
  const items = normalizeCollectionItems(input.items || [], now);

  const payload = {
    id: collectionId,
    ownerId,
    ownerUsername: profile?.username || 'member',
    ownerDisplayName: profile?.displayName || 'ATA Member',
    ownerAvatarUrl: profile?.avatarUrl || '',
    title: input.title.trim(),
    description: (input.description || '').trim(),
    coverImageUrl: (input.coverImageUrl || '').trim() || items[0]?.coverImage || '',
    visibility: input.visibility,
    items,
    itemCount: items.length,
    likeCount: 0,
    saveCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(colRef, payload);
    invalidateCacheKey(`userCollections:${ownerId}`);
    invalidateCachePrefix('publicCollections:');
    invalidateCachePrefix(`publicCollectionsByOwner:${ownerId}:`);
    return {
      ...payload,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `userCollections/${collectionId}`
    );
  }
}

export async function updateCollection(
  ownerId: string,
  collectionId: string,
  input: UpdateCollectionInput
): Promise<void> {
  if (!ownerId || !collectionId) return;

  const path = `userCollections/${collectionId}`;
  const colRef = doc(db, 'userCollections', collectionId);

  try {
    const snap = await getDoc(colRef);
    if (!snap.exists()) {
      throw new Error('Collection not found.');
    }
    const current = snap.data();
    if (current.ownerId !== ownerId) {
      throw new Error('You do not have permission to edit this collection.');
    }

    const updates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (typeof input.title === 'string') {
      const err = validateCollectionTitle(input.title);
      if (err) throw new Error(err);
      updates.title = input.title.trim();
    }

    if (typeof input.description === 'string') {
      const err = validateCollectionDescription(input.description);
      if (err) throw new Error(err);
      updates.description = input.description.trim();
    }

    if (input.visibility) {
      const err = validateCollectionVisibility(input.visibility);
      if (err) throw new Error(err);
      updates.visibility = input.visibility;
    }

    if (typeof input.coverImageUrl === 'string') {
      const err = validateOptionalHttpsUrl(
        input.coverImageUrl,
        1000,
        'Cover image URL'
      );
      if (err) throw new Error(err);
      updates.coverImageUrl = input.coverImageUrl.trim();
    }

    if (input.items) {
      const err = validateCollectionItemsCount(input.items.length);
      if (err) throw new Error(err);
      const normalized = normalizeCollectionItems(input.items, new Date());
      updates.items = normalized;
      updates.itemCount = normalized.length;
      if (
        updates.coverImageUrl === undefined &&
        !current.coverImageUrl &&
        normalized[0]?.coverImage
      ) {
        updates.coverImageUrl = normalized[0].coverImage;
      }
    }

    await updateDoc(colRef, updates);
    invalidateCacheKey(`collectionById:${collectionId}`);
    invalidateCacheKey(`userCollections:${ownerId}`);
    invalidateCachePrefix('publicCollections:');
    invalidateCachePrefix(`publicCollectionsByOwner:${ownerId}:`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addAnimeToExistingCollection(
  ownerId: string,
  collectionId: string,
  item: Omit<CollectionItem, 'addedAt' | 'position'>
): Promise<UserCollection> {
  if (!ownerId || !collectionId) {
    throw new Error('Collection and account IDs are required.');
  }

  const colRef = doc(db, 'userCollections', collectionId);
  const path = `userCollections/${collectionId}`;

  try {
    const snap = await getDoc(colRef);
    if (!snap.exists()) {
      throw new Error('Collection not found.');
    }
    const existingCol = mapDocToCollection(snap.id, snap.data());
    if (existingCol.ownerId !== ownerId) {
      throw new Error('You do not have permission to edit this collection.');
    }

    const updatedItems = addItemToCollectionList(existingCol.items, item);
    await updateDoc(colRef, {
      items: updatedItems,
      itemCount: updatedItems.length,
      coverImageUrl: existingCol.coverImageUrl || updatedItems[0]?.coverImage || '',
      updatedAt: serverTimestamp(),
    });

    invalidateCacheKey(`collectionById:${collectionId}`);
    invalidateCacheKey(`userCollections:${ownerId}`);
    invalidateCachePrefix('publicCollections:');
    invalidateCachePrefix(`publicCollectionsByOwner:${ownerId}:`);

    return {
      ...existingCol,
      items: updatedItems,
      itemCount: updatedItems.length,
      coverImageUrl: existingCol.coverImageUrl || updatedItems[0]?.coverImage || '',
      updatedAt: new Date(),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes('permission')
    ) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    throw error;
  }
}

export async function deleteCollection(
  ownerId: string,
  collectionId: string
): Promise<void> {
  if (!ownerId || !collectionId) return;
  const path = `userCollections/${collectionId}`;
  const colRef = doc(db, 'userCollections', collectionId);

  try {
    const snap = await getDoc(colRef);
    if (!snap.exists()) return;
    if (snap.data().ownerId !== ownerId) {
      throw new Error('You do not have permission to delete this collection.');
    }
    await deleteDoc(colRef);
    invalidateCacheKey(`collectionById:${collectionId}`);
    invalidateCacheKey(`userCollections:${ownerId}`);
    invalidateCachePrefix('publicCollections:');
    invalidateCachePrefix(`publicCollectionsByOwner:${ownerId}:`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getUserCollectionReactionState(
  userId: string,
  collectionId: string
): Promise<{ liked: boolean; saved: boolean }> {
  if (!userId || !collectionId) {
    return { liked: false, saved: false };
  }
  try {
    const [likeSnap, saveSnap] = await Promise.all([
      getDoc(doc(db, 'userCollections', collectionId, 'likes', userId)),
      getDoc(doc(db, 'userCollections', collectionId, 'saves', userId)),
    ]);
    return {
      liked: likeSnap.exists(),
      saved: saveSnap.exists(),
    };
  } catch {
    return { liked: false, saved: false };
  }
}

export async function toggleCollectionLike(
  userId: string,
  collectionId: string
): Promise<{ liked: boolean; likeCount: number }> {
  if (!userId || !collectionId) {
    throw new Error('Sign in to like collections.');
  }

  const colRef = doc(db, 'userCollections', collectionId);
  const likeRef = doc(db, 'userCollections', collectionId, 'likes', userId);
  const path = `userCollections/${collectionId}/likes/${userId}`;

  try {
    const result = await runTransaction(db, async (transaction) => {
      const colSnap = await transaction.get(colRef);
      if (!colSnap.exists()) {
        throw new Error('Collection not found.');
      }
      const data = colSnap.data();
      if (data.visibility !== 'public' && data.ownerId !== userId) {
        throw new Error('This collection is private.');
      }

      const likeSnap = await transaction.get(likeRef);
      const currentLikes = Number(data.likeCount || 0);

      if (likeSnap.exists()) {
        const nextLikes = Math.max(0, currentLikes - 1);
        transaction.delete(likeRef);
        transaction.update(colRef, { likeCount: nextLikes });
        return {
          liked: false,
          likeCount: nextLikes,
          ownerId: String(data.ownerId || ''),
        };
      } else {
        const nextLikes = currentLikes + 1;
        transaction.set(likeRef, {
          userId,
          collectionId,
          createdAt: serverTimestamp(),
        });
        transaction.update(colRef, { likeCount: nextLikes });
        return {
          liked: true,
          likeCount: nextLikes,
          ownerId: String(data.ownerId || ''),
        };
      }
    });
    invalidateCacheKey(`collectionById:${collectionId}`);
    invalidateCachePrefix('publicCollections:');
    if (result.ownerId) {
      invalidateCacheKey(`userCollections:${result.ownerId}`);
      invalidateCachePrefix(`publicCollectionsByOwner:${result.ownerId}:`);
    }
    return { liked: result.liked, likeCount: result.likeCount };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function toggleCollectionSave(
  userId: string,
  collectionId: string
): Promise<{ saved: boolean; saveCount: number }> {
  if (!userId || !collectionId) {
    throw new Error('Sign in to bookmark collections.');
  }

  const colRef = doc(db, 'userCollections', collectionId);
  const saveRef = doc(db, 'userCollections', collectionId, 'saves', userId);
  const path = `userCollections/${collectionId}/saves/${userId}`;

  try {
    const result = await runTransaction(db, async (transaction) => {
      const colSnap = await transaction.get(colRef);
      if (!colSnap.exists()) {
        throw new Error('Collection not found.');
      }
      const data = colSnap.data();
      if (data.visibility !== 'public' && data.ownerId !== userId) {
        throw new Error('This collection is private.');
      }

      const saveSnap = await transaction.get(saveRef);
      const currentSaves = Number(data.saveCount || 0);

      if (saveSnap.exists()) {
        const nextSaves = Math.max(0, currentSaves - 1);
        transaction.delete(saveRef);
        transaction.update(colRef, { saveCount: nextSaves });
        return {
          saved: false,
          saveCount: nextSaves,
          ownerId: String(data.ownerId || ''),
        };
      } else {
        const nextSaves = currentSaves + 1;
        transaction.set(saveRef, {
          userId,
          collectionId,
          createdAt: serverTimestamp(),
        });
        transaction.update(colRef, { saveCount: nextSaves });
        return {
          saved: true,
          saveCount: nextSaves,
          ownerId: String(data.ownerId || ''),
        };
      }
    });
    invalidateCacheKey(`collectionById:${collectionId}`);
    invalidateCachePrefix('publicCollections:');
    if (result.ownerId) {
      invalidateCacheKey(`userCollections:${result.ownerId}`);
      invalidateCachePrefix(`publicCollectionsByOwner:${result.ownerId}:`);
    }
    return { saved: result.saved, saveCount: result.saveCount };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function likeCollection(
  userId: string,
  collectionId: string
): Promise<void> {
  await toggleCollectionLike(userId, collectionId);
}
