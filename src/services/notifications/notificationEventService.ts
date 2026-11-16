import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import type {
  AtaNotification,
  NotificationCategory,
  NotificationType,
} from '../../types';
import { db } from '../firebase';
import { registerMessagingNotificationListener } from '../messaging/notificationBoundaryService';
import { checkBlockBetween } from '../socialGraphService';
import { getPublicProfile } from '../userProfileService';
import {
  getNotificationSettings,
} from './notificationSettingsService';
import {
  isCategoryEnabled,
} from './notificationPreferenceService';

interface CreateNotificationInput {
  recipientId: string;
  actorId?: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  targetType?: AtaNotification['targetType'];
  targetId?: string;
  route?: string;
  dedupeKey: string;
  metadata?: Record<string, string>;
}

/**
 * Centralized, idempotent notification creation ensuring no self-notifications,
 * block relationship respect, preference gating, and duplicate suppression.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  if (!input.recipientId) return;

  // 1. Avoid self-notifications
  if (input.actorId && input.actorId === input.recipientId) {
    return;
  }

  try {
    // 2. Respect block relationships if actor is present
    if (input.actorId) {
      const blockState = await checkBlockBetween(input.actorId, input.recipientId);
      if (blockState.blockedByMe || blockState.blockedByThem) {
        return;
      }
    }

    // 3. Check recipient notification preferences
    const settings = await getNotificationSettings(input.recipientId);
    if (!isCategoryEnabled(settings, input.category)) {
      return;
    }

    // 4. Resolve actor profile details if actorId is provided
    let actorUsername = '';
    let actorDisplayName = 'ATA Member';
    let actorAvatarUrl = '';

    if (input.actorId) {
      const actorProf = await getPublicProfile(input.actorId).catch(() => null);
      if (actorProf) {
        actorUsername = actorProf.username;
        actorDisplayName = actorProf.displayName;
        actorAvatarUrl = actorProf.avatarUrl;
      }
    }

    // 5. Idempotent creation via deterministic dedupeKey document ID or transaction
    const notificationId = `${input.recipientId}__${input.dedupeKey}`;
    const notifRef = doc(db, 'notifications', notificationId);

    await runTransaction(db, async (transaction) => {
      const existingSnap = await transaction.get(notifRef);
      if (existingSnap.exists()) {
        return; // Idempotent suppression
      }

      transaction.set(notifRef, {
        id: notificationId,
        recipientId: input.recipientId,
        actorId: input.actorId || '',
        actorUsername,
        actorDisplayName,
        actorAvatarUrl,
        type: input.type,
        category: input.category,
        title: input.title,
        body: input.body,
        targetType: input.targetType || 'system',
        targetId: input.targetId || '',
        route: input.route || '',
        isRead: false,
        isDismissed: false,
        createdAt: serverTimestamp(),
        readAt: null,
        dedupeKey: input.dedupeKey,
        metadata: input.metadata || {},
      });
    });
  } catch {
    // Notification creation failures must never break primary user actions
  }
}

// Register listener for Build 04B messaging events via notificationBoundaryService
export function initializeMessagingNotificationBridge(): () => void {
  return registerMessagingNotificationListener((event) => {
    for (const recipientId of event.recipientIds) {
      if (recipientId === event.actorId) continue;

      let type: NotificationType = 'new_direct_message';
      let category: NotificationCategory = 'messaging';
      let title = 'New Message';
      let body = event.neutralPreviewText;
      let targetType: AtaNotification['targetType'] = 'conversation';

      if (event.type === 'new_message_request') {
        type = 'new_message_request';
        category = 'messaging';
        title = 'New Message Request';
        targetType = 'message_request';
      } else if (event.type === 'accepted_message_request') {
        type = 'accepted_message_request';
        category = 'messaging';
        title = 'Request Accepted';
        targetType = 'conversation';
      } else if (event.type === 'new_group_message') {
        type = 'new_group_message';
        category = 'groups';
        title = 'Group Message';
        targetType = 'group';
      } else if (event.type === 'group_membership_change') {
        type = 'group_update';
        category = 'groups';
        title = 'Group Update';
        targetType = 'group';
      }

      const dedupeKey = `msg_${event.type}_${event.conversationId || event.requestId || Date.now()}`;

      void createNotification({
        recipientId,
        actorId: event.actorId,
        type,
        category,
        title,
        body,
        targetType,
        targetId: event.conversationId || event.requestId || '',
        route: event.conversationId ? `/messages/${event.conversationId}` : undefined,
        dedupeKey,
      });
    }
  });
}
