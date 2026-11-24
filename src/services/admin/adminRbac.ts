import type {
  AdminAccountRecord,
  AdminPermission,
  AdminRole,
  AdminSeatId,
  AdminSeatStatus,
} from '../../types';

export const MAX_ADMIN_SEATS = 3;

export const ADMIN_SEAT_IDS: readonly AdminSeatId[] = [
  'owner',
  'platform_admin',
  'content_admin',
] as const;

export interface AdminPermissionMeta {
  id: AdminPermission;
  label: string;
  group:
    | 'Users & Safety'
    | 'Content & Moderation'
    | 'Catalogue & Streaming'
    | 'Platform & Operations'
    | 'Governance & Security';
  description: string;
}

export const ADMIN_PERMISSION_CATALOG: readonly AdminPermissionMeta[] = [
  {
    id: 'user_management',
    label: 'User Management',
    group: 'Users & Safety',
    description: 'Search accounts, inspect profile status, and manage verification badges.',
  },
  {
    id: 'account_moderation',
    label: 'Account Moderation',
    group: 'Users & Safety',
    description: 'Suspend, ban, restore accounts, and process deletion requests.',
  },
  {
    id: 'user_reports',
    label: 'User Reports',
    group: 'Users & Safety',
    description: 'Review user-reported profiles and safety flags.',
  },
  {
    id: 'content_moderation',
    label: 'Content Moderation',
    group: 'Content & Moderation',
    description: 'Review reported posts, comments, collections, and hide or restore items.',
  },
  {
    id: 'community_management',
    label: 'Community Management',
    group: 'Content & Moderation',
    description: 'Review reported communities, archive unsafe spaces, and adjust featured flags.',
  },
  {
    id: 'copyright_complaints',
    label: 'Copyright & Takedowns',
    group: 'Content & Moderation',
    description: 'Review copyright/DMCA takedown requests and retain compliance records.',
  },
  {
    id: 'user_feedback',
    label: 'User Feedback',
    group: 'Platform & Operations',
    description: 'Review bug reports, accessibility feedback, and user suggestions.',
  },
  {
    id: 'announcements',
    label: 'Platform Announcements',
    group: 'Platform & Operations',
    description: 'Draft, preview, publish, and archive maintenance or platform notices.',
  },
  {
    id: 'platform_statistics',
    label: 'Platform Statistics',
    group: 'Platform & Operations',
    description: 'Inspect verified database counts across ATA collections.',
  },
  {
    id: 'operational_monitoring',
    label: 'Operational Monitoring',
    group: 'Platform & Operations',
    description: 'Inspect moderation queues, recent client/service errors, and guidelines.',
  },
  {
    id: 'catalogue_management',
    label: 'Anime Catalogue',
    group: 'Catalogue & Streaming',
    description: 'Manage ATA catalogue visibility and editorial notes over AniList entries.',
  },
  {
    id: 'metadata_corrections',
    label: 'Metadata Corrections',
    group: 'Catalogue & Streaming',
    description: 'Fix ATA display titles, synopses, and metadata error flags.',
  },
  {
    id: 'featured_content',
    label: 'Featured & Trending',
    group: 'Catalogue & Streaming',
    description: 'Pin or highlight featured series and trending anime spotlights.',
  },
  {
    id: 'seasonal_displays',
    label: 'Seasonal Displays',
    group: 'Catalogue & Streaming',
    description: 'Curate seasonal display highlights in Discover & Calendar.',
  },
  {
    id: 'anime_news',
    label: 'Anime News Manager',
    group: 'Catalogue & Streaming',
    description: 'Publish, edit, feature, and archive ATA News Centre articles.',
  },
  {
    id: 'recommendations',
    label: 'Recommendation Curation',
    group: 'Catalogue & Streaming',
    description: 'Curate pinned series recommendations without fabricating personalization metrics.',
  },
  {
    id: 'where_to_watch',
    label: 'Where to Watch Providers',
    group: 'Catalogue & Streaming',
    description: 'Add, edit, or deactivate free legal anime streaming providers.',
  },
  {
    id: 'country_availability',
    label: 'Country Availability',
    group: 'Catalogue & Streaming',
    description: 'Manage country-specific free legal streaming availability entries.',
  },
  {
    id: 'streaming_verification',
    label: 'Streaming Verification',
    group: 'Catalogue & Streaming',
    description: 'Review availability reports and update official HTTPS verification dates.',
  },
  {
    id: 'legal_compliance',
    label: 'Legal & Compliance',
    group: 'Governance & Security',
    description: 'Update community guidelines, legal review dates, and inspect compliance register.',
  },
  {
    id: 'security_incidents',
    label: 'Security Incidents',
    group: 'Governance & Security',
    description: 'Record and track security incident containment and regulatory notifications.',
  },
  {
    id: 'system_health',
    label: 'System Health',
    group: 'Governance & Security',
    description: 'Inspect Firebase connectivity, database target, and storage/service readiness.',
  },
  {
    id: 'admin_management',
    label: 'Administrator Management',
    group: 'Governance & Security',
    description: 'Assign, configure permissions, restrict, or transfer the 3 administrator seats.',
  },
  {
    id: 'audit_logs',
    label: 'Audit & Login Logs',
    group: 'Governance & Security',
    description: 'Inspect immutable admin audit logs and login/logout security events.',
  },
] as const;

export const ALL_ADMIN_PERMISSIONS: readonly AdminPermission[] =
  ADMIN_PERMISSION_CATALOG.map((p) => p.id);

export const PLATFORM_ADMIN_DEFAULT_PERMISSIONS: readonly AdminPermission[] = [
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

export const CONTENT_ADMIN_DEFAULT_PERMISSIONS: readonly AdminPermission[] = [
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

export const ADMIN_SEAT_METADATA: Record<
  AdminSeatId,
  {
    title: string;
    role: AdminRole;
    description: string;
    defaultPermissions: readonly AdminPermission[];
  }
> = {
  owner: {
    title: 'Admin 1 — Owner / Super Admin',
    role: 'owner',
    description:
      'Full platform governance, legal/compliance, system health, security incidents, audit logs, and 3-seat administration. Protected against removal or demotion.',
    defaultPermissions: ALL_ADMIN_PERMISSIONS,
  },
  platform_admin: {
    title: 'Admin 2 — Platform Admin',
    role: 'platform_admin',
    description:
      'Operations, user management, account moderation, user & content reports, communities, feedback, announcements, and platform statistics.',
    defaultPermissions: PLATFORM_ADMIN_DEFAULT_PERMISSIONS,
  },
  content_admin: {
    title: 'Admin 3 — Content Admin',
    role: 'content_admin',
    description:
      'Anime catalogue overrides, metadata corrections, featured/seasonal curation, anime news, recommendations, and Where to Watch free streaming verification.',
    defaultPermissions: CONTENT_ADMIN_DEFAULT_PERMISSIONS,
  },
};

export function isValidAdminSeatId(value: string): value is AdminSeatId {
  return (ADMIN_SEAT_IDS as readonly string[]).includes(value);
}

export function isValidAdminPermission(value: string): value is AdminPermission {
  return (ALL_ADMIN_PERMISSIONS as readonly string[]).includes(value);
}

export function sanitizeAdminPermissions(
  role: AdminRole,
  requested?: readonly string[]
): AdminPermission[] {
  if (role === 'owner') {
    return [...ALL_ADMIN_PERMISSIONS];
  }
  if (!requested || requested.length === 0) {
    return [...ADMIN_SEAT_METADATA[role].defaultPermissions];
  }
  const unique: AdminPermission[] = [];
  const seen = new Set<string>();
  for (const item of requested) {
    if (isValidAdminPermission(item) && !seen.has(item)) {
      seen.add(item);
      unique.push(item);
    }
  }
  return unique;
}

export function isAdminSessionActive(
  admin: Pick<AdminAccountRecord, 'status' | 'role'> | null | undefined
): boolean {
  if (!admin) return false;
  return admin.status === 'active' && isValidAdminSeatId(admin.role);
}

export function hasAdminPermission(
  admin: Pick<AdminAccountRecord, 'status' | 'role' | 'permissions'> | null | undefined,
  permission: AdminPermission
): boolean {
  if (!isAdminSessionActive(admin)) return false;
  if (!admin) return false;
  if (admin.role === 'owner') return true;
  return Array.isArray(admin.permissions) && admin.permissions.includes(permission);
}

export function hasAnyAdminPermission(
  admin: Pick<AdminAccountRecord, 'status' | 'role' | 'permissions'> | null | undefined,
  permissions: readonly AdminPermission[]
): boolean {
  return permissions.some((p) => hasAdminPermission(admin, p));
}

export interface SeatMutationValidation {
  ok: boolean;
  error?: string;
}

export function validateSeatMutation(params: {
  actor: Pick<AdminAccountRecord, 'uid' | 'role' | 'status'>;
  targetSeatId: AdminSeatId;
  targetUid: string;
  nextStatus: AdminSeatStatus;
  transferOwnership?: boolean;
}): SeatMutationValidation {
  const { actor, targetSeatId, targetUid, nextStatus, transferOwnership } = params;

  if (actor.status !== 'active' || actor.role !== 'owner') {
    return {
      ok: false,
      error: 'Only the active Owner / Super Admin can modify administrator seats or permissions.',
    };
  }

  if (!isValidAdminSeatId(targetSeatId)) {
    return {
      ok: false,
      error: 'Invalid administrator seat. ATA strictly enforces a maximum of 3 designated seats.',
    };
  }

  if (!targetUid || targetUid.trim().length < 6 || targetUid.trim().length > 128) {
    return {
      ok: false,
      error: 'A valid Firebase Auth UID is required for administrator seat assignment.',
    };
  }

  if (targetSeatId === 'owner' && !transferOwnership) {
    if (nextStatus !== 'active') {
      return {
        ok: false,
        error: 'The Owner / Super Admin seat cannot be restricted, suspended, or revoked.',
      };
    }
    if (targetUid.trim() !== actor.uid) {
      return {
        ok: false,
        error:
          'Changing the Owner UID requires an explicit Owner Transfer confirmation.',
      };
    }
  }

  if (transferOwnership && targetSeatId !== 'owner') {
    return {
      ok: false,
      error: 'Ownership transfer can only target the Owner seat.',
    };
  }

  if (transferOwnership && targetUid.trim() === actor.uid) {
    return {
      ok: false,
      error: 'Transfer target UID must differ from the current Owner UID.',
    };
  }

  return { ok: true };
}

const SENSITIVE_AUDIT_KEYS = [
  'password',
  'token',
  'idtoken',
  'secret',
  'apikey',
  'privatekey',
  'messagebody',
  'directmessage',
] as const;

export function isSafeAuditSummary(summary: string): boolean {
  const lower = summary.toLowerCase();
  return !SENSITIVE_AUDIT_KEYS.some((key) => lower.includes(`${key}:`) || lower.includes(`${key}=`));
}

export function maskEmailForLog(email: string): string {
  const trimmed = (email || '').trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 1) {
    return trimmed ? '***@unknown' : 'unknown';
  }
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const visibleLocal = local.slice(0, 2);
  return `${visibleLocal}***@${domain}`;
}
