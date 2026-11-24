import test from 'node:test';
import assert from 'node:assert/strict';
import type { Firestore } from 'firebase-admin/firestore';
import {
  AdminAuthError,
  checkRecentReauth,
  maskEmail,
  sanitizeAuditSummary,
  sanitizePermissionsForRole,
  validateSeatUpdateRequest,
  verifyCallerIsActiveAdmin,
} from '../admin/adminLogic';

function createMockAdminDb(adminsSeed: Record<string, Record<string, unknown>>): Firestore {
  return {
    collection(name: string) {
      return {
        doc(id: string) {
          return {
            async get() {
              const data = name === 'admins' ? adminsSeed[id] : undefined;
              return {
                exists: data !== undefined,
                data: () => data,
              };
            },
          };
        },
      };
    },
  } as unknown as Firestore;
}

test('verifyCallerIsActiveAdmin rejects unauthenticated, unverified, non-admin, and restricted callers', async () => {
  const db = createMockAdminDb({
    uid_owner: {
      uid: 'uid_owner',
      seatId: 'owner',
      role: 'owner',
      status: 'active',
      permissions: ['admin_management'],
    },
    uid_restricted: {
      uid: 'uid_restricted',
      seatId: 'platform_admin',
      role: 'platform_admin',
      status: 'restricted',
      permissions: ['user_management'],
    },
    uid_content: {
      uid: 'uid_content',
      seatId: 'content_admin',
      role: 'content_admin',
      status: 'active',
      permissions: ['where_to_watch'],
    },
  });

  await assert.rejects(
    () => verifyCallerIsActiveAdmin(db, undefined),
    (err: unknown) => err instanceof AdminAuthError && err.code === 'unauthenticated'
  );

  await assert.rejects(
    () =>
      verifyCallerIsActiveAdmin(db, {
        uid: 'uid_owner',
        token: { email_verified: false },
      }),
    (err: unknown) => err instanceof AdminAuthError && err.code === 'permission-denied'
  );

  await assert.rejects(
    () =>
      verifyCallerIsActiveAdmin(db, {
        uid: 'uid_ordinary_member',
        token: { email_verified: true },
      }),
    (err: unknown) => err instanceof AdminAuthError && err.code === 'permission-denied'
  );

  await assert.rejects(
    () =>
      verifyCallerIsActiveAdmin(db, {
        uid: 'uid_restricted',
        token: { email_verified: true },
      }),
    (err: unknown) => err instanceof AdminAuthError && err.code === 'permission-denied'
  );

  await assert.rejects(
    () =>
      verifyCallerIsActiveAdmin(
        db,
        {
          uid: 'uid_content',
          token: { email_verified: true, ataAdminRole: 'content_admin' },
        },
        'admin_management'
      ),
    (err: unknown) => err instanceof AdminAuthError && err.code === 'permission-denied'
  );

  const ok = await verifyCallerIsActiveAdmin(
    db,
    {
      uid: 'uid_content',
      token: { email_verified: true, ataAdminRole: 'content_admin' },
    },
    'where_to_watch'
  );
  assert.equal(ok.seatId, 'content_admin');
  assert.equal(ok.status, 'active');
});

test('validateSeatUpdateRequest strictly enforces 3-seat cap and owner protection', () => {
  assert.throws(() =>
    validateSeatUpdateRequest({
      actorRole: 'platform_admin',
      actorUid: 'uid_2',
      seatId: 'content_admin',
      targetUid: 'uid_user_3',
      nextStatus: 'active',
    })
  );

  assert.throws(() =>
    validateSeatUpdateRequest({
      actorRole: 'owner',
      actorUid: 'uid_1',
      seatId: 'fourth_admin',
      targetUid: 'uid_user_4',
      nextStatus: 'active',
    })
  );

  assert.throws(() =>
    validateSeatUpdateRequest({
      actorRole: 'owner',
      actorUid: 'uid_1',
      seatId: 'owner',
      targetUid: 'uid_1',
      nextStatus: 'revoked',
    })
  );

  assert.doesNotThrow(() =>
    validateSeatUpdateRequest({
      actorRole: 'owner',
      actorUid: 'uid_1',
      seatId: 'owner',
      targetUid: 'uid_new_owner',
      nextStatus: 'active',
      transferOwnership: true,
    })
  );
});

test('checkRecentReauth rejects stale sessions and maskEmail/sanitizeAuditSummary redact sensitive data', () => {
  const now = 1_700_000_000;
  assert.throws(() =>
    checkRecentReauth({ uid: 'u1', token: { auth_time: now - 1200 } }, now, 900)
  );
  assert.doesNotThrow(() =>
    checkRecentReauth({ uid: 'u1', token: { auth_time: now - 120 } }, now, 900)
  );
  assert.equal(maskEmail('admin@example.com'), 'ad***@example.com');
  assert.match(sanitizeAuditSummary('Failed login password=secret_pw'), /\[REDACTED\]/);
  assert.ok(sanitizePermissionsForRole('owner', ['where_to_watch']).includes('admin_management'));
});
