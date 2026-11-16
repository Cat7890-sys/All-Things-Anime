import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  AtaMessageSettings,
  AtaPublicProfile,
  UpdateMessageSettingsInput,
} from '../../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { getPublicProfile } from '../userProfileService';
import { normalizeUsername, validateUsername } from '../validation';
import {
  DEFAULT_MESSAGE_SETTINGS,
  mapDocToMessageSettings,
  requireVerifiedMessagingUser,
} from './messagingUtils';

export async function getMessageSettings(
  uid: string
): Promise<AtaMessageSettings> {
  if (!uid) {
    return {
      uid: '',
      ...DEFAULT_MESSAGE_SETTINGS,
      updatedAt: null,
    };
  }
  const path = `messageSettings/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'messageSettings', uid));
    return mapDocToMessageSettings(uid, snap.exists() ? snap.data() : undefined);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeToMessageSettings(
  uid: string,
  onSettings: (settings: AtaMessageSettings) => void,
  onError?: (message: string) => void
): Unsubscribe {
  const path = `messageSettings/${uid}`;
  return onSnapshot(
    doc(db, 'messageSettings', uid),
    (snapshot) => {
      onSettings(
        mapDocToMessageSettings(uid, snapshot.exists() ? snapshot.data() : undefined)
      );
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (err) {
        onError?.(
          err instanceof Error
            ? err.message
            : 'Unable to sync messaging privacy settings.'
        );
      }
    }
  );
}

export async function updateMessageSettings(
  uid: string,
  input: UpdateMessageSettingsInput
): Promise<AtaMessageSettings> {
  const { uid: authUid } = await requireVerifiedMessagingUser();
  if (authUid !== uid) {
    throw new Error('You can only update your own messaging settings.');
  }

  const path = `messageSettings/${uid}`;
  try {
    const now = serverTimestamp();
    await setDoc(doc(db, 'messageSettings', uid), {
      uid,
      allowRequests: Boolean(input.allowRequests),
      requestPermission: input.requestPermission,
      readReceiptsEnabled: Boolean(input.readReceiptsEnabled),
      onlineStatusVisible: Boolean(input.onlineStatusVisible),
      typingIndicatorsEnabled: Boolean(input.typingIndicatorsEnabled),
      updatedAt: now,
    });

    // Keep presence visibility synchronized with onlineStatusVisible preference
    await setDoc(doc(db, 'userPresence', uid), {
      uid,
      status: input.onlineStatusVisible ? 'online' : 'away',
      visible: Boolean(input.onlineStatusVisible),
      lastActiveAt: now,
      updatedAt: now,
    });

    return await getMessageSettings(uid);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Deterministic O(1) lookup by handle without leaking or listing user tables.
 */
export async function lookupPublicProfileByUsername(
  rawUsername: string
): Promise<AtaPublicProfile | null> {
  const cleanHandle = rawUsername.trim().replace(/^@/, '');
  const handleError = validateUsername(cleanHandle);
  if (handleError) {
    throw new Error(handleError);
  }

  const normalized = normalizeUsername(cleanHandle);
  const path = `usernames/${normalized}`;
  let uid = '';
  try {
    const usernameSnap = await getDoc(doc(db, 'usernames', normalized));
    if (!usernameSnap.exists()) {
      return null;
    }
    uid = String(usernameSnap.data().uid || '');
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!uid) return null;
  return await getPublicProfile(uid);
}
