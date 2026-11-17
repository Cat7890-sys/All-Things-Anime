import {
  onDocumentCreated,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import { ATA_DATABASE_ID } from '../config';
import { db } from '../firebase';
import {
  buildNeutralMessagingCopy,
  dispatchNotification,
  isConversationMuted,
} from '../notificationLogic';

function isTimestampEqual(a: unknown, b: unknown): boolean {
  if (!a || !b) return false;
  const tsA = a as { isEqual?: (other: unknown) => boolean; seconds?: number; nanoseconds?: number };
  const tsB = b as { seconds?: number; nanoseconds?: number };
  if (typeof tsA.isEqual === 'function') {
    return tsA.isEqual(b);
  }
  return (
    typeof tsA.seconds === 'number' &&
    typeof tsB.seconds === 'number' &&
    tsA.seconds === tsB.seconds &&
    tsA.nanoseconds === tsB.nanoseconds
  );
}

export const onMessageRequestWritten = onDocumentWritten(
  {
    document: 'messageRequests/{requestId}',
    database: ATA_DATABASE_ID,
  },
  async (event) => {
    const requestId = event.params.requestId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after) return;

    const senderId = String(after.senderId || '');
    const recipientId = String(after.recipientId || '');
    if (!senderId || !recipientId || senderId === recipientId) return;
    if (requestId !== `${senderId}__${recipientId}`) return;

    // 1. New or re-submitted pending message request (never leak initialMessage)
    if ((!before || before.status !== 'pending') && after.status === 'pending') {
      const copy = buildNeutralMessagingCopy('new_message_request');
      await dispatchNotification(db, {
        recipientId,
        actorId: senderId,
        type: 'new_message_request',
        category: 'messaging',
        title: copy.title,
        body: copy.body,
        targetType: 'message_request',
        targetId: requestId,
        route: '/messages?tab=requests',
        dedupeKey: `msgreq_${requestId}_${event.id}`,
        metadata: {
          requestId,
          tab: 'requests',
        },
      });
      return;
    }

    // 2. Accepted message request
    if (before?.status === 'pending' && after.status === 'accepted') {
      const conversationId = String(after.conversationId || '');
      if (!conversationId) return;

      const convSnap = await db.collection('conversations').doc(conversationId).get();
      if (!convSnap.exists) return;

      const copy = buildNeutralMessagingCopy('accepted_message_request');
      await dispatchNotification(db, {
        recipientId: senderId,
        actorId: recipientId,
        type: 'accepted_message_request',
        category: 'messaging',
        title: copy.title,
        body: copy.body,
        targetType: 'conversation',
        targetId: conversationId,
        route: `/messages/${conversationId}`,
        dedupeKey: `msgacc_${requestId}_${event.id}`,
        metadata: {
          conversationId,
          requestId,
        },
      });
    }
  }
);

export const onConversationMessageCreated = onDocumentCreated(
  {
    document: 'conversations/{conversationId}/messages/{messageId}',
    database: ATA_DATABASE_ID,
  },
  async (event) => {
    const { conversationId, messageId } = event.params;
    const msg = event.data?.data();
    if (!msg) return;

    // System messages are handled via group membership notifications
    if (msg.messageType !== 'text') return;

    const senderId = String(msg.senderId || '');
    if (!senderId || msg.conversationId !== conversationId) return;

    const convSnap = await db.collection('conversations').doc(conversationId).get();
    if (!convSnap.exists) return;
    const conv = convSnap.data() || {};

    if (conv.status !== 'active') return;
    const participantIds = Array.isArray(conv.participantIds)
      ? conv.participantIds.map((v) => String(v))
      : [];
    if (!participantIds.includes(senderId)) return;

    const isGroup = conv.type === 'group';
    const recipients = participantIds.filter((id) => id && id !== senderId);
    if (recipients.length === 0) return;

    // Avoid sending a redundant "new direct message" alert for the initial request message
    // copied atomically into the conversation when the recipient clicks Accept.
    if (
      !isGroup &&
      recipients.length === 1 &&
      isTimestampEqual(conv.createdAt, msg.createdAt)
    ) {
      const peerId = recipients[0];
      const reqSnap = await db
        .collection('messageRequests')
        .doc(`${senderId}__${peerId}`)
        .get();
      if (
        reqSnap.exists &&
        reqSnap.data()?.status === 'accepted' &&
        reqSnap.data()?.conversationId === conversationId
      ) {
        return;
      }
    }

    const notifType = isGroup ? 'new_group_message' : 'new_direct_message';
    const copy = buildNeutralMessagingCopy(notifType);

    await Promise.all(
      recipients.map(async (recipientId) => {
        const muted = await isConversationMuted(
          db,
          conversationId,
          recipientId,
          isGroup
        );
        if (muted) return;

        await dispatchNotification(db, {
          recipientId,
          actorId: senderId,
          type: notifType,
          category: isGroup ? 'groups' : 'messaging',
          title: copy.title,
          body: copy.body,
          targetType: isGroup ? 'group' : 'conversation',
          targetId: conversationId,
          route: `/messages/${conversationId}`,
          dedupeKey: `msg_${conversationId}_${messageId}`,
          metadata: {
            conversationId,
            messageId,
          },
        });
      })
    );
  }
);

export const onGroupConversationMembershipWritten = onDocumentWritten(
  {
    document: 'conversations/{conversationId}',
    database: ATA_DATABASE_ID,
  },
  async (event) => {
    const conversationId = event.params.conversationId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!after || after.type !== 'group') return;

    const ownerId = String(after.ownerId || '');
    const afterParticipants = Array.isArray(after.participantIds)
      ? after.participantIds.map((v) => String(v))
      : [];
    const afterAdmins = Array.isArray(after.adminIds)
      ? after.adminIds.map((v) => String(v))
      : [];

    // 1. Newly created group: notify invited members
    if (!before) {
      if (!ownerId) return;
      const copy = buildNeutralMessagingCopy('group_added');
      const invited = afterParticipants.filter((id) => id && id !== ownerId);

      await Promise.all(
        invited.map(async (recipientId) => {
          const muted = await isConversationMuted(
            db,
            conversationId,
            recipientId,
            true
          );
          if (muted) return;

          await dispatchNotification(db, {
            recipientId,
            actorId: ownerId,
            type: 'group_added',
            category: 'groups',
            title: copy.title,
            body: copy.body,
            targetType: 'group',
            targetId: conversationId,
            route: `/messages/${conversationId}`,
            dedupeKey: `grpadd_${conversationId}_${event.id}`,
            metadata: {
              conversationId,
            },
          });
        })
      );
      return;
    }

    if (before.type !== 'group') return;

    const beforeParticipants = new Set(
      Array.isArray(before.participantIds)
        ? before.participantIds.map((v) => String(v))
        : []
    );
    const afterParticipantSet = new Set(afterParticipants);
    const beforeAdminSet = new Set(
      Array.isArray(before.adminIds) ? before.adminIds.map((v) => String(v)) : []
    );

    const lastSenderId = String(after.lastMessageSenderId || '');
    const adminActorId = beforeAdminSet.has(lastSenderId)
      ? lastSenderId
      : ownerId;

    // 2. Added members
    const addedMembers = afterParticipants.filter(
      (id) => id && !beforeParticipants.has(id)
    );
    if (addedMembers.length > 0 && adminActorId) {
      const copy = buildNeutralMessagingCopy('group_added');
      await Promise.all(
        addedMembers.map(async (recipientId) => {
          const muted = await isConversationMuted(
            db,
            conversationId,
            recipientId,
            true
          );
          if (muted) return;

          await dispatchNotification(db, {
            recipientId,
            actorId: adminActorId,
            type: 'group_added',
            category: 'groups',
            title: copy.title,
            body: copy.body,
            targetType: 'group',
            targetId: conversationId,
            route: `/messages/${conversationId}`,
            dedupeKey: `grpadd_${conversationId}_${event.id}`,
            metadata: {
              conversationId,
            },
          });
        })
      );
    }

    // 3. Removed members (only notify when removed by an admin/owner, not self-leave)
    const removedMembers = Array.from(beforeParticipants).filter(
      (id) => id && !afterParticipantSet.has(id)
    );
    if (removedMembers.length > 0 && adminActorId) {
      const copy = buildNeutralMessagingCopy('group_removed');
      await Promise.all(
        removedMembers.map(async (recipientId) => {
          // If member left voluntarily (lastMessageSenderId === recipientId), do not notify
          if (lastSenderId === recipientId) return;

          await dispatchNotification(db, {
            recipientId,
            actorId: adminActorId,
            type: 'group_removed',
            category: 'groups',
            title: copy.title,
            body: copy.body,
            targetType: 'conversation',
            targetId: '',
            route: '/messages',
            dedupeKey: `grprem_${conversationId}_${event.id}`,
            metadata: {
              conversationId,
            },
          });
        })
      );
    }

    // 4. Newly promoted admins (only group owner can promote admins)
    const promotedAdmins = afterAdmins.filter(
      (id) => id && !beforeAdminSet.has(id) && afterParticipantSet.has(id)
    );
    if (promotedAdmins.length > 0 && ownerId) {
      const copy = buildNeutralMessagingCopy('group_admin_promote');
      await Promise.all(
        promotedAdmins.map(async (recipientId) => {
          const muted = await isConversationMuted(
            db,
            conversationId,
            recipientId,
            true
          );
          if (muted) return;

          await dispatchNotification(db, {
            recipientId,
            actorId: ownerId,
            type: 'group_admin_promote',
            category: 'groups',
            title: copy.title,
            body: copy.body,
            targetType: 'group',
            targetId: conversationId,
            route: `/messages/${conversationId}`,
            dedupeKey: `grpprom_${conversationId}_${event.id}`,
            metadata: {
              conversationId,
            },
          });
        })
      );
    }
  }
);
