import {
  collection,
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
  type Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import type {
  AtaConversation,
  AtaMessage,
  AtaUserAccount,
} from '../../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { checkBlockBetween } from '../socialGraphService';
import {
  canEditMessageWithinWindow,
  validateMessageText,
} from '../validation';
import {
  mapDocToMessage,
  requireVerifiedMessagingUser,
  toDateOrNull,
} from './messagingUtils';
import { emitMessagingNotificationEvent } from './notificationBoundaryService';
import { setTypingState } from './typingService';

export interface PaginatedMessagesResult {
  messages: AtaMessage[];
  oldestCursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export function subscribeToRecentMessages(
  conversationId: string,
  pageSize: number,
  onMessages: (result: PaginatedMessagesResult) => void,
  onError: (message: string) => void
): Unsubscribe {
  if (!conversationId) {
    onMessages({ messages: [], oldestCursor: null, hasMore: false });
    return () => {};
  }

  const path = `conversations/${conversationId}/messages`;
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const oldestCursor =
        snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1]
          : null;
      const messages = snapshot.docs
        .map((d) => mapDocToMessage(d.id, d.data()))
        .reverse();
      onMessages({
        messages,
        oldestCursor,
        hasMore: snapshot.docs.length === pageSize,
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        onError(
          err instanceof Error ? err.message : 'Unable to load messages.'
        );
      }
    }
  );
}

export async function fetchOlderMessages(
  conversationId: string,
  oldestCursor: QueryDocumentSnapshot<DocumentData>,
  pageSize: number
): Promise<PaginatedMessagesResult> {
  const path = `conversations/${conversationId}/messages`;
  try {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'desc'),
      startAfter(oldestCursor),
      limit(pageSize)
    );
    const snapshot = await getDocs(q);
    const newOldestCursor =
      snapshot.docs.length > 0
        ? snapshot.docs[snapshot.docs.length - 1]
        : null;
    const messages = snapshot.docs
      .map((d) => mapDocToMessage(d.id, d.data()))
      .reverse();

    return {
      messages,
      oldestCursor: newOldestCursor,
      hasMore: snapshot.docs.length === pageSize,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function sendTextMessage(
  conversation: AtaConversation,
  sender: AtaUserAccount,
  rawText: string,
  replyTo?: AtaMessage | null
): Promise<void> {
  const { uid } = await requireVerifiedMessagingUser();
  if (uid !== sender.uid) {
    throw new Error('Signed-in session mismatch.');
  }

  const textErr = validateMessageText(rawText);
  if (textErr) {
    throw new Error(textErr);
  }

  if (conversation.status !== 'active') {
    throw new Error('This conversation is archived and read-only.');
  }

  if (conversation.type === 'direct') {
    const peerId = conversation.participantIds.find((id) => id !== sender.uid);
    if (peerId) {
      const blockState = await checkBlockBetween(sender.uid, peerId);
      if (blockState.blockedByMe || blockState.blockedByThem) {
        throw new Error(
          blockState.blockedByMe
            ? 'You have blocked this member. Unblock them to send messages.'
            : 'Unable to send message because of an active account block.'
        );
      }
    }
  }

  const trimmedText = rawText.trim();
  const messageRef = doc(
    collection(db, 'conversations', conversation.id, 'messages')
  );
  const path = `conversations/${conversation.id}/messages/${messageRef.id}`;

  const replyPreview = replyTo
    ? (replyTo.deletedAt ? 'Original message deleted' : replyTo.text).slice(
        0,
        160
      )
    : '';
  const replySenderName = replyTo
    ? replyTo.senderDisplayName.slice(0, 40)
    : '';

  try {
    let otherParticipants: string[] = [];

    await runTransaction(db, async (transaction) => {
      const convRef = doc(db, 'conversations', conversation.id);
      const rateRef = doc(db, 'messageRateLimits', sender.uid);

      const convSnap = await transaction.get(convRef);
      if (!convSnap.exists()) {
        throw new Error('This conversation no longer exists.');
      }
      const convData = convSnap.data();
      if (convData.status !== 'active') {
        throw new Error('This conversation has been archived.');
      }

      const participantIds: string[] = Array.isArray(convData.participantIds)
        ? convData.participantIds.map((v: unknown) => String(v))
        : [];
      if (!participantIds.includes(sender.uid)) {
        throw new Error('You are no longer a participant in this conversation.');
      }

      otherParticipants = participantIds.filter((id) => id !== sender.uid);

      const memberRefs = otherParticipants.map((memberUid) =>
        doc(db, 'conversationMembers', `${conversation.id}__${memberUid}`)
      );

      const [rateSnap, ...memberSnaps] = await Promise.all([
        transaction.get(rateRef),
        ...memberRefs.map((ref) => transaction.get(ref)),
      ]);

      const now = serverTimestamp();

      const rateData = rateSnap.exists() ? rateSnap.data() : null;
      if (rateSnap.exists()) {
        transaction.update(rateRef, {
          lastMessageAt: now,
          lastRequestAt: rateData?.lastRequestAt ?? null,
          lastGroupCreatedAt: rateData?.lastGroupCreatedAt ?? null,
        });
      } else {
        transaction.set(rateRef, {
          uid: sender.uid,
          lastMessageAt: now,
          lastRequestAt: null,
          lastGroupCreatedAt: null,
        });
      }

      transaction.set(messageRef, {
        id: messageRef.id,
        conversationId: conversation.id,
        senderId: sender.uid,
        senderUsername: sender.username,
        senderDisplayName: sender.displayName,
        senderAvatarUrl: sender.avatarUrl,
        messageType: 'text',
        text: trimmedText,
        replyToMessageId: replyTo ? replyTo.id : '',
        replyToPreview: replyPreview,
        replyToSenderName: replySenderName,
        editedAt: null,
        deletedAt: null,
        createdAt: now,
      });

      transaction.update(convRef, {
        lastMessageText: trimmedText.slice(0, 200),
        lastMessageSenderId: sender.uid,
        lastMessageType: 'text',
        lastMessageAt: now,
        updatedAt: now,
      });

      for (let i = 0; i < memberSnaps.length; i += 1) {
        const snap = memberSnaps[i];
        if (snap.exists()) {
          const currentUnread =
            typeof snap.data().unreadCount === 'number'
              ? snap.data().unreadCount
              : 0;
          transaction.update(memberRefs[i], {
            unreadCount: currentUnread + 1,
            updatedAt: now,
          });
        }
      }
    });

    void setTypingState(
      conversation.id,
      { uid: sender.uid, displayName: sender.displayName },
      false
    );

    emitMessagingNotificationEvent({
      type:
        conversation.type === 'direct'
          ? 'new_direct_message'
          : 'new_group_message',
      recipientIds: otherParticipants,
      actorId: sender.uid,
      conversationId: conversation.id,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes('archived') ||
      msg.includes('participant') ||
      msg.includes('no longer exists')
    ) {
      throw error;
    }
    if (
      msg.toLowerCase().includes('permission') ||
      msg.toLowerCase().includes('insufficient')
    ) {
      try {
        const rateSnap = await getDoc(doc(db, 'messageRateLimits', sender.uid));
        if (rateSnap.exists()) {
          const lastAt = toDateOrNull(rateSnap.data().lastMessageAt);
          if (lastAt && Date.now() - lastAt.getTime() < 1500) {
            throw new Error(
              'Sending too quickly. Please wait a moment before sending the next message.'
            );
          }
        }
      } catch (cooldownErr) {
        if (
          cooldownErr instanceof Error &&
          cooldownErr.message.includes('Sending too quickly')
        ) {
          throw cooldownErr;
        }
      }
      handleFirestoreError(error, OperationType.CREATE, path);
    }
    throw error;
  }
}

export async function editOwnMessage(
  conversation: AtaConversation,
  message: AtaMessage,
  newText: string,
  isLatestMessage: boolean
): Promise<void> {
  const { uid } = await requireVerifiedMessagingUser();
  if (message.senderId !== uid) {
    throw new Error('You can only edit your own messages.');
  }
  if (message.deletedAt) {
    throw new Error('Deleted messages cannot be edited.');
  }
  if (!canEditMessageWithinWindow(message.createdAt)) {
    throw new Error('Messages can only be edited within 15 minutes of sending.');
  }

  const textErr = validateMessageText(newText);
  if (textErr) throw new Error(textErr);

  const trimmed = newText.trim();
  const path = `conversations/${conversation.id}/messages/${message.id}`;

  try {
    const now = serverTimestamp();
    const batch = writeBatch(db);
    batch.update(
      doc(db, 'conversations', conversation.id, 'messages', message.id),
      {
        text: trimmed,
        editedAt: now,
      }
    );

    if (isLatestMessage) {
      batch.update(doc(db, 'conversations', conversation.id), {
        lastMessageText: trimmed.slice(0, 200),
        lastMessageSenderId: message.senderId,
        lastMessageType: 'text',
        updatedAt: now,
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOwnMessage(
  conversation: AtaConversation,
  message: AtaMessage,
  isLatestMessage: boolean
): Promise<void> {
  const { uid } = await requireVerifiedMessagingUser();
  if (message.senderId !== uid) {
    throw new Error('You can only delete your own messages.');
  }
  if (message.deletedAt) return;

  const path = `conversations/${conversation.id}/messages/${message.id}`;
  try {
    const now = serverTimestamp();
    const batch = writeBatch(db);
    batch.update(
      doc(db, 'conversations', conversation.id, 'messages', message.id),
      {
        text: '',
        deletedAt: now,
      }
    );

    if (isLatestMessage) {
      batch.update(doc(db, 'conversations', conversation.id), {
        lastMessageText: 'Message deleted',
        lastMessageSenderId: message.senderId,
        lastMessageType: 'text',
        updatedAt: now,
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
