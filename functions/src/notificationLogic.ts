import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export type NotificationCategory =
  | 'social'
  | 'followers'
  | 'communities'
  | 'messaging'
  | 'groups'
  | 'system';

export type NotificationType =
  | 'like_post'
  | 'comment_post'
  | 'reply_comment'
  | 'mention'
  | 'new_follower'
  | 'join_request'
  | 'approve_request'
  | 'decline_request'
  | 'remove_member'
  | 'change_role'
  | 'transfer_owner'
  | 'community_announcement'
  | 'new_message_request'
  | 'accepted_message_request'
  | 'new_direct_message'
  | 'new_group_message'
  | 'group_added'
  | 'group_removed'
  | 'group_admin_promote'
  | 'group_update'
  | 'system_notice';

export type NotificationTargetType =
  | 'post'
  | 'comment'
  | 'profile'
  | 'community'
  | 'conversation'
  | 'message_request'
  | 'group'
  | 'system';

export interface NotificationDispatchInput {
  recipientId: string;
  actorId?: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  targetType: NotificationTargetType;
  targetId: string;
  route: string;
  dedupeKey: string;
  metadata?: Record<string, string>;
}

export interface ActorSummary {
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface NotificationDocumentPayload {
  id: string;
  recipientId: string;
  actorId: string;
  actorUsername: string;
  actorDisplayName: string;
  actorAvatarUrl: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  targetType: NotificationTargetType;
  targetId: string;
  route: string;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: unknown;
  readAt: null;
  dedupeKey: string;
  metadata: Record<string, string>;
}

export function sanitizeNotificationId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  const trimmed = cleaned.slice(0, 280);
  return trimmed || 'notif';
}

export function buildNotificationId(
  recipientId: string,
  dedupeKey: string
): string {
  return sanitizeNotificationId(`${recipientId}__${dedupeKey}`);
}

export function isCategoryEnabled(
  settingsData: Record<string, unknown> | undefined | null,
  category: NotificationCategory
): boolean {
  if (!settingsData) {
    return true;
  }
  if (settingsData.enabled === false) {
    return false;
  }

  switch (category) {
    case 'social':
      return settingsData.socialEnabled !== false;
    case 'followers':
      return settingsData.followersEnabled !== false;
    case 'communities':
      return settingsData.communitiesEnabled !== false;
    case 'messaging':
      return settingsData.messagingEnabled !== false;
    case 'groups':
      return settingsData.groupsEnabled !== false;
    case 'system':
      return settingsData.systemEnabled !== false;
  }
}

export function sanitizeMetadata(
  metadata?: Record<string, string>
): Record<string, string> {
  if (!metadata) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof key === 'string' && typeof value === 'string' && value.length > 0) {
      result[key.slice(0, 40)] = value.slice(0, 300);
    }
  }
  return result;
}

export function buildNeutralMessagingCopy(
  type:
    | 'new_message_request'
    | 'accepted_message_request'
    | 'new_direct_message'
    | 'new_group_message'
    | 'group_added'
    | 'group_removed'
    | 'group_admin_promote'
): { title: string; body: string } {
  switch (type) {
    case 'new_message_request':
      return {
        title: 'New Message Request',
        body: 'You received a new message request.',
      };
    case 'accepted_message_request':
      return {
        title: 'Request Accepted',
        body: 'Your message request was accepted.',
      };
    case 'new_direct_message':
      return {
        title: 'New Message',
        body: 'You have a new direct message.',
      };
    case 'new_group_message':
      return {
        title: 'Group Message',
        body: 'You have a new group message.',
      };
    case 'group_added':
      return {
        title: 'Added to Group',
        body: 'You were added to a group conversation.',
      };
    case 'group_removed':
      return {
        title: 'Removed from Group',
        body: 'You were removed from a group conversation.',
      };
    case 'group_admin_promote':
      return {
        title: 'Group Admin Role',
        body: 'You were promoted to group admin.',
      };
  }
}

export function isAlreadyExistsError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as { code?: unknown; message?: unknown };
  if (record.code === 6 || record.code === 'ALREADY_EXISTS' || record.code === 'already-exists') {
    return true;
  }
  if (typeof record.message === 'string' && record.message.includes('ALREADY_EXISTS')) {
    return true;
  }
  return false;
}

export async function isBlockedBetween(
  firestore: Firestore,
  uidA: string,
  uidB: string
): Promise<boolean> {
  if (!uidA || !uidB || uidA === uidB) return false;
  const [abSnap, baSnap] = await Promise.all([
    firestore.collection('blocks').doc(`${uidA}__${uidB}`).get(),
    firestore.collection('blocks').doc(`${uidB}__${uidA}`).get(),
  ]);
  return abSnap.exists || baSnap.exists;
}

export async function isConversationMuted(
  firestore: Firestore,
  conversationId: string,
  userId: string,
  requireMembershipDoc = false
): Promise<boolean> {
  if (!conversationId || !userId) return true;
  const memberSnap = await firestore
    .collection('conversationMembers')
    .doc(`${conversationId}__${userId}`)
    .get();
  if (!memberSnap.exists) {
    return requireMembershipDoc;
  }
  return memberSnap.data()?.muted === true;
}

export async function isPrivateCommunityMember(
  firestore: Firestore,
  communityId: string,
  userId: string
): Promise<boolean> {
  if (!communityId || !userId) return false;
  const commSnap = await firestore.collection('communities').doc(communityId).get();
  if (!commSnap.exists) return false;
  const commData = commSnap.data();
  if (commData?.status !== 'active') return false;
  if (commData?.visibility !== 'private') return true;
  const memberSnap = await firestore
    .collection('communityMemberships')
    .doc(`${communityId}__${userId}`)
    .get();
  return memberSnap.exists;
}

export async function resolveActorSummary(
  firestore: Firestore,
  actorId?: string
): Promise<ActorSummary> {
  if (!actorId) {
    return {
      username: '',
      displayName: 'ATA Member',
      avatarUrl: '',
    };
  }
  const snap = await firestore.collection('publicProfiles').doc(actorId).get();
  if (!snap.exists) {
    return {
      username: '',
      displayName: 'ATA Member',
      avatarUrl: '',
    };
  }
  const data = snap.data() || {};
  return {
    username: typeof data.username === 'string' ? data.username : '',
    displayName:
      typeof data.displayName === 'string' && data.displayName.trim()
        ? data.displayName
        : 'ATA Member',
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
  };
}

export async function dispatchNotification(
  firestore: Firestore,
  input: NotificationDispatchInput
): Promise<boolean> {
  const recipientId = input.recipientId.trim();
  const actorId = (input.actorId || '').trim();

  if (!recipientId) return false;
  if (actorId && actorId === recipientId) return false;

  if (actorId) {
    const blocked = await isBlockedBetween(firestore, actorId, recipientId);
    if (blocked) return false;
  }

  const settingsSnap = await firestore
    .collection('notificationSettings')
    .doc(recipientId)
    .get();
  if (!isCategoryEnabled(settingsSnap.data(), input.category)) {
    return false;
  }

  const actor = await resolveActorSummary(firestore, actorId);
  const sanitizedDedupe = sanitizeNotificationId(input.dedupeKey);
  const notificationId = buildNotificationId(recipientId, sanitizedDedupe);

  const payload: NotificationDocumentPayload = {
    id: notificationId,
    recipientId,
    actorId,
    actorUsername: actor.username,
    actorDisplayName: actor.displayName,
    actorAvatarUrl: actor.avatarUrl,
    type: input.type,
    category: input.category,
    title: input.title,
    body: input.body,
    targetType: input.targetType,
    targetId: input.targetId,
    route: input.route,
    isRead: false,
    isDismissed: false,
    createdAt: FieldValue.serverTimestamp(),
    readAt: null,
    dedupeKey: sanitizedDedupe,
    metadata: sanitizeMetadata(input.metadata),
  };

  try {
    await firestore.collection('notifications').doc(notificationId).create(payload);
    return true;
  } catch (err) {
    if (isAlreadyExistsError(err)) {
      return false;
    }
    throw err;
  }
}
