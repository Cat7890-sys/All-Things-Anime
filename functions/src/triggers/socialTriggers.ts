import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { ATA_DATABASE_ID } from '../config';
import { db } from '../firebase';
import {
  dispatchNotification,
  isPrivateCommunityMember,
} from '../notificationLogic';

async function handlePostReactionCreated(params: {
  postId: string;
  userId: string;
  reactionData: Record<string, unknown> | undefined;
  eventId: string;
  communityId?: string;
}): Promise<void> {
  const { postId, userId, reactionData, eventId, communityId } = params;
  if (!postId || !userId || !reactionData) return;
  if (reactionData.uid !== userId || reactionData.type !== 'like') return;

  const postRef = communityId
    ? db.collection('communities').doc(communityId).collection('posts').doc(postId)
    : db.collection('posts').doc(postId);

  const postSnap = await postRef.get();
  if (!postSnap.exists) return;

  const postAuthorId = String(postSnap.data()?.authorId || '');
  if (!postAuthorId || postAuthorId === userId) return;

  if (communityId) {
    const allowed = await isPrivateCommunityMember(db, communityId, postAuthorId);
    if (!allowed) return;
  }

  const route = communityId
    ? `/communities/${communityId}?postId=${postId}`
    : `/?postId=${postId}`;

  const metadata: Record<string, string> = { postId };
  if (communityId) {
    metadata.communityId = communityId;
  }

  await dispatchNotification(db, {
    recipientId: postAuthorId,
    actorId: userId,
    type: 'like_post',
    category: 'social',
    title: 'New Like',
    body: 'Liked your post.',
    targetType: 'post',
    targetId: postId,
    route,
    dedupeKey: `like_${postId}_${userId}_${eventId}`,
    metadata,
  });
}

async function handleCommentCreated(params: {
  postId: string;
  commentId: string;
  commentData: Record<string, unknown> | undefined;
  communityId?: string;
}): Promise<void> {
  const { postId, commentId, commentData, communityId } = params;
  if (!postId || !commentId || !commentData) return;

  const actorId = String(commentData.authorId || '');
  if (!actorId || commentData.postId !== postId) return;

  const postRef = communityId
    ? db.collection('communities').doc(communityId).collection('posts').doc(postId)
    : db.collection('posts').doc(postId);

  const postSnap = await postRef.get();
  if (!postSnap.exists) return;

  const postAuthorId = String(postSnap.data()?.authorId || '');
  const route = communityId
    ? `/communities/${communityId}?postId=${postId}`
    : `/?postId=${postId}`;

  const baseMetadata: Record<string, string> = { postId, commentId };
  if (communityId) {
    baseMetadata.communityId = communityId;
  }

  if (postAuthorId && postAuthorId !== actorId) {
    const allowed = communityId
      ? await isPrivateCommunityMember(db, communityId, postAuthorId)
      : true;
    if (allowed) {
      await dispatchNotification(db, {
        recipientId: postAuthorId,
        actorId,
        type: 'comment_post',
        category: 'social',
        title: 'New Comment',
        body: 'Commented on your discussion.',
        targetType: 'post',
        targetId: postId,
        route,
        dedupeKey: `comment_${commentId}`,
        metadata: baseMetadata,
      });
    }
  }

  const parentCommentId =
    typeof commentData.parentCommentId === 'string'
      ? commentData.parentCommentId.trim()
      : '';

  if (parentCommentId) {
    const parentSnap = await postRef
      .collection('comments')
      .doc(parentCommentId)
      .get();

    if (parentSnap.exists) {
      const parentAuthorId = String(parentSnap.data()?.authorId || '');
      if (
        parentAuthorId &&
        parentAuthorId !== actorId &&
        parentAuthorId !== postAuthorId
      ) {
        const allowed = communityId
          ? await isPrivateCommunityMember(db, communityId, parentAuthorId)
          : true;
        if (allowed) {
          await dispatchNotification(db, {
            recipientId: parentAuthorId,
            actorId,
            type: 'reply_comment',
            category: 'social',
            title: 'New Reply',
            body: 'Replied to your comment.',
            targetType: 'comment',
            targetId: postId,
            route,
            dedupeKey: `reply_${commentId}`,
            metadata: {
              ...baseMetadata,
              parentCommentId,
            },
          });
        }
      }
    }
  }
}

export const onPostLikeCreated = onDocumentCreated(
  {
    document: 'posts/{postId}/reactions/{userId}',
    database: ATA_DATABASE_ID,
  },
  async (event) => {
    await handlePostReactionCreated({
      postId: event.params.postId,
      userId: event.params.userId,
      reactionData: event.data?.data(),
      eventId: event.id,
    });
  }
);

export const onCommunityPostLikeCreated = onDocumentCreated(
  {
    document: 'communities/{communityId}/posts/{postId}/reactions/{userId}',
    database: ATA_DATABASE_ID,
  },
  async (event) => {
    await handlePostReactionCreated({
      postId: event.params.postId,
      userId: event.params.userId,
      reactionData: event.data?.data(),
      eventId: event.id,
      communityId: event.params.communityId,
    });
  }
);

export const onPostCommentCreated = onDocumentCreated(
  {
    document: 'posts/{postId}/comments/{commentId}',
    database: ATA_DATABASE_ID,
  },
  async (event) => {
    await handleCommentCreated({
      postId: event.params.postId,
      commentId: event.params.commentId,
      commentData: event.data?.data(),
    });
  }
);

export const onCommunityPostCommentCreated = onDocumentCreated(
  {
    document: 'communities/{communityId}/posts/{postId}/comments/{commentId}',
    database: ATA_DATABASE_ID,
  },
  async (event) => {
    await handleCommentCreated({
      postId: event.params.postId,
      commentId: event.params.commentId,
      commentData: event.data?.data(),
      communityId: event.params.communityId,
    });
  }
);

export const onFollowCreated = onDocumentCreated(
  {
    document: 'follows/{followId}',
    database: ATA_DATABASE_ID,
  },
  async (event) => {
    const followId = event.params.followId;
    const data = event.data?.data();
    if (!data) return;

    const followerId = String(data.followerId || '');
    const followingId = String(data.followingId || '');
    if (!followerId || !followingId || followerId === followingId) return;
    if (followId !== `${followerId}__${followingId}`) return;

    await dispatchNotification(db, {
      recipientId: followingId,
      actorId: followerId,
      type: 'new_follower',
      category: 'followers',
      title: 'New Follower',
      body: 'Started following you.',
      targetType: 'profile',
      targetId: followerId,
      route: `/profile/${followerId}`,
      dedupeKey: `follow_${followId}_${event.id}`,
      metadata: {
        followerId,
      },
    });
  }
);
