import type { AtaNotification } from '../../types';

export interface NotificationRouteTarget {
  destination: 'home' | 'communities' | 'messages' | 'profile';
  params?: {
    postId?: string;
    commentId?: string;
    communityId?: string;
    conversationId?: string;
    profileId?: string;
  };
}

export function getNotificationRouteInfo(
  notification: AtaNotification
): NotificationRouteTarget {
  const { targetType, targetId, route } = notification;

  if (route && route.startsWith('/')) {
    if (route.startsWith('/communities/')) {
      const parts = route.split('/');
      const communityId = parts[2];
      return { destination: 'communities', params: { communityId } };
    }
    if (route.startsWith('/messages/')) {
      const parts = route.split('/');
      const conversationId = parts[2];
      return { destination: 'messages', params: { conversationId } };
    }
    if (route.startsWith('/profile/')) {
      const parts = route.split('/');
      const profileId = parts[2];
      return { destination: 'profile', params: { profileId } };
    }
  }

  switch (targetType) {
    case 'post':
    case 'comment':
      return {
        destination: 'home',
        params: {
          postId: targetId,
          commentId:
            targetType === 'comment'
              ? notification.metadata?.commentId || targetId
              : undefined,
        },
      };
    case 'profile':
      return {
        destination: 'profile',
        params: { profileId: targetId },
      };
    case 'community':
      return {
        destination: 'communities',
        params: { communityId: targetId },
      };
    case 'conversation':
    case 'message_request':
      return {
        destination: 'messages',
        params: { conversationId: targetId },
      };
    case 'group':
      return {
        destination: 'messages',
        params: { conversationId: targetId },
      };
    default:
      return { destination: 'home' };
  }
}
