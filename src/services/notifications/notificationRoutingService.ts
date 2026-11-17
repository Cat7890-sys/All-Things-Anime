import type { AtaNotification } from '../../types';

export interface NotificationRouteParams {
  postId?: string;
  commentId?: string;
  communityId?: string;
  communityTab?: 'discussions' | 'rules' | 'members' | 'manage';
  conversationId?: string;
  requestId?: string;
  messagesTab?: 'chats' | 'requests' | 'groups';
  profileId?: string;
}

export interface NotificationRouteTarget {
  destination: 'home' | 'communities' | 'messages' | 'profile';
  params?: NotificationRouteParams;
}

function cleanParam(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseRoute(route?: string): {
  pathname: string;
  searchParams: URLSearchParams;
} {
  if (!route || typeof route !== 'string' || !route.startsWith('/')) {
    return { pathname: '', searchParams: new URLSearchParams() };
  }
  const qIndex = route.indexOf('?');
  if (qIndex === -1) {
    return { pathname: route, searchParams: new URLSearchParams() };
  }
  return {
    pathname: route.slice(0, qIndex),
    searchParams: new URLSearchParams(route.slice(qIndex + 1)),
  };
}

export function getNotificationRouteInfo(
  notification: AtaNotification
): NotificationRouteTarget {
  const { targetType, targetId, route, metadata, type } = notification;
  const { pathname, searchParams } = parseRoute(route);
  const pathSegments = pathname.split('/').filter(Boolean);

  const queryPostId = cleanParam(searchParams.get('postId'));
  const queryTab = cleanParam(searchParams.get('tab'));
  const metaCommunityId = cleanParam(metadata?.communityId);
  const metaPostId = cleanParam(metadata?.postId);
  const metaCommentId = cleanParam(metadata?.commentId);
  const metaRequestId = cleanParam(metadata?.requestId);
  const metaTab = cleanParam(metadata?.tab);
  const cleanTargetId = cleanParam(targetId);

  // 1. Removed from group: open Groups view cleanly without selecting inaccessible thread
  if (type === 'group_removed') {
    return {
      destination: 'messages',
      params: { messagesTab: 'groups' },
    };
  }

  // 2. Message request notifications -> Messages Requests tab
  if (
    targetType === 'message_request' ||
    type === 'new_message_request' ||
    (pathname === '/messages' && queryTab === 'requests')
  ) {
    const requestId = cleanTargetId || metaRequestId;
    return {
      destination: 'messages',
      params: {
        messagesTab: 'requests',
        ...(requestId ? { requestId } : {}),
      },
    };
  }

  // 3. Community or community-scoped post/comment
  if (
    targetType === 'community' ||
    pathSegments[0] === 'communities' ||
    Boolean(metaCommunityId)
  ) {
    const pathCommunityId =
      pathSegments[0] === 'communities' ? cleanParam(pathSegments[1]) : undefined;
    const communityId =
      metaCommunityId ||
      pathCommunityId ||
      (targetType === 'community' ? cleanTargetId : undefined);
    const postId =
      queryPostId ||
      metaPostId ||
      (targetType === 'post' || targetType === 'comment'
        ? cleanTargetId
        : undefined);
    const communityTab =
      metaTab === 'manage' || queryTab === 'manage' ? 'manage' : undefined;

    if (!communityId) {
      return { destination: 'communities' };
    }

    return {
      destination: 'communities',
      params: {
        communityId,
        ...(postId ? { postId } : {}),
        ...(metaCommentId ? { commentId: metaCommentId } : {}),
        ...(communityTab ? { communityTab } : {}),
      },
    };
  }

  // 4. Conversations & Group Chats
  if (
    targetType === 'conversation' ||
    targetType === 'group' ||
    pathSegments[0] === 'messages'
  ) {
    const pathConversationId =
      pathSegments[0] === 'messages' ? cleanParam(pathSegments[1]) : undefined;
    const conversationId =
      pathConversationId ||
      cleanTargetId ||
      (pathname && pathname !== '/messages'
        ? cleanParam(metadata?.conversationId)
        : undefined);
    const messagesTab: 'chats' | 'groups' =
      targetType === 'group' ? 'groups' : 'chats';

    return {
      destination: 'messages',
      params: {
        messagesTab,
        ...(conversationId ? { conversationId } : {}),
      },
    };
  }

  // 5. Profiles (followers, profile deep links)
  if (targetType === 'profile' || pathSegments[0] === 'profile') {
    const pathProfileId =
      pathSegments[0] === 'profile' ? cleanParam(pathSegments[1]) : undefined;
    const profileId = pathProfileId || cleanTargetId;
    return {
      destination: 'profile',
      params: profileId ? { profileId } : undefined,
    };
  }

  // 6. Global Feed Posts & Comments
  if (targetType === 'post' || targetType === 'comment' || queryPostId) {
    const postId = queryPostId || metaPostId || cleanTargetId;
    const commentId =
      targetType === 'comment' ? metaCommentId || cleanTargetId : metaCommentId;

    return {
      destination: 'home',
      params: postId
        ? {
            postId,
            ...(commentId ? { commentId } : {}),
          }
        : undefined,
    };
  }

  // 7. System notices / fallback
  return { destination: 'home' };
}
