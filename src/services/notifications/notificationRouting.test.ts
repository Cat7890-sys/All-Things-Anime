import assert from 'node:assert/strict';
import type { AtaNotification, AtaNotificationSettings } from '../../types/index.ts';
import {
  isCategoryEnabled,
  isQuietHoursActive,
} from './notificationPreferenceService.ts';
import { getNotificationRouteInfo } from './notificationRoutingService.ts';

function makeNotification(
  overrides: Partial<AtaNotification>
): AtaNotification {
  return {
    id: 'notif_1',
    recipientId: 'user_recipient',
    actorId: 'user_actor',
    actorUsername: 'sakura',
    actorDisplayName: 'Sakura',
    actorAvatarUrl: '',
    type: 'like_post',
    category: 'social',
    title: 'New Like',
    body: 'Liked your post.',
    isRead: false,
    isDismissed: false,
    createdAt: new Date(),
    readAt: null,
    dedupeKey: 'dedupe_1',
    ...overrides,
  };
}

// 1. Global post like / comment / reply routing
assert.deepEqual(
  getNotificationRouteInfo(
    makeNotification({
      type: 'like_post',
      targetType: 'post',
      targetId: 'post_123',
      route: '/?postId=post_123',
      metadata: { postId: 'post_123' },
    })
  ),
  {
    destination: 'home',
    params: { postId: 'post_123' },
  }
);

assert.deepEqual(
  getNotificationRouteInfo(
    makeNotification({
      type: 'reply_comment',
      targetType: 'comment',
      targetId: 'post_456',
      route: '/?postId=post_456',
      metadata: { postId: 'post_456', commentId: 'comment_789' },
    })
  ),
  {
    destination: 'home',
    params: { postId: 'post_456', commentId: 'comment_789' },
  }
);

// 2. Community post & comment routing
assert.deepEqual(
  getNotificationRouteInfo(
    makeNotification({
      type: 'comment_post',
      targetType: 'post',
      targetId: 'cpost_1',
      route: '/communities/comm_99?postId=cpost_1',
      metadata: {
        communityId: 'comm_99',
        postId: 'cpost_1',
        commentId: 'comm_c1',
      },
    })
  ),
  {
    destination: 'communities',
    params: {
      communityId: 'comm_99',
      postId: 'cpost_1',
      commentId: 'comm_c1',
    },
  }
);

// 3. Community join request (routes to manage tab) & approval/decline
assert.deepEqual(
  getNotificationRouteInfo(
    makeNotification({
      type: 'join_request',
      category: 'communities',
      targetType: 'community',
      targetId: 'comm_42',
      route: '/communities/comm_42',
      metadata: { communityId: 'comm_42', tab: 'manage' },
    })
  ),
  {
    destination: 'communities',
    params: { communityId: 'comm_42', communityTab: 'manage' },
  }
);

assert.deepEqual(
  getNotificationRouteInfo(
    makeNotification({
      type: 'approve_request',
      category: 'communities',
      targetType: 'community',
      targetId: 'comm_42',
      route: '/communities/comm_42',
    })
  ),
  {
    destination: 'communities',
    params: { communityId: 'comm_42' },
  }
);

// 4. Direct message, group message, message request, and group removed
assert.deepEqual(
  getNotificationRouteInfo(
    makeNotification({
      type: 'new_direct_message',
      category: 'messaging',
      targetType: 'conversation',
      targetId: 'dm_a__b',
      route: '/messages/dm_a__b',
    })
  ),
  {
    destination: 'messages',
    params: { messagesTab: 'chats', conversationId: 'dm_a__b' },
  }
);

assert.deepEqual(
  getNotificationRouteInfo(
    makeNotification({
      type: 'new_group_message',
      category: 'groups',
      targetType: 'group',
      targetId: 'grp_55',
      route: '/messages/grp_55',
    })
  ),
  {
    destination: 'messages',
    params: { messagesTab: 'groups', conversationId: 'grp_55' },
  }
);

assert.deepEqual(
  getNotificationRouteInfo(
    makeNotification({
      type: 'new_message_request',
      category: 'messaging',
      targetType: 'message_request',
      targetId: 'req_a__b',
      route: '/messages?tab=requests',
    })
  ),
  {
    destination: 'messages',
    params: { messagesTab: 'requests', requestId: 'req_a__b' },
  }
);

assert.deepEqual(
  getNotificationRouteInfo(
    makeNotification({
      type: 'group_removed',
      category: 'groups',
      targetType: 'conversation',
      targetId: '',
      route: '/messages',
      metadata: { conversationId: 'grp_55' },
    })
  ),
  {
    destination: 'messages',
    params: { messagesTab: 'groups' },
  }
);

// 5. Follower profile routing & safe fallback on missing/system targets
assert.deepEqual(
  getNotificationRouteInfo(
    makeNotification({
      type: 'new_follower',
      category: 'followers',
      targetType: 'profile',
      targetId: 'user_follower',
      route: '/profile/user_follower',
    })
  ),
  {
    destination: 'profile',
    params: { profileId: 'user_follower' },
  }
);

assert.deepEqual(
  getNotificationRouteInfo(
    makeNotification({
      type: 'system_notice',
      category: 'system',
      targetType: 'system',
      targetId: '',
      route: '',
    })
  ),
  { destination: 'home' }
);

// 6. Category preferences and quiet hours checks
const baseSettings: AtaNotificationSettings = {
  userId: 'user_recipient',
  enabled: true,
  socialEnabled: true,
  followersEnabled: true,
  communitiesEnabled: true,
  messagingEnabled: false,
  groupsEnabled: true,
  systemEnabled: true,
  popupEnabled: true,
  soundEnabled: false,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  timezone: 'UTC',
  updatedAt: null,
};

assert.equal(isCategoryEnabled(baseSettings, 'social'), true);
assert.equal(isCategoryEnabled(baseSettings, 'messaging'), false);
assert.equal(
  isCategoryEnabled({ ...baseSettings, enabled: false }, 'social'),
  false
);
assert.equal(
  isQuietHoursActive(baseSettings, new Date('2026-01-10T23:30:00Z')),
  true
);
assert.equal(
  isQuietHoursActive(baseSettings, new Date('2026-01-10T14:00:00Z')),
  false
);

console.log('All notification routing and preference checks passed!');
