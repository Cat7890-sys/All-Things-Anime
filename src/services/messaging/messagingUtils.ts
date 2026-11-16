import { Timestamp } from 'firebase/firestore';
import type {
  AtaConversation,
  AtaConversationMember,
  AtaMessage,
  AtaMessageRequest,
  AtaMessageSettings,
  AtaTypingIndicator,
  AtaUserPresence,
  ConversationMemberRole,
  MessageRequestPermission,
  MessageRequestStatus,
} from '../../types';
import { auth } from '../firebase';

export const DEFAULT_MESSAGE_SETTINGS: Omit<AtaMessageSettings, 'uid' | 'updatedAt'> = {
  allowRequests: true,
  requestPermission: 'everyone',
  readReceiptsEnabled: true,
  onlineStatusVisible: true,
  typingIndicatorsEnabled: true,
};

export function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return null;
}

export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.slice(0, 80) || 'image.jpg';
}

export async function requireVerifiedMessagingUser(): Promise<{
  uid: string;
}> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in to access private messaging.');
  }
  if (!currentUser.emailVerified) {
    throw new Error(
      'Please verify your email address before using private messaging.'
    );
  }
  await currentUser.getIdToken(true);
  return { uid: currentUser.uid };
}

export function mapDocToMessageSettings(
  uid: string,
  data?: Record<string, unknown>
): AtaMessageSettings {
  if (!data) {
    return {
      uid,
      ...DEFAULT_MESSAGE_SETTINGS,
      updatedAt: null,
    };
  }
  const permission: MessageRequestPermission =
    data.requestPermission === 'following' || data.requestPermission === 'mutuals'
      ? data.requestPermission
      : 'everyone';

  return {
    uid,
    allowRequests:
      typeof data.allowRequests === 'boolean' ? data.allowRequests : true,
    requestPermission: permission,
    readReceiptsEnabled:
      typeof data.readReceiptsEnabled === 'boolean'
        ? data.readReceiptsEnabled
        : true,
    onlineStatusVisible:
      typeof data.onlineStatusVisible === 'boolean'
        ? data.onlineStatusVisible
        : true,
    typingIndicatorsEnabled:
      typeof data.typingIndicatorsEnabled === 'boolean'
        ? data.typingIndicatorsEnabled
        : true,
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function mapDocToUserPresence(
  uid: string,
  data?: Record<string, unknown>
): AtaUserPresence | null {
  if (!data) return null;
  return {
    uid,
    status: data.status === 'online' ? 'online' : 'away',
    visible: Boolean(data.visible),
    lastActiveAt: toDateOrNull(data.lastActiveAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function mapDocToConversation(
  id: string,
  data: Record<string, unknown>
): AtaConversation {
  return {
    id,
    type: data.type === 'group' ? 'group' : 'direct',
    directKey: typeof data.directKey === 'string' ? data.directKey : '',
    name: typeof data.name === 'string' ? data.name : '',
    description: typeof data.description === 'string' ? data.description : '',
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
    avatarPath: typeof data.avatarPath === 'string' ? data.avatarPath : '',
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
    adminIds: Array.isArray(data.adminIds)
      ? data.adminIds.map((v) => String(v))
      : [],
    participantIds: Array.isArray(data.participantIds)
      ? data.participantIds.map((v) => String(v))
      : [],
    lastMessageText:
      typeof data.lastMessageText === 'string' ? data.lastMessageText : '',
    lastMessageSenderId:
      typeof data.lastMessageSenderId === 'string'
        ? data.lastMessageSenderId
        : '',
    lastMessageType:
      data.lastMessageType === 'system' || data.lastMessageType === 'none'
        ? data.lastMessageType
        : 'text',
    lastMessageAt: toDateOrNull(data.lastMessageAt),
    status: data.status === 'archived' ? 'archived' : 'active',
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function mapDocToConversationMember(
  id: string,
  data: Record<string, unknown>
): AtaConversationMember {
  const role: ConversationMemberRole =
    data.role === 'owner'
      ? 'owner'
      : data.role === 'admin'
        ? 'admin'
        : 'member';

  return {
    id,
    conversationId: String(data.conversationId || ''),
    userId: String(data.userId || ''),
    username: String(data.username || ''),
    displayName: String(data.displayName || 'ATA Member'),
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
    role,
    unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : 0,
    lastReadAt: toDateOrNull(data.lastReadAt),
    muted: Boolean(data.muted),
    archived: Boolean(data.archived),
    joinedAt: toDateOrNull(data.joinedAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function mapDocToMessage(
  id: string,
  data: Record<string, unknown>
): AtaMessage {
  return {
    id,
    conversationId: String(data.conversationId || ''),
    senderId: String(data.senderId || ''),
    senderUsername: String(data.senderUsername || ''),
    senderDisplayName: String(data.senderDisplayName || 'ATA Member'),
    senderAvatarUrl:
      typeof data.senderAvatarUrl === 'string' ? data.senderAvatarUrl : '',
    messageType: data.messageType === 'system' ? 'system' : 'text',
    text: typeof data.text === 'string' ? data.text : '',
    replyToMessageId:
      typeof data.replyToMessageId === 'string' ? data.replyToMessageId : '',
    replyToPreview:
      typeof data.replyToPreview === 'string' ? data.replyToPreview : '',
    replyToSenderName:
      typeof data.replyToSenderName === 'string' ? data.replyToSenderName : '',
    editedAt: toDateOrNull(data.editedAt),
    deletedAt: toDateOrNull(data.deletedAt),
    createdAt: toDateOrNull(data.createdAt),
  };
}

export function mapDocToMessageRequest(
  id: string,
  data: Record<string, unknown>
): AtaMessageRequest {
  const status: MessageRequestStatus =
    data.status === 'accepted' ||
    data.status === 'declined' ||
    data.status === 'cancelled'
      ? data.status
      : 'pending';

  return {
    id,
    senderId: String(data.senderId || ''),
    senderUsername: String(data.senderUsername || ''),
    senderDisplayName: String(data.senderDisplayName || 'ATA Member'),
    senderAvatarUrl:
      typeof data.senderAvatarUrl === 'string' ? data.senderAvatarUrl : '',
    recipientId: String(data.recipientId || ''),
    recipientUsername: String(data.recipientUsername || ''),
    recipientDisplayName: String(data.recipientDisplayName || 'ATA Member'),
    recipientAvatarUrl:
      typeof data.recipientAvatarUrl === 'string'
        ? data.recipientAvatarUrl
        : '',
    initialMessage: String(data.initialMessage || ''),
    status,
    conversationId:
      typeof data.conversationId === 'string' ? data.conversationId : '',
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function mapDocToTypingIndicator(
  uid: string,
  data: Record<string, unknown>
): AtaTypingIndicator {
  return {
    uid,
    displayName: String(data.displayName || 'ATA Member'),
    isTyping: Boolean(data.isTyping),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}
