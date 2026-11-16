import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  AtaComment,
  AtaUserAccount,
  CreateCommentInput,
} from '../types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { validateCommentContent } from './validation';

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return null;
}

function mapDocToComment(
  id: string,
  data: Record<string, unknown>
): AtaComment {
  return {
    id,
    postId: String(data.postId || ''),
    authorId: String(data.authorId || ''),
    authorUsername: String(data.authorUsername || ''),
    authorDisplayName: String(data.authorDisplayName || 'ATA Member'),
    authorAvatarUrl:
      typeof data.authorAvatarUrl === 'string' ? data.authorAvatarUrl : '',
    content: String(data.content || ''),
    parentCommentId:
      typeof data.parentCommentId === 'string' ? data.parentCommentId : '',
    replyToAuthorUsername:
      typeof data.replyToAuthorUsername === 'string'
        ? data.replyToAuthorUsername
        : '',
    hasSpoiler: Boolean(data.hasSpoiler),
    isEdited: Boolean(data.isEdited),
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function subscribeToPostComments(
  postId: string,
  onComments: (comments: AtaComment[]) => void,
  onError: (message: string) => void
): Unsubscribe {
  const path = `posts/${postId}/comments`;
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc'),
    limit(150)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      onComments(snapshot.docs.map((d) => mapDocToComment(d.id, d.data())));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        onError(
          err instanceof Error ? err.message : 'Unable to load comments.'
        );
      }
    }
  );
}

export async function createComment(
  postId: string,
  authorProfile: AtaUserAccount,
  input: CreateCommentInput
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== authorProfile.uid) {
    throw new Error('Please sign in to post a comment.');
  }
  if (!currentUser.emailVerified) {
    throw new Error('Please verify your email address before commenting.');
  }

  const contentError = validateCommentContent(input.content);
  if (contentError) {
    throw new Error(contentError);
  }

  await currentUser.getIdToken(true);

  const postRef = doc(db, 'posts', postId);
  const commentRef = doc(collection(db, 'posts', postId, 'comments'));
  const rateLimitRef = doc(db, 'commentRateLimits', currentUser.uid);

  try {
    await runTransaction(db, async (transaction) => {
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) {
        throw new Error('This post no longer exists.');
      }

      const currentCount =
        typeof postSnap.data().commentCount === 'number'
          ? postSnap.data().commentCount
          : 0;
      const now = serverTimestamp();

      transaction.set(rateLimitRef, {
        uid: currentUser.uid,
        lastCommentAt: now,
      });

      transaction.set(commentRef, {
        id: commentRef.id,
        postId,
        authorId: currentUser.uid,
        authorUsername: authorProfile.username,
        authorDisplayName: authorProfile.displayName,
        authorAvatarUrl: authorProfile.avatarUrl,
        content: input.content.trim(),
        parentCommentId: input.parentCommentId || '',
        replyToAuthorUsername: input.replyToAuthorUsername || '',
        hasSpoiler: Boolean(input.hasSpoiler),
        isEdited: false,
        createdAt: now,
        updatedAt: now,
      });

      transaction.update(postRef, {
        commentCount: currentCount + 1,
      });
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
      try {
        const rateSnap = await getDoc(rateLimitRef);
        if (rateSnap.exists()) {
          const lastAt = toDateOrNull(rateSnap.data().lastCommentAt);
          if (lastAt && Date.now() - lastAt.getTime() < 5000) {
            throw new Error(
              'Please wait a few seconds before posting another comment.'
            );
          }
        }
      } catch (cooldownErr) {
        if (
          cooldownErr instanceof Error &&
          cooldownErr.message.includes('wait a few seconds')
        ) {
          throw cooldownErr;
        }
      }
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `posts/${postId}/comments/${commentRef.id}`
      );
    }
    throw error;
  }
}

export async function updateComment(
  postId: string,
  commentId: string,
  content: string,
  hasSpoiler: boolean
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Verified authentication is required to edit comments.');
  }

  const contentError = validateCommentContent(content);
  if (contentError) {
    throw new Error(contentError);
  }

  await currentUser.getIdToken(true);

  const path = `posts/${postId}/comments/${commentId}`;
  try {
    await updateDoc(doc(db, 'posts', postId, 'comments', commentId), {
      content: content.trim(),
      hasSpoiler: Boolean(hasSpoiler),
      isEdited: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteComment(
  postId: string,
  commentId: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Verified authentication is required to delete comments.');
  }

  await currentUser.getIdToken(true);

  const path = `posts/${postId}/comments/${commentId}`;
  try {
    await runTransaction(db, async (transaction) => {
      const postRef = doc(db, 'posts', postId);
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);

      const [postSnap, commentSnap] = await Promise.all([
        transaction.get(postRef),
        transaction.get(commentRef),
      ]);

      if (!commentSnap.exists()) return;

      transaction.delete(commentRef);

      if (postSnap.exists()) {
        const currentCount =
          typeof postSnap.data().commentCount === 'number'
            ? postSnap.data().commentCount
            : 0;
        transaction.update(postRef, {
          commentCount: Math.max(0, currentCount - 1),
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
