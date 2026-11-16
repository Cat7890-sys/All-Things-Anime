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
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  AtaMessageRequest,
  AtaPublicProfile,
  AtaUserAccount,
} from '../../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { checkBlockBetween, checkFollowStatus } from '../socialGraphService';
import { getPublicProfile } from '../userProfileService';
import {
  buildDirectConversationId,
  buildDirectKey,
  isValidDirectRecipient,
  validateMessageRequestText,
} from '../validation';
import { getMessageSettings } from './messagingSettingsService';
import {
  mapDocToMessageRequest,
  requireVerifiedMessagingUser,
  toDateOrNull,
} from './messagingUtils';
import { emitMessagingNotificationEvent } from './notificationBoundaryService';

export type DirectRelationshipState =
  | { kind: 'existing_conversation'; conversationId: string }
  | { kind: 'incoming_pending'; request: AtaMessageRequest }
  | { kind: 'outgoing_pending'; request: AtaMessageRequest }
  | { kind: 'outgoing_declined'; request: AtaMessageRequest }
  | { kind: 'blocked'; reason: string }
  | { kind: 'not_accepting'; reason: string }
  | { kind: 'can_request'; targetProfile: AtaPublicProfile };

export async function getDirectRelationshipState(
  currentUid: string,
  targetUid: string
): Promise<DirectRelationshipState> {
  const pairErr = isValidDirectRecipient(currentUid, targetUid);
  if (pairErr) {
    throw new Error(pairErr);
  }

  const conversationId = buildDirectConversationId(currentUid, targetUid);
  const [
    convSnap,
    outgoingSnap,
    incomingSnap,
    blockState,
    targetProfile,
    targetSettings,
  ] = await Promise.all([
    getDoc(doc(db, 'conversations', conversationId)),
    getDoc(doc(db, 'messageRequests', `${currentUid}__${targetUid}`)),
    getDoc(doc(db, 'messageRequests', `${targetUid}__${currentUid}`)),
    checkBlockBetween(currentUid, targetUid),
    getPublicProfile(targetUid),
    getMessageSettings(targetUid),
  ]);

  if (blockState.blockedByMe || blockState.blockedByThem) {
    return {
      kind: 'blocked',
      reason: blockState.blockedByMe
        ? 'You have blocked this member. Unblock them to message again.'
        : 'Private messaging is unavailable due to an active account block.',
    };
  }

  if (convSnap.exists()) {
    return { kind: 'existing_conversation', conversationId };
  }

  if (incomingSnap.exists()) {
    const incomingReq = mapDocToMessageRequest(
      incomingSnap.id,
      incomingSnap.data()
    );
    if (incomingReq.status === 'pending') {
      return { kind: 'incoming_pending', request: incomingReq };
    }
  }

  if (outgoingSnap.exists()) {
    const outgoingReq = mapDocToMessageRequest(
      outgoingSnap.id,
      outgoingSnap.data()
    );
    if (outgoingReq.status === 'pending') {
      return { kind: 'outgoing_pending', request: outgoingReq };
    }
    if (outgoingReq.status === 'declined') {
      return { kind: 'outgoing_declined', request: outgoingReq };
    }
  }

  if (!targetProfile) {
    throw new Error('This member profile could not be found.');
  }

  if (!targetSettings.allowRequests) {
    return {
      kind: 'not_accepting',
      reason: `@${targetProfile.username} is currently not accepting new message requests.`,
    };
  }

  if (targetSettings.requestPermission === 'following') {
    const recipientFollowsSender = await checkFollowStatus(targetUid, currentUid);
    if (!recipientFollowsSender) {
      return {
        kind: 'not_accepting',
        reason: `@${targetProfile.username} only accepts message requests from accounts they follow.`,
      };
    }
  } else if (targetSettings.requestPermission === 'mutuals') {
    const [recipientFollowsSender, senderFollowsRecipient] = await Promise.all([
      checkFollowStatus(targetUid, currentUid),
      checkFollowStatus(currentUid, targetUid),
    ]);
    if (!recipientFollowsSender || !senderFollowsRecipient) {
      return {
        kind: 'not_accepting',
        reason: `@${targetProfile.username} only accepts message requests from mutual followers.`,
      };
    }
  }

  return { kind: 'can_request', targetProfile };
}

export function subscribeToIncomingRequests(
  uid: string,
  onRequests: (requests: AtaMessageRequest[]) => void,
  onError: (message: string) => void
): Unsubscribe {
  const q = query(
    collection(db, 'messageRequests'),
    where('recipientId', '==', uid),
    where('status', '==', 'pending'),
    orderBy('updatedAt', 'desc'),
    limit(40)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      onRequests(
        snapshot.docs.map((d) => mapDocToMessageRequest(d.id, d.data()))
      );
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'messageRequests');
      } catch (err) {
        onError(
          err instanceof Error
            ? err.message
            : 'Unable to load incoming message requests.'
        );
      }
    }
  );
}

export function subscribeToOutgoingRequests(
  uid: string,
  onRequests: (requests: AtaMessageRequest[]) => void,
  onError: (message: string) => void
): Unsubscribe {
  const q = query(
    collection(db, 'messageRequests'),
    where('senderId', '==', uid),
    where('status', '==', 'pending'),
    orderBy('updatedAt', 'desc'),
    limit(40)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      onRequests(
        snapshot.docs.map((d) => mapDocToMessageRequest(d.id, d.data()))
      );
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'messageRequests');
      } catch (err) {
        onError(
          err instanceof Error
            ? err.message
            : 'Unable to load outgoing message requests.'
        );
      }
    }
  );
}

export async function sendMessageRequest(
  sender: AtaUserAccount,
  recipient: AtaPublicProfile,
  initialMessage: string
): Promise<AtaMessageRequest> {
  const { uid } = await requireVerifiedMessagingUser();
  if (uid !== sender.uid) {
    throw new Error('Signed-in session mismatch.');
  }

  const pairErr = isValidDirectRecipient(sender.uid, recipient.uid);
  if (pairErr) throw new Error(pairErr);

  const textErr = validateMessageRequestText(initialMessage);
  if (textErr) throw new Error(textErr);

  const relState = await getDirectRelationshipState(sender.uid, recipient.uid);
  if (relState.kind === 'blocked' || relState.kind === 'not_accepting') {
    throw new Error(relState.reason);
  }
  if (relState.kind === 'existing_conversation') {
    throw new Error('A direct conversation with this member already exists.');
  }
  if (relState.kind === 'outgoing_pending') {
    throw new Error('You already have a pending message request to this member.');
  }
  if (relState.kind === 'outgoing_declined') {
    throw new Error(
      'This member declined your previous request. Repeated requests are blocked.'
    );
  }
  if (relState.kind === 'incoming_pending') {
    throw new Error(
      'This member has already sent you a message request. Accept it in your Requests tab.'
    );
  }

  const requestId = `${sender.uid}__${recipient.uid}`;
  const trimmedMsg = initialMessage.trim();

  try {
    await runTransaction(db, async (transaction) => {
      const reqRef = doc(db, 'messageRequests', requestId);
      const rateRef = doc(db, 'messageRateLimits', sender.uid);

      const [reqSnap, rateSnap] = await Promise.all([
        transaction.get(reqRef),
        transaction.get(rateRef),
      ]);

      const now = serverTimestamp();

      const rateData = rateSnap.exists() ? rateSnap.data() : null;
      if (rateSnap.exists()) {
        transaction.update(rateRef, {
          lastMessageAt: rateData?.lastMessageAt ?? null,
          lastRequestAt: now,
          lastGroupCreatedAt: rateData?.lastGroupCreatedAt ?? null,
        });
      } else {
        transaction.set(rateRef, {
          uid: sender.uid,
          lastMessageAt: null,
          lastRequestAt: now,
          lastGroupCreatedAt: null,
        });
      }

      if (reqSnap.exists()) {
        const existingStatus = reqSnap.data().status;
        if (existingStatus === 'declined') {
          throw new Error(
            'This member declined your previous request. Repeated requests are blocked.'
          );
        }
        if (existingStatus !== 'cancelled') {
          throw new Error('A message request already exists for this member.');
        }
        transaction.update(reqRef, {
          initialMessage: trimmedMsg,
          status: 'pending',
          senderDisplayName: sender.displayName,
          senderAvatarUrl: sender.avatarUrl,
          updatedAt: now,
        });
      } else {
        transaction.set(reqRef, {
          id: requestId,
          senderId: sender.uid,
          senderUsername: sender.username,
          senderDisplayName: sender.displayName,
          senderAvatarUrl: sender.avatarUrl,
          recipientId: recipient.uid,
          recipientUsername: recipient.username,
          recipientDisplayName: recipient.displayName,
          recipientAvatarUrl: recipient.avatarUrl,
          initialMessage: trimmedMsg,
          status: 'pending',
          conversationId: '',
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    const createdSnap = await getDoc(doc(db, 'messageRequests', requestId));
    if (!createdSnap.exists()) {
      throw new Error('Message request was sent but could not be reloaded.');
    }

    emitMessagingNotificationEvent({
      type: 'new_message_request',
      recipientIds: [recipient.uid],
      actorId: sender.uid,
      requestId,
    });

    return mapDocToMessageRequest(createdSnap.id, createdSnap.data());
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes('declined') ||
      msg.includes('already exists') ||
      msg.includes('pending')
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
          const lastAt = toDateOrNull(rateSnap.data().lastRequestAt);
          if (lastAt && Date.now() - lastAt.getTime() < 11000) {
            throw new Error(
              'You are sending message requests too quickly. Please wait 10 seconds.'
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
        OperationType.WRITE,
        `messageRequests/${requestId}`
      );
    }
    throw error;
  }
}

export async function acceptMessageRequest(
  recipient: AtaUserAccount,
  request: AtaMessageRequest
): Promise<string> {
  const { uid } = await requireVerifiedMessagingUser();
  if (uid !== recipient.uid || request.recipientId !== recipient.uid) {
    throw new Error('Only the recipient can accept this message request.');
  }

  const blockState = await checkBlockBetween(
    request.senderId,
    request.recipientId
  );
  if (blockState.blockedByMe || blockState.blockedByThem) {
    throw new Error(
      'Cannot accept this request while an account block is active.'
    );
  }

  const conversationId = buildDirectConversationId(
    request.senderId,
    request.recipientId
  );
  const directKey = buildDirectKey(request.senderId, request.recipientId);

  try {
    await runTransaction(db, async (transaction) => {
      const reqRef = doc(db, 'messageRequests', request.id);
      const convRef = doc(db, 'conversations', conversationId);
      const senderMemberRef = doc(
        db,
        'conversationMembers',
        `${conversationId}__${request.senderId}`
      );
      const recipientMemberRef = doc(
        db,
        'conversationMembers',
        `${conversationId}__${request.recipientId}`
      );
      const initialMsgRef = doc(
        collection(db, 'conversations', conversationId, 'messages')
      );

      const [reqSnap, convSnap] = await Promise.all([
        transaction.get(reqRef),
        transaction.get(convRef),
      ]);

      if (!reqSnap.exists() || reqSnap.data().status !== 'pending') {
        throw new Error('This message request is no longer pending.');
      }

      const now = serverTimestamp();
      const preview = String(reqSnap.data().initialMessage || '').slice(0, 200);

      transaction.update(reqRef, {
        status: 'accepted',
        conversationId,
        updatedAt: now,
      });

      if (!convSnap.exists()) {
        transaction.set(convRef, {
          id: conversationId,
          type: 'direct',
          directKey,
          name: '',
          description: '',
          avatarUrl: '',
          avatarPath: '',
          ownerId: '',
          adminIds: [],
          participantIds: [request.senderId, request.recipientId],
          lastMessageText: preview,
          lastMessageSenderId: request.senderId,
          lastMessageType: 'text',
          lastMessageAt: now,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });

        transaction.set(initialMsgRef, {
          id: initialMsgRef.id,
          conversationId,
          senderId: request.senderId,
          senderUsername: request.senderUsername,
          senderDisplayName: request.senderDisplayName,
          senderAvatarUrl: request.senderAvatarUrl,
          messageType: 'text',
          text: String(reqSnap.data().initialMessage || ''),
          replyToMessageId: '',
          replyToPreview: '',
          replyToSenderName: '',
          editedAt: null,
          deletedAt: null,
          createdAt: now,
        });

        transaction.set(senderMemberRef, {
          id: `${conversationId}__${request.senderId}`,
          conversationId,
          userId: request.senderId,
          username: request.senderUsername,
          displayName: request.senderDisplayName,
          avatarUrl: request.senderAvatarUrl,
          role: 'member',
          unreadCount: 0,
          lastReadAt: now,
          muted: false,
          archived: false,
          joinedAt: now,
          updatedAt: now,
        });

        transaction.set(recipientMemberRef, {
          id: `${conversationId}__${request.recipientId}`,
          conversationId,
          userId: request.recipientId,
          username: recipient.username,
          displayName: recipient.displayName,
          avatarUrl: recipient.avatarUrl,
          role: 'member',
          unreadCount: 0,
          lastReadAt: now,
          muted: false,
          archived: false,
          joinedAt: now,
          updatedAt: now,
        });
      }
    });

    emitMessagingNotificationEvent({
      type: 'accepted_message_request',
      recipientIds: [request.senderId],
      actorId: recipient.uid,
      conversationId,
      requestId: request.id,
    });

    return conversationId;
  } catch (error) {
    if (error instanceof Error && error.message.includes('longer pending')) {
      throw error;
    }
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `messageRequests/${request.id}`
    );
  }
}

export async function declineMessageRequest(
  recipientUid: string,
  requestId: string
): Promise<void> {
  const { uid } = await requireVerifiedMessagingUser();
  if (uid !== recipientUid) {
    throw new Error('Only the recipient can decline this message request.');
  }

  const path = `messageRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'messageRequests', requestId), {
      status: 'declined',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cancelMessageRequest(
  senderUid: string,
  requestId: string
): Promise<void> {
  const { uid } = await requireVerifiedMessagingUser();
  if (uid !== senderUid) {
    throw new Error('Only the sender can cancel this message request.');
  }

  const path = `messageRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'messageRequests', requestId), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
