import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { ATA_DATABASE_ID } from '../config';
import { db } from '../firebase';
import { dispatchNotification } from '../notificationLogic';

export const onCommunityJoinRequestWritten = onDocumentWritten(
  {
    document: 'communityJoinRequests/{requestId}',
    database: ATA_DATABASE_ID,
  },
  async (event) => {
    const requestId = event.params.requestId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after) return;

    const communityId = String(after.communityId || '');
    const requesterId = String(after.userId || '');
    if (!communityId || !requesterId) return;
    if (requestId !== `${communityId}__${requesterId}`) return;

    const commSnap = await db.collection('communities').doc(communityId).get();
    if (!commSnap.exists) return;
    const commData = commSnap.data() || {};
    const communityName =
      typeof commData.name === 'string' && commData.name.trim()
        ? commData.name
        : 'community';

    const ownerId = String(commData.ownerId || '');
    const moderatorIds = Array.isArray(commData.moderatorIds)
      ? commData.moderatorIds.map((v) => String(v))
      : [];

    // 1. New or re-submitted pending join request
    if ((!before || before.status !== 'pending') && after.status === 'pending') {
      if (commData.status !== 'active') return;

      const recipients = Array.from(new Set([ownerId, ...moderatorIds])).filter(
        (id) => id && id !== requesterId
      );

      await Promise.all(
        recipients.map((recipientId) =>
          dispatchNotification(db, {
            recipientId,
            actorId: requesterId,
            type: 'join_request',
            category: 'communities',
            title: 'Community Join Request',
            body: `Requested to join ${communityName}.`,
            targetType: 'community',
            targetId: communityId,
            route: `/communities/${communityId}`,
            dedupeKey: `joinreq_${requestId}_${event.id}`,
            metadata: {
              communityId,
              requestId,
              tab: 'manage',
            },
          })
        )
      );
      return;
    }

    // 2. Join request approved
    if (before?.status === 'pending' && after.status === 'approved') {
      const reviewerId = String(after.reviewedBy || '');
      const validReviewer =
        reviewerId &&
        (reviewerId === ownerId || moderatorIds.includes(reviewerId));
      if (!validReviewer) return;

      const membershipSnap = await db
        .collection('communityMemberships')
        .doc(`${communityId}__${requesterId}`)
        .get();
      if (!membershipSnap.exists) return;

      await dispatchNotification(db, {
        recipientId: requesterId,
        actorId: reviewerId,
        type: 'approve_request',
        category: 'communities',
        title: 'Membership Approved',
        body: `Your membership request for ${communityName} was approved.`,
        targetType: 'community',
        targetId: communityId,
        route: `/communities/${communityId}`,
        dedupeKey: `appreq_${requestId}_${event.id}`,
        metadata: {
          communityId,
          requestId,
        },
      });
      return;
    }

    // 3. Join request rejected
    if (before?.status === 'pending' && after.status === 'rejected') {
      const reviewerId = String(after.reviewedBy || '');
      const validReviewer =
        reviewerId &&
        (reviewerId === ownerId || moderatorIds.includes(reviewerId));
      if (!validReviewer) return;

      await dispatchNotification(db, {
        recipientId: requesterId,
        actorId: reviewerId,
        type: 'decline_request',
        category: 'communities',
        title: 'Membership Declined',
        body: `Your membership request for ${communityName} was declined.`,
        targetType: 'community',
        targetId: communityId,
        route: `/communities/${communityId}`,
        dedupeKey: `decreq_${requestId}_${event.id}`,
        metadata: {
          communityId,
          requestId,
        },
      });
    }
  }
);
