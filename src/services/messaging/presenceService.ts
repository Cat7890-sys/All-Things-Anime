import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { AtaUserPresence } from '../../types';
import { auth, db } from '../firebase';
import { subscribeShared } from '../sharedSubscriptionManager';
import { PRESENCE_ACTIVE_WINDOW_MS } from '../validation';
import { mapDocToUserPresence } from './messagingUtils';

export async function publishOwnPresence(
  uid: string,
  status: 'online' | 'away',
  visible: boolean
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid || !currentUser.emailVerified) {
    return;
  }

  try {
    const now = serverTimestamp();
    await setDoc(doc(db, 'userPresence', uid), {
      uid,
      status: visible ? status : 'away',
      visible: Boolean(visible),
      lastActiveAt: now,
      updatedAt: now,
    });
  } catch {
    // Presence updates are conservative best-effort heartbeats
  }
}

export function subscribeToUserPresence(
  targetUid: string,
  onPresence: (presence: AtaUserPresence | null) => void,
  viewerUid?: string
): Unsubscribe {
  if (!targetUid) {
    onPresence(null);
    return () => {};
  }

  const effectiveUid = viewerUid || auth.currentUser?.uid || undefined;

  return subscribeShared<AtaUserPresence | null>(
    `userPresence:${targetUid}:${effectiveUid || 'anon'}`,
    'messaging:presence',
    (emitData) =>
      onSnapshot(
        doc(db, 'userPresence', targetUid),
        (snapshot) => {
          emitData(
            snapshot.exists()
              ? mapDocToUserPresence(targetUid, snapshot.data())
              : null
          );
        },
        () => {
          // Blocked or hidden visibility fails closed safely without crashing UI
          emitData(null);
        }
      ),
    onPresence,
    undefined,
    effectiveUid ? { uid: effectiveUid } : undefined
  );
}

export function isPresenceRecentlyActive(
  presence: AtaUserPresence | null,
  nowMs: number = Date.now()
): boolean {
  if (!presence || !presence.visible || !presence.lastActiveAt) {
    return false;
  }
  if (presence.status !== 'online') return false;
  return nowMs - presence.lastActiveAt.getTime() <= PRESENCE_ACTIVE_WINDOW_MS;
}
