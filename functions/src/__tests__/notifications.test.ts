import test from 'node:test';
import assert from 'node:assert/strict';
import type { Firestore } from 'firebase-admin/firestore';
import { ATA_DATABASE_ID, ATA_PROJECT_ID } from '../config';
import {
  buildNeutralMessagingCopy,
  buildNotificationId,
  dispatchNotification,
  isCategoryEnabled,
  isConversationMuted,
  sanitizeNotificationId,
} from '../notificationLogic';

interface MockDocStore {
  blocks: Map<string, Record<string, unknown>>;
  notificationSettings: Map<string, Record<string, unknown>>;
  publicProfiles: Map<string, Record<string, unknown>>;
  notifications: Map<string, Record<string, unknown>>;
  conversationMembers: Map<string, Record<string, unknown>>;
}

function createMockFirestore(seed?: Partial<MockDocStore>): {
  firestore: Firestore;
  store: MockDocStore;
} {
  const store: MockDocStore = {
    blocks: seed?.blocks ?? new Map(),
    notificationSettings: seed?.notificationSettings ?? new Map(),
    publicProfiles: seed?.publicProfiles ?? new Map(),
    notifications: seed?.notifications ?? new Map(),
    conversationMembers: seed?.conversationMembers ?? new Map(),
  };

  const firestore = {
    collection(name: keyof MockDocStore) {
      const map = store[name];
      return {
        doc(id: string) {
          return {
            async get() {
              const data = map.get(id);
              return {
                exists: data !== undefined,
                data: () => data,
              };
            },
            async create(payload: Record<string, unknown>) {
              if (map.has(id)) {
                const err = new Error('6 ALREADY_EXISTS: Document already exists') as Error & {
                  code: number;
                };
                err.code = 6;
                throw err;
              }
              map.set(id, payload);
            },
          };
        },
      };
    },
  } as unknown as Firestore;

  return { firestore, store };
}

test('Cloud Functions config targets named ATA database and causal-truth-2dx1j', () => {
  assert.equal(ATA_PROJECT_ID, 'causal-truth-2dx1j');
  assert.equal(
    ATA_DATABASE_ID,
    'ai-studio-ataallthingsanim-42a903d6-0b6a-478d-9d62-c82df4c9e0e2'
  );
  assert.notEqual(ATA_DATABASE_ID, '(default)');
});

test('sanitizeNotificationId and buildNotificationId produce rules-safe IDs', () => {
  const id = buildNotificationId('user_1', 'msg/conv:1?a=b');
  assert.match(id, /^[a-zA-Z0-9_-]+$/);
  assert.ok(sanitizeNotificationId('x'.repeat(400)).length <= 280);
});

test('isCategoryEnabled respects defaults, master switch, and category toggles', () => {
  assert.equal(isCategoryEnabled(undefined, 'social'), true);
  assert.equal(isCategoryEnabled({ enabled: false, socialEnabled: true }, 'social'), false);
  assert.equal(isCategoryEnabled({ enabled: true, messagingEnabled: false }, 'messaging'), false);
  assert.equal(isCategoryEnabled({ enabled: true, messagingEnabled: false }, 'groups'), true);
});

test('buildNeutralMessagingCopy never embeds private message content', () => {
  const dm = buildNeutralMessagingCopy('new_direct_message');
  const req = buildNeutralMessagingCopy('new_message_request');
  assert.equal(dm.body, 'You have a new direct message.');
  assert.equal(req.body, 'You received a new message request.');
});

test('dispatchNotification creates notification from genuine event with actor profile', async () => {
  const { firestore, store } = createMockFirestore({
    publicProfiles: new Map([
      [
        'actor_1',
        {
          username: 'kiri_01',
          displayName: 'Kiri',
          avatarUrl: 'https://cdn.example.com/kiri.png',
        },
      ],
    ]),
  });

  const created = await dispatchNotification(firestore, {
    recipientId: 'user_2',
    actorId: 'actor_1',
    type: 'comment_post',
    category: 'social',
    title: 'New Comment',
    body: 'Commented on your discussion.',
    targetType: 'post',
    targetId: 'post_99',
    route: '/?postId=post_99',
    dedupeKey: 'comment_c1',
    metadata: { postId: 'post_99', commentId: 'c1' },
  });

  assert.equal(created, true);
  assert.equal(store.notifications.size, 1);
  const saved = store.notifications.get('user_2__comment_c1');
  assert.ok(saved);
  assert.equal(saved.actorId, 'actor_1');
  assert.equal(saved.actorUsername, 'kiri_01');
  assert.equal(saved.isRead, false);
  assert.equal(saved.isDismissed, false);
});

test('dispatchNotification suppresses self-notifications and prevents duplicates on retry', async () => {
  const { firestore, store } = createMockFirestore();

  const selfResult = await dispatchNotification(firestore, {
    recipientId: 'user_1',
    actorId: 'user_1',
    type: 'like_post',
    category: 'social',
    title: 'New Like',
    body: 'Liked your post.',
    targetType: 'post',
    targetId: 'post_1',
    route: '/?postId=post_1',
    dedupeKey: 'like_post_1_user_1_evt1',
  });
  assert.equal(selfResult, false);

  const first = await dispatchNotification(firestore, {
    recipientId: 'user_2',
    actorId: 'user_1',
    type: 'like_post',
    category: 'social',
    title: 'New Like',
    body: 'Liked your post.',
    targetType: 'post',
    targetId: 'post_1',
    route: '/?postId=post_1',
    dedupeKey: 'like_post_1_user_1_evt1',
  });
  const retry = await dispatchNotification(firestore, {
    recipientId: 'user_2',
    actorId: 'user_1',
    type: 'like_post',
    category: 'social',
    title: 'New Like',
    body: 'Liked your post.',
    targetType: 'post',
    targetId: 'post_1',
    route: '/?postId=post_1',
    dedupeKey: 'like_post_1_user_1_evt1',
  });

  assert.equal(first, true);
  assert.equal(retry, false);
  assert.equal(store.notifications.size, 1);
});

test('dispatchNotification generates separate notifications for multiple messages in same conversation', async () => {
  const { firestore, store } = createMockFirestore();

  const m1 = await dispatchNotification(firestore, {
    recipientId: 'user_2',
    actorId: 'user_1',
    type: 'new_direct_message',
    category: 'messaging',
    title: 'New Message',
    body: 'You have a new direct message.',
    targetType: 'conversation',
    targetId: 'dm__user_1__user_2',
    route: '/messages/dm__user_1__user_2',
    dedupeKey: 'msg_dm__user_1__user_2_msg1',
  });

  const m2 = await dispatchNotification(firestore, {
    recipientId: 'user_2',
    actorId: 'user_1',
    type: 'new_direct_message',
    category: 'messaging',
    title: 'New Message',
    body: 'You have a new direct message.',
    targetType: 'conversation',
    targetId: 'dm__user_1__user_2',
    route: '/messages/dm__user_1__user_2',
    dedupeKey: 'msg_dm__user_1__user_2_msg2',
  });

  assert.equal(m1, true);
  assert.equal(m2, true);
  assert.equal(store.notifications.size, 2);
});

test('dispatchNotification respects bidirectional blocks and disabled notification categories', async () => {
  const { firestore, store } = createMockFirestore({
    blocks: new Map([
      ['user_2__actor_blocked_by_recipient', { blockerId: 'user_2', blockedId: 'actor_blocked_by_recipient' }],
      ['actor_blocking_recipient__user_2', { blockerId: 'actor_blocking_recipient', blockedId: 'user_2' }],
    ]),
    notificationSettings: new Map([
      ['user_muted_social', { enabled: true, socialEnabled: false }],
    ]),
  });

  const blocked1 = await dispatchNotification(firestore, {
    recipientId: 'user_2',
    actorId: 'actor_blocked_by_recipient',
    type: 'new_follower',
    category: 'followers',
    title: 'New Follower',
    body: 'Started following you.',
    targetType: 'profile',
    targetId: 'actor_blocked_by_recipient',
    route: '/profile/actor_blocked_by_recipient',
    dedupeKey: 'follow_1',
  });

  const blocked2 = await dispatchNotification(firestore, {
    recipientId: 'user_2',
    actorId: 'actor_blocking_recipient',
    type: 'new_follower',
    category: 'followers',
    title: 'New Follower',
    body: 'Started following you.',
    targetType: 'profile',
    targetId: 'actor_blocking_recipient',
    route: '/profile/actor_blocking_recipient',
    dedupeKey: 'follow_2',
  });

  const disabledCategory = await dispatchNotification(firestore, {
    recipientId: 'user_muted_social',
    actorId: 'actor_1',
    type: 'like_post',
    category: 'social',
    title: 'New Like',
    body: 'Liked your post.',
    targetType: 'post',
    targetId: 'post_1',
    route: '/?postId=post_1',
    dedupeKey: 'like_1',
  });

  assert.equal(blocked1, false);
  assert.equal(blocked2, false);
  assert.equal(disabledCategory, false);
  assert.equal(store.notifications.size, 0);
});

test('isConversationMuted checks muted flag and group membership', async () => {
  const { firestore } = createMockFirestore({
    conversationMembers: new Map([
      ['grp_1__user_muted', { muted: true }],
      ['grp_1__user_active', { muted: false }],
    ]),
  });

  assert.equal(await isConversationMuted(firestore, 'grp_1', 'user_muted', true), true);
  assert.equal(await isConversationMuted(firestore, 'grp_1', 'user_active', true), false);
  assert.equal(await isConversationMuted(firestore, 'grp_1', 'non_member', true), true);
});
