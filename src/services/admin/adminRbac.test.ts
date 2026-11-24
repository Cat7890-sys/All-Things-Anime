import assert from 'node:assert/strict';
import {
  ADMIN_SEAT_IDS,
  ALL_ADMIN_PERMISSIONS,
  CONTENT_ADMIN_DEFAULT_PERMISSIONS,
  hasAdminPermission,
  hasAnyAdminPermission,
  isAdminSessionActive,
  isSafeAuditSummary,
  isValidAdminPermission,
  isValidAdminSeatId,
  maskEmailForLog,
  MAX_ADMIN_SEATS,
  PLATFORM_ADMIN_DEFAULT_PERMISSIONS,
  sanitizeAdminPermissions,
  validateSeatMutation,
} from './adminRbac';

// 1. Strict 3-seat cap enforcement
assert.equal(MAX_ADMIN_SEATS, 3);
assert.deepEqual([...ADMIN_SEAT_IDS], ['owner', 'platform_admin', 'content_admin']);
assert.equal(isValidAdminSeatId('owner'), true);
assert.equal(isValidAdminSeatId('platform_admin'), true);
assert.equal(isValidAdminSeatId('content_admin'), true);
assert.equal(isValidAdminSeatId('moderator'), false);
assert.equal(isValidAdminSeatId('admin_4'), false);

// 2. Permission sanitization & defaults
const ownerPerms = sanitizeAdminPermissions('owner', ['user_management']);
assert.equal(ownerPerms.length, ALL_ADMIN_PERMISSIONS.length);

const customPlatformPerms = sanitizeAdminPermissions('platform_admin', [
  'user_management',
  'invalid_perm',
  'user_management',
  'announcements',
]);
assert.deepEqual(customPlatformPerms, ['user_management', 'announcements']);

const defaultContentPerms = sanitizeAdminPermissions('content_admin', []);
assert.deepEqual(defaultContentPerms, [...CONTENT_ADMIN_DEFAULT_PERMISSIONS]);
assert.ok(PLATFORM_ADMIN_DEFAULT_PERMISSIONS.includes('account_moderation'));
assert.equal(isValidAdminPermission('admin_management'), true);
assert.equal(isValidAdminPermission('unknown_perm'), false);

// 3. Active session & permission gating
const activeContentAdmin = {
  uid: 'uid-content-1',
  status: 'active' as const,
  role: 'content_admin' as const,
  permissions: ['anime_news' as const, 'where_to_watch' as const],
};
assert.equal(isAdminSessionActive(activeContentAdmin), true);
assert.equal(hasAdminPermission(activeContentAdmin, 'anime_news'), true);
assert.equal(hasAdminPermission(activeContentAdmin, 'admin_management'), false);
assert.equal(
  hasAnyAdminPermission(activeContentAdmin, ['audit_logs', 'where_to_watch']),
  true
);

const restrictedAdmin = {
  ...activeContentAdmin,
  status: 'restricted' as const,
};
assert.equal(isAdminSessionActive(restrictedAdmin), false);
assert.equal(hasAdminPermission(restrictedAdmin, 'anime_news'), false);

// 4. Owner protection & seat mutation validation
const ownerActor = {
  uid: 'uid-owner-1',
  role: 'owner' as const,
  status: 'active' as const,
};
const nonOwnerActor = {
  uid: 'uid-platform-2',
  role: 'platform_admin' as const,
  status: 'active' as const,
};

assert.equal(
  validateSeatMutation({
    actor: nonOwnerActor,
    targetSeatId: 'content_admin',
    targetUid: 'uid-target-3',
    nextStatus: 'active',
  }).ok,
  false
);

assert.equal(
  validateSeatMutation({
    actor: ownerActor,
    targetSeatId: 'owner',
    targetUid: ownerActor.uid,
    nextStatus: 'revoked',
  }).ok,
  false
);

assert.equal(
  validateSeatMutation({
    actor: ownerActor,
    targetSeatId: 'owner',
    targetUid: 'uid-new-owner',
    nextStatus: 'active',
    transferOwnership: false,
  }).ok,
  false
);

assert.equal(
  validateSeatMutation({
    actor: ownerActor,
    targetSeatId: 'owner',
    targetUid: 'uid-new-owner',
    nextStatus: 'active',
    transferOwnership: true,
  }).ok,
  true
);

assert.equal(
  validateSeatMutation({
    actor: ownerActor,
    targetSeatId: 'platform_admin',
    targetUid: 'uid-platform-2',
    nextStatus: 'restricted',
  }).ok,
  true
);

// 5. Audit safety & email masking
assert.equal(isSafeAuditSummary('Updated streaming provider gundaminfo.'), true);
assert.equal(isSafeAuditSummary('Failed login password:secret'), false);
assert.equal(maskEmailForLog('owner@example.com'), 'ow***@example.com');
assert.equal(maskEmailForLog(''), 'unknown');

console.log('adminRbac.test.ts: ALL ASSERTIONS PASSED');
