import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export type AdminSeatId = 'owner' | 'platform_admin' | 'content_admin';
export type AdminRole = AdminSeatId;
export type AdminSeatStatus = 'active' | 'restricted' | 'revoked';

export const MAX_ADMIN_SEATS = 3;

export const ADMIN_SEAT_IDS: readonly AdminSeatId[] = [
  'owner',
  'platform_admin',
  'content_admin',
] as const;

export const ALL_ADMIN_PERMISSIONS: readonly string[] = [
  'user_management',
  'account_moderation',
  'user_reports',
  'content_moderation',
  'community_management',
  'copyright_complaints',
  'user_feedback',
  'announcements',
  'platform_statistics',
  'operational_monitoring',
  'catalogue_management',
  'metadata_corrections',
  'featured_content',
  'seasonal_displays',
  'anime_news',
  'recommendations',
  'where_to_watch',
  'country_availability',
  'streaming_verification',
  'legal_compliance',
  'security_incidents',
  'admin_management',
  'audit_logs',
  'system_health',
] as const;

export const PLATFORM_ADMIN_DEFAULTS: readonly string[] = [
  'user_management',
  'account_moderation',
  'user_reports',
  'content_moderation',
  'community_management',
  'copyright_complaints',
  'user_feedback',
  'announcements',
  'platform_statistics',
  'operational_monitoring',
] as const;

export const CONTENT_ADMIN_DEFAULTS: readonly string[] = [
  'catalogue_management',
  'metadata_corrections',
  'featured_content',
  'seasonal_displays',
  'anime_news',
  'recommendations',
  'where_to_watch',
  'country_availability',
  'streaming_verification',
  'copyright_complaints',
] as const;

export interface CallerAuthContext {
  uid?: string;
  token?: {
    email?: string;
    email_verified?: boolean;
    auth_time?: number;
    ataAdminRole?: string;
    ataAdminSeat?: string;
  };
}

export interface VerifiedAdminSession {
  uid: string;
  seatId: AdminSeatId;
  role: AdminRole;
  email: string;
  displayLabel: string;
  permissions: string[];
  status: AdminSeatStatus;
}

export class AdminAuthError extends Error {
  code: 'unauthenticated' | 'permission-denied' | 'failed-precondition' | 'invalid-argument';

  constructor(
    code: 'unauthenticated' | 'permission-denied' | 'failed-precondition' | 'invalid-argument',
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

export function maskEmail(email: string): string {
  const trimmed = (email || '').trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 1) return trimmed ? '***@unknown' : 'unknown';
  return `${trimmed.slice(0, 2)}***@${trimmed.slice(atIndex + 1)}`;
}

export function sanitizeAuditSummary(summary: string): string {
  return String(summary || '')
    .replace(/(password|token|secret|apikey|privatekey|messagebody)\s*[:=]\s*\S+/gi, '$1:[REDACTED]')
    .slice(0, 400);
}

export function sanitizePermissionsForRole(
  role: AdminRole,
  requested?: readonly string[]
): string[] {
  if (role === 'owner') {
    return [...ALL_ADMIN_PERMISSIONS];
  }
  const allowedSet = new Set(ALL_ADMIN_PERMISSIONS);
  if (!requested || requested.length === 0) {
    return role === 'platform_admin'
      ? [...PLATFORM_ADMIN_DEFAULTS]
      : [...CONTENT_ADMIN_DEFAULTS];
  }
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of requested) {
    if (allowedSet.has(item) && !seen.has(item)) {
      seen.add(item);
      unique.push(item);
    }
  }
  return unique;
}

export function checkRecentReauth(
  authContext: CallerAuthContext | undefined,
  nowEpochSeconds: number = Math.floor(Date.now() / 1000),
  maxAgeSeconds: number = 900
): void {
  const authTime = authContext?.token?.auth_time;
  if (typeof authTime !== 'number' || nowEpochSeconds - authTime > maxAgeSeconds) {
    throw new AdminAuthError(
      'failed-precondition',
      'Recent reauthentication is required before performing this sensitive administrator action.'
    );
  }
}

export async function verifyCallerIsActiveAdmin(
  firestore: Firestore,
  authContext: CallerAuthContext | undefined,
  requiredPermission?: string
): Promise<VerifiedAdminSession> {
  const uid = authContext?.uid;
  if (!uid) {
    throw new AdminAuthError('unauthenticated', 'Administrator authentication is required.');
  }
  if (authContext?.token?.email_verified !== true) {
    throw new AdminAuthError(
      'permission-denied',
      'Verified email authentication is required for administrator access.'
    );
  }

  const adminSnap = await firestore.collection('admins').doc(uid).get();
  if (!adminSnap.exists) {
    throw new AdminAuthError(
      'permission-denied',
      'Your account is not assigned to any of the three ATA administrator seats.'
    );
  }

  const data = adminSnap.data() || {};
  const role = data.role as AdminRole;
  const seatId = data.seatId as AdminSeatId;
  const status = data.status as AdminSeatStatus;

  if (
    !(ADMIN_SEAT_IDS as readonly string[]).includes(role) ||
    !(ADMIN_SEAT_IDS as readonly string[]).includes(seatId)
  ) {
    throw new AdminAuthError('permission-denied', 'Invalid administrator seat configuration.');
  }

  if (status !== 'active') {
    throw new AdminAuthError(
      'permission-denied',
      status === 'restricted'
        ? 'Your administrator access is currently restricted by the Owner.'
        : 'Your administrator access has been revoked.'
    );
  }

  // If custom claims exist on the token, ensure they were not revoked or downgraded out-of-band
  const tokenRole = authContext.token?.ataAdminRole;
  if (typeof tokenRole === 'string' && tokenRole.length > 0 && tokenRole !== role) {
    throw new AdminAuthError(
      'permission-denied',
      'Administrator session claims do not match current seat privileges. Please sign in again.'
    );
  }

  const permissions = Array.isArray(data.permissions)
    ? data.permissions.map((p) => String(p))
    : [];

  if (requiredPermission && role !== 'owner' && !permissions.includes(requiredPermission)) {
    throw new AdminAuthError(
      'permission-denied',
      `Missing required administrator permission: ${requiredPermission}.`
    );
  }

  return {
    uid,
    seatId,
    role,
    email: String(data.email || authContext.token?.email || ''),
    displayLabel: String(data.displayLabel || seatId),
    permissions: role === 'owner' ? [...ALL_ADMIN_PERMISSIONS] : permissions,
    status,
  };
}

export function validateSeatUpdateRequest(params: {
  actorRole: AdminRole;
  actorUid: string;
  seatId: string;
  targetUid: string;
  nextStatus: string;
  transferOwnership?: boolean;
}): void {
  const { actorRole, actorUid, seatId, targetUid, nextStatus, transferOwnership } = params;

  if (actorRole !== 'owner') {
    throw new AdminAuthError(
      'permission-denied',
      'Only the Owner / Super Admin can manage administrator seats and permissions.'
    );
  }
  if (!(ADMIN_SEAT_IDS as readonly string[]).includes(seatId)) {
    throw new AdminAuthError(
      'invalid-argument',
      'Seat ID must be one of owner, platform_admin, or content_admin (maximum 3 seats).'
    );
  }
  if (!targetUid || targetUid.trim().length < 6 || targetUid.trim().length > 128) {
    throw new AdminAuthError('invalid-argument', 'Valid target user UID is required.');
  }
  if (!['active', 'restricted', 'revoked'].includes(nextStatus)) {
    throw new AdminAuthError('invalid-argument', 'Invalid seat status.');
  }

  if (seatId === 'owner' && !transferOwnership) {
    if (nextStatus !== 'active') {
      throw new AdminAuthError(
        'failed-precondition',
        'The Owner seat cannot be restricted or revoked.'
      );
    }
    if (targetUid.trim() !== actorUid) {
      throw new AdminAuthError(
        'failed-precondition',
        'Transferring the Owner seat requires explicit ownership transfer confirmation.'
      );
    }
  }

  if (transferOwnership) {
    if (seatId !== 'owner') {
      throw new AdminAuthError('invalid-argument', 'Ownership transfer applies only to the owner seat.');
    }
    if (targetUid.trim() === actorUid) {
      throw new AdminAuthError('invalid-argument', 'New Owner UID must differ from current Owner UID.');
    }
  }
}

export async function writeImmutableAuditLog(
  firestore: Firestore,
  entry: {
    actorUid: string;
    actorRole: AdminRole | 'system' | 'anonymous';
    actorSeatId: AdminSeatId | 'system' | 'none';
    actionType: string;
    targetCollection: string;
    targetId: string;
    summary: string;
  }
): Promise<string> {
  const docRef = firestore.collection('adminAuditLogs').doc();
  await docRef.set({
    id: docRef.id,
    actorUid: entry.actorUid,
    actorRole: entry.actorRole,
    actorSeatId: entry.actorSeatId,
    actionType: entry.actionType.slice(0, 80),
    targetCollection: entry.targetCollection.slice(0, 80),
    targetId: entry.targetId.slice(0, 200),
    summary: sanitizeAuditSummary(entry.summary),
    source: 'cloud_function',
    createdAt: FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

export async function writeAdminLoginEvent(
  firestore: Firestore,
  event: {
    actorUid: string;
    email: string;
    seatId: AdminSeatId | 'unknown';
    outcome:
      | 'login_success'
      | 'login_denied'
      | 'login_failed'
      | 'logout'
      | 'reauth_success'
      | 'reauth_failed';
    reason: string;
  }
): Promise<void> {
  const docRef = firestore.collection('adminLoginEvents').doc();
  await docRef.set({
    id: docRef.id,
    actorUid: event.actorUid || 'anonymous',
    emailMasked: maskEmail(event.email),
    seatId: event.seatId,
    outcome: event.outcome,
    reason: sanitizeAuditSummary(event.reason),
    createdAt: FieldValue.serverTimestamp(),
  });
}
