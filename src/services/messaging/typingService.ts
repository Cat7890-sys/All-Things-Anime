import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { AtaTypingIndicator } from '../../types';
import { auth, db } from '../firebase';
import { subscribeShared } from '../sharedSubscriptionManager';
import { TYPING_STALE_MS } from '../validation';
import { mapDocToTypingIndicator } from './messagingUtils';

export async function setTypingState(
  conversationId: string,
  user: { uid: string; displayName: string },
  isTyping: boolean
): Promise<void> {
  const currentUser = auth.currentUser;
  if (
    !conversationId ||
    !currentUser ||
    currentUser.uid !== user.uid ||
    !currentUser.emailVerified
  ) {
    return;
  }

  try {
    const typingRef = doc(
      db,
      'conversations',
      conversationId,
      'typing',
      user.uid
    );
    if (!isTyping) {
      await deleteDoc(typingRef);
      return;
    }
    await setDoc(typingRef, {
      uid: user.uid,
      displayName: user.displayName.trim().slice(0, 40) || 'ATA Member',
      isTyping: true,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Ephemeral typing updates never interrupt message composition
  }
}

export function subscribeToTypingIndicators(
  conversationId: string,
  currentUid: string,
  onTypingUsers: (users: AtaTypingIndicator[]) => void
): Unsubscribe {
  if (!conversationId) {
    onTypingUsers([]);
    return () => {};
  }

  const effectiveUid = currentUid || auth.currentUser?.uid || undefined;

  return subscribeShared<AtaTypingIndicator[]>(
    `typing:${conversationId}:${effectiveUid || 'anon'}`,
    'messaging:typing',
    (emitData) => {
      const q = query(
        collection(db, 'conversations', conversationId, 'typing'),
        limit(30)
      );
      return onSnapshot(
        q,
        (snapshot) => {
          const all = snapshot.docs.map((d) =>
            mapDocToTypingIndicator(d.id, d.data())
          );
          emitData(all);
        },
        () => {
          emitData([]);
        }
      );
    },
    (all) => {
      const now = Date.now();
      const active = all.filter(
        (item) =>
          item.uid !== currentUid &&
          item.isTyping &&
          item.updatedAt !== null &&
          now - item.updatedAt.getTime() <= TYPING_STALE_MS
      );
      onTypingUsers(active);
    },
    undefined,
    effectiveUid ? { uid: effectiveUid } : undefined
  );
}
