import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { AtaConversation, AtaConversationMember } from '../../types';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { subscribeShared } from '../sharedSubscriptionManager';
import {
  mapDocToConversation,
  mapDocToConversationMember,
  requireVerifiedMessagingUser,
} from './messagingUtils';

export function subscribeToUserConversations(
  uid: string,
  onConversations: (conversations: AtaConversation[]) => void,
  onError: (message: string) => void
): Unsubscribe {
  if (!uid) {
    onConversations([]);
    return () => {};
  }

  return subscribeShared<AtaConversation[]>(
    `conversations:user:${uid}`,
    'messaging:conversations',
    (emitData, emitError) => {
      const q = query(
        collection(db, 'conversations'),
        where('participantIds', 'array-contains', uid),
        orderBy('lastMessageAt', 'desc'),
        limit(50)
      );

      return onSnapshot(
        q,
        (snapshot) => {
          emitData(
            snapshot.docs.map((d) => mapDocToConversation(d.id, d.data()))
          );
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, 'conversations');
          } catch (err) {
            emitError(
              err instanceof Error
                ? err.message
                : 'Unable to load private conversations.'
            );
          }
        }
      );
    },
    onConversations,
    onError,
    { uid }
  );
}

export function subscribeToConversation(
  conversationId: string,
  onConversation: (conversation: AtaConversation | null) => void,
  onError: (message: string) => void,
  viewerUid?: string
): Unsubscribe {
  if (!conversationId) {
    onConversation(null);
    return () => {};
  }

  const effectiveUid = viewerUid || auth.currentUser?.uid || undefined;
  const path = `conversations/${conversationId}`;
  return subscribeShared<AtaConversation | null>(
    `conversation:${conversationId}:${effectiveUid || 'anon'}`,
    'messaging:conversation',
    (emitData, emitError) =>
      onSnapshot(
        doc(db, 'conversations', conversationId),
        (snapshot) => {
          emitData(
            snapshot.exists()
              ? mapDocToConversation(snapshot.id, snapshot.data())
              : null
          );
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.GET, path);
          } catch (err) {
            emitError(
              err instanceof Error
                ? err.message
                : 'Unable to sync active conversation.'
            );
          }
        }
      ),
    onConversation,
    onError,
    effectiveUid ? { uid: effectiveUid } : undefined
  );
}

export function subscribeToUserMemberStates(
  uid: string,
  onStates: (memberByConversation: Record<string, AtaConversationMember>) => void,
  onError?: (message: string) => void
): Unsubscribe {
  if (!uid) {
    onStates({});
    return () => {};
  }

  return subscribeShared<Record<string, AtaConversationMember>>(
    `conversationMembers:user:${uid}`,
    'messaging:userMemberStates',
    (emitData, emitError) => {
      const q = query(
        collection(db, 'conversationMembers'),
        where('userId', '==', uid),
        limit(200)
      );

      return onSnapshot(
        q,
        (snapshot) => {
          const map: Record<string, AtaConversationMember> = {};
          for (const d of snapshot.docs) {
            const mapped = mapDocToConversationMember(d.id, d.data());
            map[mapped.conversationId] = mapped;
          }
          emitData(map);
        },
        (error) => {
          try {
            handleFirestoreError(
              error,
              OperationType.LIST,
              'conversationMembers'
            );
          } catch (err) {
            emitError(
              err instanceof Error
                ? err.message
                : 'Unable to load unread conversation counts.'
            );
          }
        }
      );
    },
    onStates,
    onError,
    { uid }
  );
}

export function subscribeToConversationMembers(
  conversationId: string,
  onMembers: (members: AtaConversationMember[]) => void,
  onError?: (message: string) => void,
  viewerUid?: string
): Unsubscribe {
  if (!conversationId) {
    onMembers([]);
    return () => {};
  }

  const effectiveUid = viewerUid || auth.currentUser?.uid || undefined;
  return subscribeShared<AtaConversationMember[]>(
    `conversationMembers:conv:${conversationId}:${effectiveUid || 'anon'}`,
    'messaging:conversationMembers',
    (emitData, emitError) => {
      const q = query(
        collection(db, 'conversationMembers'),
        where('conversationId', '==', conversationId),
        orderBy('joinedAt', 'asc'),
        limit(100)
      );

      return onSnapshot(
        q,
        (snapshot) => {
          emitData(
            snapshot.docs.map((d) => mapDocToConversationMember(d.id, d.data()))
          );
        },
        (error) => {
          try {
            handleFirestoreError(
              error,
              OperationType.LIST,
              'conversationMembers'
            );
          } catch (err) {
            emitError(
              err instanceof Error
                ? err.message
                : 'Unable to load conversation members.'
            );
          }
        }
      );
    },
    onMembers,
    onError,
    effectiveUid ? { uid: effectiveUid } : undefined
  );
}

export async function markConversationRead(
  conversationId: string,
  uid: string,
  readReceiptsEnabled: boolean
): Promise<void> {
  if (!conversationId || !uid) return;
  try {
    await requireVerifiedMessagingUser();
    const memberDocId = `${conversationId}__${uid}`;
    const ref = doc(db, 'conversationMembers', memberDocId);

    const payload: Record<string, unknown> = {
      unreadCount: 0,
      updatedAt: serverTimestamp(),
    };
    if (readReceiptsEnabled) {
      payload.lastReadAt = serverTimestamp();
    }

    await updateDoc(ref, payload);
  } catch {
    // Non-fatal read receipt/unread clear failure never blocks chat viewing
  }
}

export async function toggleConversationMute(
  conversationId: string,
  uid: string,
  muted: boolean
): Promise<void> {
  await requireVerifiedMessagingUser();
  const memberDocId = `${conversationId}__${uid}`;
  const path = `conversationMembers/${memberDocId}`;
  try {
    await updateDoc(doc(db, 'conversationMembers', memberDocId), {
      muted,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleConversationArchive(
  conversationId: string,
  uid: string,
  archived: boolean
): Promise<void> {
  await requireVerifiedMessagingUser();
  const memberDocId = `${conversationId}__${uid}`;
  const path = `conversationMembers/${memberDocId}`;
  try {
    await updateDoc(doc(db, 'conversationMembers', memberDocId), {
      archived,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
