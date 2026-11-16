import { createNotification } from './notifications/notificationEventService';
import {
  collection,
  deleteDoc,
  doc,
  type DocumentData,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import type {
  AtaPost,
  AtaUserAccount,
  CreatePostInput,
  UpdatePostInput,
} from '../types';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  storage,
} from './firebase';
import { validatePostForm } from './validation';

export interface PaginatedPostsResult {
  posts: AtaPost[];
  lastCursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return null;
}

function mapDocToPost(
  id: string,
  data: Record<string, unknown>
): AtaPost {
  return {
    id,
    authorId: String(data.authorId || ''),
    authorUsername: String(data.authorUsername || ''),
    authorDisplayName: String(data.authorDisplayName || 'ATA Member'),
    authorAvatarUrl:
      typeof data.authorAvatarUrl === 'string' ? data.authorAvatarUrl : '',
    content: String(data.content || ''),
    animeTitle: typeof data.animeTitle === 'string' ? data.animeTitle : '',
    hasSpoiler: Boolean(data.hasSpoiler),
    spoilerLabel:
      typeof data.spoilerLabel === 'string' ? data.spoilerLabel : '',
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
    imagePath: typeof data.imagePath === 'string' ? data.imagePath : '',
    likeCount: typeof data.likeCount === 'number' ? data.likeCount : 0,
    commentCount: typeof data.commentCount === 'number' ? data.commentCount : 0,
    isEdited: Boolean(data.isEdited),
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.slice(0, 80) || 'upload.jpg';
}

function getPostsCollection(communityId?: string) {
  return communityId
    ? collection(db, 'communities', communityId, 'posts')
    : collection(db, 'posts');
}

function getPostDocRef(postId: string, communityId?: string) {
  return communityId
    ? doc(db, 'communities', communityId, 'posts', postId)
    : doc(db, 'posts', postId);
}

function getPostCollectionPath(communityId?: string): string {
  return communityId ? `communities/${communityId}/posts` : 'posts';
}

export function subscribeToCommunityPosts(
  pageSize: number,
  onPosts: (result: PaginatedPostsResult) => void,
  onError: (message: string) => void,
  communityId?: string
): Unsubscribe {
  const path = getPostCollectionPath(communityId);
  const q = query(
    getPostsCollection(communityId),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const posts = snapshot.docs.map((d) => mapDocToPost(d.id, d.data()));
      const lastCursor =
        snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1]
          : null;
      onPosts({
        posts,
        lastCursor,
        hasMore: snapshot.docs.length === pageSize,
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        onError(
          err instanceof Error
            ? err.message
            : 'Unable to load community posts.'
        );
      }
    }
  );
}

export async function fetchMoreCommunityPosts(
  cursor: QueryDocumentSnapshot<DocumentData>,
  pageSize: number,
  communityId?: string
): Promise<PaginatedPostsResult> {
  const path = getPostCollectionPath(communityId);
  try {
    const q = query(
      getPostsCollection(communityId),
      orderBy('createdAt', 'desc'),
      startAfter(cursor),
      limit(pageSize)
    );
    const snapshot = await getDocs(q);
    const posts = snapshot.docs.map((d) => mapDocToPost(d.id, d.data()));
    const lastCursor =
      snapshot.docs.length > 0
        ? snapshot.docs[snapshot.docs.length - 1]
        : null;
    return {
      posts,
      lastCursor,
      hasMore: snapshot.docs.length === pageSize,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchFollowingPosts(
  followingIds: string[],
  pageSize: number,
  cursor: QueryDocumentSnapshot<DocumentData> | null = null
): Promise<PaginatedPostsResult> {
  if (followingIds.length === 0) {
    return { posts: [], lastCursor: null, hasMore: false };
  }

  // Firestore 'in' queries accept up to 30 UIDs cleanly
  const targetIds = followingIds.slice(0, 30);

  try {
    const q = cursor
      ? query(
          collection(db, 'posts'),
          where('authorId', 'in', targetIds),
          orderBy('createdAt', 'desc'),
          startAfter(cursor),
          limit(pageSize)
        )
      : query(
          collection(db, 'posts'),
          where('authorId', 'in', targetIds),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
    const snapshot = await getDocs(q);
    const posts = snapshot.docs.map((d) => mapDocToPost(d.id, d.data()));
    const lastCursor =
      snapshot.docs.length > 0
        ? snapshot.docs[snapshot.docs.length - 1]
        : null;
    return {
      posts,
      lastCursor,
      hasMore: snapshot.docs.length === pageSize,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'posts');
  }
}

export async function fetchPostsByAuthor(
  authorId: string,
  pageSize = 10,
  cursor: QueryDocumentSnapshot<DocumentData> | null = null
): Promise<PaginatedPostsResult> {
  try {
    const q = cursor
      ? query(
          collection(db, 'posts'),
          where('authorId', '==', authorId),
          orderBy('createdAt', 'desc'),
          startAfter(cursor),
          limit(pageSize)
        )
      : query(
          collection(db, 'posts'),
          where('authorId', '==', authorId),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
    const snapshot = await getDocs(q);
    const posts = snapshot.docs.map((d) => mapDocToPost(d.id, d.data()));
    const lastCursor =
      snapshot.docs.length > 0
        ? snapshot.docs[snapshot.docs.length - 1]
        : null;
    return {
      posts,
      lastCursor,
      hasMore: snapshot.docs.length === pageSize,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'posts');
  }
}

export async function createPost(
  authorProfile: AtaUserAccount,
  input: CreatePostInput,
  communityId?: string
): Promise<AtaPost> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== authorProfile.uid) {
    throw new Error('You must be signed in to publish a post.');
  }
  if (!currentUser.emailVerified) {
    throw new Error('Please verify your email address before posting.');
  }

  const validationError = validatePostForm(input);
  if (validationError) {
    throw new Error(validationError);
  }

  await currentUser.getIdToken(true);

  const postRef = doc(getPostsCollection(communityId));
  const postId = postRef.id;

  let uploadedImageUrl = '';
  let uploadedImagePath = '';

  if (input.imageFile) {
    if (!storage) {
      throw new Error(
        'Firebase Storage is not configured in this project. You can still publish text posts.'
      );
    }
    const safeName = sanitizeFilename(input.imageFile.name);
    uploadedImagePath = `posts/${currentUser.uid}/${postId}/${safeName}`;
    const storageRef = ref(storage, uploadedImagePath);
    try {
      await uploadBytes(storageRef, input.imageFile, {
        contentType: input.imageFile.type,
      });
      uploadedImageUrl = await getDownloadURL(storageRef);
    } catch (uploadError) {
      const code =
        typeof uploadError === 'object' &&
        uploadError !== null &&
        'code' in uploadError
          ? String((uploadError as { code: unknown }).code)
          : '';
      if (code.includes('storage/unauthorized') || code.includes('storage/unknown')) {
        throw new Error(
          'Image upload failed because Firebase Storage rules or bucket activation may not be completed in Firebase Console yet. Try publishing without an image or enable Storage.'
        );
      }
      throw new Error('Unable to upload image. Please check the file and try again.');
    }
  }

  const trimmedContent = input.content.trim();
  const trimmedAnime = input.animeTitle.trim();
  const trimmedSpoilerLabel = input.hasSpoiler ? input.spoilerLabel.trim() : '';

  try {
    await runTransaction(db, async (transaction) => {
      const rateLimitRef = doc(db, 'postRateLimits', currentUser.uid);
      const now = serverTimestamp();

      transaction.set(rateLimitRef, {
        uid: currentUser.uid,
        lastPostAt: now,
      });

      transaction.set(postRef, {
        id: postId,
        authorId: currentUser.uid,
        authorUsername: authorProfile.username,
        authorDisplayName: authorProfile.displayName,
        authorAvatarUrl: authorProfile.avatarUrl,
        content: trimmedContent,
        animeTitle: trimmedAnime,
        hasSpoiler: Boolean(input.hasSpoiler),
        spoilerLabel: trimmedSpoilerLabel,
        imageUrl: uploadedImageUrl,
        imagePath: uploadedImagePath,
        likeCount: 0,
        commentCount: 0,
        isEdited: false,
        createdAt: now,
        updatedAt: now,
      });
    });

    const createdSnap = await getDoc(postRef);
    if (!createdSnap.exists()) {
      throw new Error('Post was saved but could not be reloaded.');
    }
    return mapDocToPost(createdSnap.id, createdSnap.data());
  } catch (error) {
    // Clean up uploaded image if Firestore write failed
    if (uploadedImagePath && storage) {
      try {
        await deleteObject(ref(storage, uploadedImagePath));
      } catch {
        // Ignore cleanup failure
      }
    }

    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
      // Surface friendly rate-limit hint if user recently posted
      try {
        const rateSnap = await getDoc(doc(db, 'postRateLimits', currentUser.uid));
        if (rateSnap.exists()) {
          const lastAt = toDateOrNull(rateSnap.data().lastPostAt);
          if (lastAt && Date.now() - lastAt.getTime() < 11000) {
            throw new Error(
              'You are posting too quickly. Please wait 10 seconds before publishing another post.'
            );
          }
        }
      } catch (cooldownErr) {
        if (
          cooldownErr instanceof Error &&
          cooldownErr.message.includes('10 seconds')
        ) {
          throw cooldownErr;
        }
      }
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `${getPostCollectionPath(communityId)}/${postId}`
      );
    }
    throw error;
  }
}

export async function updatePost(
  postId: string,
  input: UpdatePostInput,
  communityId?: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Verified authentication is required to edit posts.');
  }

  const validationError = validatePostForm(input);
  if (validationError) {
    throw new Error(validationError);
  }

  await currentUser.getIdToken(true);

  const path = `${getPostCollectionPath(communityId)}/${postId}`;
  try {
    await updateDoc(getPostDocRef(postId, communityId), {
      content: input.content.trim(),
      animeTitle: input.animeTitle.trim(),
      hasSpoiler: Boolean(input.hasSpoiler),
      spoilerLabel: input.hasSpoiler ? input.spoilerLabel.trim() : '',
      isEdited: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePost(
  postId: string,
  imagePath?: string,
  communityId?: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Verified authentication is required to delete posts.');
  }

  await currentUser.getIdToken(true);

  const path = `${getPostCollectionPath(communityId)}/${postId}`;
  try {
    await deleteDoc(getPostDocRef(postId, communityId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }

  if (imagePath && storage) {
    try {
      await deleteObject(ref(storage, imagePath));
    } catch {
      // Best-effort storage cleanup
    }
  }
}

export async function getUserLikedPostMap(
  postIds: string[],
  uid: string,
  communityId?: string
): Promise<Record<string, boolean>> {
  const entries = await Promise.all(
    postIds.map(async (postId) => {
      try {
        const snap = await getDoc(
          doc(getPostDocRef(postId, communityId), 'reactions', uid)
        );
        return [postId, snap.exists()] as const;
      } catch {
        return [postId, false] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}

export async function togglePostLike(
  postId: string,
  uid: string,
  communityId?: string
): Promise<{ liked: boolean; likeCount: number }> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    throw new Error('Please sign in to react to posts.');
  }
  if (!currentUser.emailVerified) {
    throw new Error('Please verify your email address before reacting to posts.');
  }

  await currentUser.getIdToken(true);

  const path = `${getPostCollectionPath(communityId)}/${postId}/reactions/${uid}`;
  try {
    return await runTransaction(db, async (transaction) => {
      const postRef = getPostDocRef(postId, communityId);
      const reactionRef = doc(postRef, 'reactions', uid);

      const [postSnap, reactionSnap] = await Promise.all([
        transaction.get(postRef),
        transaction.get(reactionRef),
      ]);

      if (!postSnap.exists()) {
        throw new Error('This post no longer exists.');
      }

      const currentLikes =
        typeof postSnap.data().likeCount === 'number'
          ? postSnap.data().likeCount
          : 0;

      if (reactionSnap.exists()) {
        const nextCount = Math.max(0, currentLikes - 1);
        transaction.delete(reactionRef);
        transaction.update(postRef, { likeCount: nextCount });
        return { liked: false, likeCount: nextCount };
      }

      const nextCount = currentLikes + 1;
      transaction.set(reactionRef, {
        uid,
        type: 'like',
        createdAt: serverTimestamp(),
      });
      transaction.update(postRef, { likeCount: nextCount });
      const authorId = String(postSnap.data().authorId || '');
      if (authorId && authorId !== uid) {
        void createNotification({
          recipientId: authorId,
          actorId: uid,
          type: 'like_post',
          category: 'social',
          title: 'New Like',
          body: 'Someone liked your post.',
          targetType: 'post',
          targetId: postId,
          route: `/?postId=${postId}`,
          dedupeKey: `like_${postId}_${uid}`,
        });
      }
      return { liked: true, likeCount: nextCount };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
