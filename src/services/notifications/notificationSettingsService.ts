import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  AtaNotificationSettings,
  UpdateNotificationSettingsInput,
} from '../../types';
import { db, handleFirestoreError, OperationType } from '../firebase';

export const DEFAULT_NOTIFICATION_SETTINGS: Omit<
  AtaNotificationSettings,
  'userId' | 'updatedAt'
> = {
  enabled: true,
  socialEnabled: true,
  followersEnabled: true,
  communitiesEnabled: true,
  messagingEnabled: true,
  groupsEnabled: true,
  systemEnabled: true,
  popupEnabled: true,
  soundEnabled: false,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  timezone:
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

export function mapDocToNotificationSettings(
  userId: string,
  data?: Record<string, unknown> | null
): AtaNotificationSettings {
  if (!data) {
    return {
      userId,
      ...DEFAULT_NOTIFICATION_SETTINGS,
      updatedAt: null,
    };
  }
  return {
    userId,
    enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
    socialEnabled:
      typeof data.socialEnabled === 'boolean' ? data.socialEnabled : true,
    followersEnabled:
      typeof data.followersEnabled === 'boolean' ? data.followersEnabled : true,
    communitiesEnabled:
      typeof data.communitiesEnabled === 'boolean'
        ? data.communitiesEnabled
        : true,
    messagingEnabled:
      typeof data.messagingEnabled === 'boolean'
        ? data.messagingEnabled
        : true,
    groupsEnabled:
      typeof data.groupsEnabled === 'boolean' ? data.groupsEnabled : true,
    systemEnabled:
      typeof data.systemEnabled === 'boolean' ? data.systemEnabled : true,
    popupEnabled: typeof data.popupEnabled === 'boolean' ? data.popupEnabled : true,
    soundEnabled:
      typeof data.soundEnabled === 'boolean' ? data.soundEnabled : false,
    quietHoursEnabled:
      typeof data.quietHoursEnabled === 'boolean'
        ? data.quietHoursEnabled
        : false,
    quietHoursStart:
      typeof data.quietHoursStart === 'string'
        ? data.quietHoursStart
        : '22:00',
    quietHoursEnd:
      typeof data.quietHoursEnd === 'string' ? data.quietHoursEnd : '08:00',
    timezone:
      typeof data.timezone === 'string'
        ? data.timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    updatedAt:
      data.updatedAt && typeof (data.updatedAt as { toDate?: () => Date }).toDate === 'function'
        ? (data.updatedAt as { toDate: () => Date }).toDate()
        : null,
  };
}

export async function getNotificationSettings(
  userId: string
): Promise<AtaNotificationSettings> {
  if (!userId) {
    return {
      userId: '',
      ...DEFAULT_NOTIFICATION_SETTINGS,
      updatedAt: null,
    };
  }
  const path = `notificationSettings/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'notificationSettings', userId));
    return mapDocToNotificationSettings(
      userId,
      snap.exists() ? snap.data() : null
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeToNotificationSettings(
  userId: string,
  onSettings: (settings: AtaNotificationSettings) => void,
  onError?: (message: string) => void
): Unsubscribe {
  if (!userId) {
    onSettings({
      userId: '',
      ...DEFAULT_NOTIFICATION_SETTINGS,
      updatedAt: null,
    });
    return () => {};
  }

  const path = `notificationSettings/${userId}`;
  return onSnapshot(
    doc(db, 'notificationSettings', userId),
    (snapshot) => {
      onSettings(
        mapDocToNotificationSettings(
          userId,
          snapshot.exists() ? snapshot.data() : null
        )
      );
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (err) {
        onError?.(
          err instanceof Error
            ? err.message
            : 'Unable to sync notification settings.'
        );
      }
    }
  );
}

export async function updateNotificationSettings(
  userId: string,
  input: UpdateNotificationSettingsInput
): Promise<AtaNotificationSettings> {
  if (!userId) {
    throw new Error('User ID is required.');
  }

  const path = `notificationSettings/${userId}`;
  try {
    const current = await getNotificationSettings(userId);
    const updated: AtaNotificationSettings = {
      ...current,
      ...input,
      userId,
      updatedAt: new Date(),
    };

    const payload = {
      userId,
      enabled: Boolean(updated.enabled),
      socialEnabled: Boolean(updated.socialEnabled),
      followersEnabled: Boolean(updated.followersEnabled),
      communitiesEnabled: Boolean(updated.communitiesEnabled),
      messagingEnabled: Boolean(updated.messagingEnabled),
      groupsEnabled: Boolean(updated.groupsEnabled),
      systemEnabled: Boolean(updated.systemEnabled),
      popupEnabled: Boolean(updated.popupEnabled),
      soundEnabled: Boolean(updated.soundEnabled),
      quietHoursEnabled: Boolean(updated.quietHoursEnabled),
      quietHoursStart: updated.quietHoursStart,
      quietHoursEnd: updated.quietHoursEnd,
      timezone: updated.timezone,
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'notificationSettings', userId), payload);
    return updated;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
