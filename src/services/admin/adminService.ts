import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type {
  AccountDeletionRequest,
  AdminAccountRecord,
  AdminAuditLogEntry,
  AdminLoginEvent,
  AdminNewsArticle,
  AdminPermission,
  AdminReportRecord,
  AdminSeatId,
  AdminSeatStatus,
  AdminSeatSummary,
  AnimeChallenge,
  AnimeStreamingAvailability,
  AtaCommunity,
  AtaPost,
  AtaUserAccount,
  CatalogueOverrideRecord,
  CopyrightComplaint,
  LegalDocumentOverride,
  LegalPageSlug,
  ModerationDecisionRecord,
  PlatformAnnouncement,
  SecurityIncidentRecord,
  StreamingAvailabilityReport,
  StreamingProvider,
  UserCollection,
  UserFeedbackRecord,
  WatchParty,
} from '../../types';
import { mapDocToChallenge } from '../challenges/challengeService';
import {
  isApprovedOfficialStreamingUrl,
  isEligibleVerifiedFreeAvailability,
  isEligibleVerifiedFreeProvider,
} from '../companion/streamingDirectory';
import { auth, db, firebaseProjectMeta, functions, isStorageConfigured } from '../firebase';
import { invalidateCacheKey, invalidateCachePrefix } from '../memoryCache';
import { mapDocToWatchParty } from '../watchParties/watchPartyService';
import {
  validateAdminNewsInput,
  validateAnnouncementInput,
  validateCountryCode,
  validateSecurityIncidentInput,
} from '../validation';
import {
  ADMIN_SEAT_IDS,
  ADMIN_SEAT_METADATA,
  isValidAdminSeatId,
  sanitizeAdminPermissions,
} from './adminRbac';

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (
    value &&
    typeof value === 'object' &&
    '_seconds' in value &&
    typeof (value as { _seconds: unknown })._seconds === 'number'
  ) {
    return new Date((value as { _seconds: number })._seconds * 1000);
  }
  return null;
}

function isFunctionsUnavailableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code: unknown }).code) : '';
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    code.includes('not-found') ||
    code.includes('unavailable') ||
    code.includes('internal') ||
    msg.includes('failed to fetch') ||
    msg.includes('cors') ||
    msg.includes('network')
  );
}

export interface AdminSessionResult {
  admin: AdminAccountRecord | null;
  cloudFunctionsAvailable: boolean;
  denialReason?: string;
}

export async function verifyAdminSession(): Promise<AdminSessionResult> {
  const user = auth.currentUser;
  if (!user) {
    return {
      admin: null,
      cloudFunctionsAvailable: true,
      denialReason: 'Sign in with an authorised administrator account.',
    };
  }
  await user.reload().catch(() => {});
  if (!user.emailVerified) {
    return {
      admin: null,
      cloudFunctionsAvailable: true,
      denialReason:
        'Administrator access requires a verified email address on Firebase Auth.',
    };
  }
  await user.getIdToken(true);

  try {
    const callable = httpsCallable<
      Record<string, never>,
      { authorized: boolean; admin: Record<string, unknown> }
    >(functions, 'adminGetSessionContext');
    const res = await callable({});
    if (res.data?.authorized && res.data.admin) {
      const a = res.data.admin;
      const role = String(a.role || '');
      const seatId = String(a.seatId || role);
      if (!isValidAdminSeatId(role) || !isValidAdminSeatId(seatId)) {
        return {
          admin: null,
          cloudFunctionsAvailable: true,
          denialReason: 'Account does not hold a valid designated admin seat.',
        };
      }
      return {
        cloudFunctionsAvailable: true,
        admin: {
          uid: String(a.uid || user.uid),
          seatId,
          role,
          displayLabel: String(a.displayLabel || user.displayName || seatId),
          email: String(a.email || user.email || ''),
          permissions: Array.isArray(a.permissions)
            ? (a.permissions as AdminPermission[])
            : [],
          status: (a.status as AdminSeatStatus) || 'active',
          restrictionReason:
            typeof a.restrictionReason === 'string' ? a.restrictionReason : '',
          assignedByUid: String(a.assignedByUid || ''),
          assignedAt: toDateOrNull(a.assignedAt),
          updatedAt: toDateOrNull(a.updatedAt),
          lastLoginAt: new Date(),
        },
      };
    }
  } catch (err) {
    if (!isFunctionsUnavailableError(err)) {
      const message =
        err instanceof Error
          ? err.message
          : 'This account is not authorised for the ATA Admin Portal.';
      return {
        admin: null,
        cloudFunctionsAvailable: true,
        denialReason: message,
      };
    }

    // Fallback check when Cloud Functions are not yet deployed: verify against admins/{uid} doc directly
    try {
      const snap = await getDoc(doc(db, 'admins', user.uid));
      if (!snap.exists()) {
        return {
          admin: null,
          cloudFunctionsAvailable: false,
          denialReason:
            'This account is not registered in the ATA administrators collection.',
        };
      }
      const data = snap.data();
      const role = String(data.role || '');
      const seatId = String(data.seatId || role);
      const status = String(data.status || 'revoked') as AdminSeatStatus;
      if (!isValidAdminSeatId(role) || !isValidAdminSeatId(seatId)) {
        return {
          admin: null,
          cloudFunctionsAvailable: false,
          denialReason: 'Invalid administrator seat configuration.',
        };
      }
      if (status !== 'active') {
        return {
          admin: null,
          cloudFunctionsAvailable: false,
          denialReason: `Administrator access is currently ${status}.${
            data.restrictionReason ? ` Reason: ${data.restrictionReason}` : ''
          }`,
        };
      }
      return {
        cloudFunctionsAvailable: false,
        admin: {
          uid: user.uid,
          seatId,
          role,
          displayLabel: String(data.displayLabel || user.displayName || seatId),
          email: String(data.email || user.email || ''),
          permissions: sanitizeAdminPermissions(
            role,
            Array.isArray(data.permissions)
              ? data.permissions.map((p) => String(p))
              : undefined
          ),
          status: 'active',
          restrictionReason:
            typeof data.restrictionReason === 'string'
              ? data.restrictionReason
              : '',
          assignedByUid: String(data.assignedByUid || ''),
          assignedAt: toDateOrNull(data.assignedAt),
          updatedAt: toDateOrNull(data.updatedAt),
          lastLoginAt: toDateOrNull(data.lastLoginAt),
        },
      };
    } catch {
      return {
        admin: null,
        cloudFunctionsAvailable: false,
        denialReason:
          'This account does not have active administrator permissions on Firestore.',
      };
    }
  }

  return {
    admin: null,
    cloudFunctionsAvailable: true,
    denialReason: 'Unable to verify administrator session.',
  };
}

export async function recordAdminLoginSecurityEvent(params: {
  outcome: 'login_failed' | 'logout' | 'reauth_success' | 'reauth_failed';
  email?: string;
  reason?: string;
}): Promise<void> {
  try {
    const callable = httpsCallable(functions, 'adminRecordSecurityEvent');
    await callable({
      outcome: params.outcome,
      email: params.email || '',
      reason: params.reason || params.outcome,
    });
  } catch {
    // Best effort: do not crash sign-out or failed login display if functions are offline
  }
}

export async function reauthenticateAdminPassword(
  password: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('No signed-in administrator account found.');
  }
  if (!password) {
    throw new Error('Enter your password to confirm this sensitive action.');
  }
  try {
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
    await user.getIdToken(true);
    await recordAdminLoginSecurityEvent({
      outcome: 'reauth_success',
      email: user.email,
      reason: 'Admin reauthenticated within sensitive action modal.',
    });
  } catch (err) {
    await recordAdminLoginSecurityEvent({
      outcome: 'reauth_failed',
      email: user.email,
      reason: err instanceof Error ? err.message : 'Reauthentication failed.',
    });
    throw new Error('Password verification failed. Please check your password and try again.');
  }
}

export async function recordConsoleAuditLog(
  admin: AdminAccountRecord,
  entry: {
    actionType: string;
    targetCollection: string;
    targetId: string;
    summary: string;
  }
): Promise<void> {
  try {
    const logRef = doc(collection(db, 'adminAuditLogs'));
    await setDoc(logRef, {
      id: logRef.id,
      actorUid: admin.uid,
      actorRole: admin.role,
      actorSeatId: admin.seatId,
      actionType: entry.actionType.slice(0, 80),
      targetCollection: entry.targetCollection.slice(0, 80),
      targetId: (entry.targetId || 'none').slice(0, 200),
      summary: entry.summary.slice(0, 400),
      source: 'admin_console',
      createdAt: serverTimestamp(),
    });
  } catch {
    // Audit logging should not mask primary error messages, though Firestore rules require it for console tracking
  }
}

export interface AdminOverviewStats {
  totalUsers: number;
  totalPosts: number;
  totalCommunities: number;
  totalCollections: number;
  totalChallenges: number;
  totalWatchParties: number;
  totalChallengeParticipations: number;
  totalReports: number;
  totalCopyrightComplaints: number;
  totalDeletionRequests: number;
  totalFeedback: number;
  totalStreamingReports: number;
  totalAdminNews: number;
}

async function safeCount(colName: string): Promise<number> {
  try {
    const snap = await getCountFromServer(collection(db, colName));
    return snap.data().count;
  } catch {
    return 0;
  }
}

export async function fetchAdminOverviewStats(): Promise<AdminOverviewStats> {
  const [
    totalUsers,
    totalPosts,
    totalCommunities,
    totalCollections,
    totalChallenges,
    totalWatchParties,
    totalChallengeParticipations,
    totalReports,
    totalCopyrightComplaints,
    totalDeletionRequests,
    totalFeedback,
    totalStreamingReports,
    totalAdminNews,
  ] = await Promise.all([
    safeCount('users'),
    safeCount('posts'),
    safeCount('communities'),
    safeCount('userCollections'),
    safeCount('animeChallenges'),
    safeCount('watchParties'),
    safeCount('challengeParticipants'),
    safeCount('reports'),
    safeCount('copyrightComplaints'),
    safeCount('accountDeletionRequests'),
    safeCount('userFeedback'),
    safeCount('streamingReports'),
    safeCount('adminNews'),
  ]);

  return {
    totalUsers,
    totalPosts,
    totalCommunities,
    totalCollections,
    totalChallenges,
    totalWatchParties,
    totalChallengeParticipations,
    totalReports,
    totalCopyrightComplaints,
    totalDeletionRequests,
    totalFeedback,
    totalStreamingReports,
    totalAdminNews,
  };
}

// ==========================================
// Module A: Users & Deletion Requests
// ==========================================

export async function listUsersForAdmin(maxCount = 80): Promise<AtaUserAccount[]> {
  const q = query(
    collection(db, 'users'),
    orderBy('updatedAt', 'desc'),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: String(data.uid || d.id),
      username: String(data.username || ''),
      usernameLowercase: String(data.usernameLowercase || ''),
      displayName: String(data.displayName || ''),
      email: String(data.email || ''),
      bio: typeof data.bio === 'string' ? data.bio : '',
      avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
      emailVerified: Boolean(data.emailVerified),
      accountStatus: (data.accountStatus as AtaUserAccount['accountStatus']) || 'active',
      suspensionReason:
        typeof data.suspensionReason === 'string' ? data.suspensionReason : undefined,
      suspendedUntil: toDateOrNull(data.suspendedUntil),
      banReason: typeof data.banReason === 'string' ? data.banReason : undefined,
      isVerifiedBadge: Boolean(data.isVerifiedBadge),
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  });
}

export async function listDeletionRequestsForAdmin(): Promise<AccountDeletionRequest[]> {
  const q = query(
    collection(db, 'accountDeletionRequests'),
    orderBy('createdAt', 'desc'),
    limit(80)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId: String(data.userId || ''),
      username: String(data.username || ''),
      email: String(data.email || ''),
      reason: String(data.reason || ''),
      acknowledgedIrreversible: Boolean(data.acknowledgedIrreversible),
      status: (data.status as AccountDeletionRequest['status']) || 'pending',
      reviewNotes:
        typeof data.reviewNotes === 'string' ? data.reviewNotes : undefined,
      reviewedByUid:
        typeof data.reviewedByUid === 'string' ? data.reviewedByUid : undefined,
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  });
}

export async function moderateUserViaCallable(params: {
  action:
    | 'suspend'
    | 'ban'
    | 'restore'
    | 'toggle_verify'
    | 'complete_deletion_request'
    | 'decline_deletion_request';
  targetUid: string;
  reason?: string;
  isVerifiedBadge?: boolean;
  deletionRequestId?: string;
}): Promise<void> {
  const callable = httpsCallable(functions, 'adminModerateUser');
  try {
    await callable(params);
  } catch (err) {
    if (isFunctionsUnavailableError(err)) {
      throw new Error(
        'Cloud Function adminModerateUser is not deployed yet. Account disabling and token revocation require deployed Cloud Functions — see /ADMIN_PROVISIONING.md.'
      );
    }
    throw err;
  }
}

export async function updateDeletionRequestDirect(
  admin: AdminAccountRecord,
  requestId: string,
  status: 'under_review' | 'completed' | 'declined',
  reviewNotes: string
): Promise<void> {
  await updateDoc(doc(db, 'accountDeletionRequests', requestId), {
    status,
    reviewNotes: reviewNotes.trim().slice(0, 500),
    reviewedByUid: admin.uid,
    updatedAt: serverTimestamp(),
  });
  await recordConsoleAuditLog(admin, {
    actionType: `deletion_request_${status}`,
    targetCollection: 'accountDeletionRequests',
    targetId: requestId,
    summary: `Deletion request ${requestId} marked ${status}.`,
  });
}

// ==========================================
// Module B: Reports, Copyright & Content Moderation
// ==========================================

export async function listReportsForAdmin(maxCount = 80): Promise<AdminReportRecord[]> {
  const q = query(
    collection(db, 'reports'),
    orderBy('createdAt', 'desc'),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      reporterId: String(data.reporterId || ''),
      targetType: data.targetType as AdminReportRecord['targetType'],
      targetId: String(data.targetId || ''),
      postId: String(data.postId || ''),
      communityId:
        typeof data.communityId === 'string' ? data.communityId : undefined,
      conversationId:
        typeof data.conversationId === 'string' ? data.conversationId : undefined,
      targetAuthorId: String(data.targetAuthorId || ''),
      reason: data.reason as AdminReportRecord['reason'],
      details: String(data.details || ''),
      status: (data.status as AdminReportRecord['status']) || 'open',
      reviewNotes:
        typeof data.reviewNotes === 'string' ? data.reviewNotes : undefined,
      reviewedByUid:
        typeof data.reviewedByUid === 'string' ? data.reviewedByUid : undefined,
      reviewedAt: toDateOrNull(data.reviewedAt),
      createdAt: toDateOrNull(data.createdAt),
    };
  });
}

export async function listCopyrightComplaintsForAdmin(
  maxCount = 80
): Promise<CopyrightComplaint[]> {
  const q = query(
    collection(db, 'copyrightComplaints'),
    orderBy('createdAt', 'desc'),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      reporterUid: String(data.reporterUid || ''),
      claimantName: String(data.claimantName || ''),
      claimantEmail: String(data.claimantEmail || ''),
      rightsHolderOrganization: String(data.rightsHolderOrganization || ''),
      workTitle: String(data.workTitle || ''),
      targetType:
        (data.targetType as CopyrightComplaint['targetType']) || 'other',
      targetReference: String(data.targetReference || ''),
      description: String(data.description || ''),
      goodFaithConfirmed: Boolean(data.goodFaithConfirmed),
      accuracyConfirmed: Boolean(data.accuracyConfirmed),
      status: (data.status as CopyrightComplaint['status']) || 'pending',
      resolutionNotes:
        typeof data.resolutionNotes === 'string'
          ? data.resolutionNotes
          : undefined,
      handledByUid:
        typeof data.handledByUid === 'string' ? data.handledByUid : undefined,
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  });
}

export async function listModerationDecisionsForAdmin(
  maxCount = 60
): Promise<ModerationDecisionRecord[]> {
  const q = query(
    collection(db, 'moderationDecisions'),
    orderBy('createdAt', 'desc'),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      targetType: data.targetType as ModerationDecisionRecord['targetType'],
      targetId: String(data.targetId || ''),
      action: data.action as ModerationDecisionRecord['action'],
      reason: String(data.reason || ''),
      evidenceSummary: String(data.evidenceSummary || ''),
      actorUid: String(data.actorUid || ''),
      actorRole: (data.actorRole as AdminAccountRecord['role']) || 'platform_admin',
      createdAt: toDateOrNull(data.createdAt),
    };
  });
}

export async function listRecentPostsForAdmin(maxCount = 40): Promise<
  Array<
    AtaPost & {
      moderationStatus?: string;
      moderationReason?: string;
    }
  >
> {
  const q = query(
    collection(db, 'posts'),
    orderBy('createdAt', 'desc'),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      authorId: String(data.authorId || ''),
      authorUsername: String(data.authorUsername || ''),
      authorDisplayName: String(data.authorDisplayName || ''),
      authorAvatarUrl: typeof data.authorAvatarUrl === 'string' ? data.authorAvatarUrl : '',
      content: String(data.content || ''),
      animeTitle: typeof data.animeTitle === 'string' ? data.animeTitle : '',
      hasSpoiler: Boolean(data.hasSpoiler),
      spoilerLabel: typeof data.spoilerLabel === 'string' ? data.spoilerLabel : '',
      imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
      imagePath: typeof data.imagePath === 'string' ? data.imagePath : '',
      likeCount: typeof data.likeCount === 'number' ? data.likeCount : 0,
      commentCount: typeof data.commentCount === 'number' ? data.commentCount : 0,
      isEdited: Boolean(data.isEdited),
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
      moderationStatus:
        typeof data.moderationStatus === 'string' ? data.moderationStatus : 'active',
      moderationReason:
        typeof data.moderationReason === 'string' ? data.moderationReason : undefined,
    };
  });
}

export async function listCommunitiesForAdmin(maxCount = 50): Promise<
  Array<
    AtaCommunity & {
      moderationStatus?: string;
    }
  >
> {
  const q = query(
    collection(db, 'communities'),
    orderBy('createdAt', 'desc'),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: String(data.name || ''),
      nameLowercase: String(data.nameLowercase || ''),
      slug: String(data.slug || ''),
      description: String(data.description || ''),
      avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
      avatarPath: typeof data.avatarPath === 'string' ? data.avatarPath : '',
      coverUrl: typeof data.coverUrl === 'string' ? data.coverUrl : '',
      coverPath: typeof data.coverPath === 'string' ? data.coverPath : '',
      category: (data.category as AtaCommunity['category']) || 'General',
      animeTags: Array.isArray(data.animeTags)
        ? data.animeTags.map((v) => String(v))
        : [],
      rules: Array.isArray(data.rules) ? data.rules.map((v) => String(v)) : [],
      ownerId: String(data.ownerId || ''),
      moderatorIds: Array.isArray(data.moderatorIds)
        ? data.moderatorIds.map((v) => String(v))
        : [],
      memberCount: typeof data.memberCount === 'number' ? data.memberCount : 0,
      visibility: data.visibility === 'private' ? 'private' : 'public',
      status: data.status === 'archived' ? 'archived' : 'active',
      isFeatured: Boolean(data.isFeatured),
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
      moderationStatus:
        typeof data.moderationStatus === 'string' ? data.moderationStatus : 'active',
    };
  });
}

export async function listCollectionsForAdmin(maxCount = 50): Promise<UserCollection[]> {
  const q = query(
    collection(db, 'userCollections'),
    orderBy('updatedAt', 'desc'),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ownerId: String(data.ownerId || ''),
      ownerUsername: String(data.ownerUsername || ''),
      ownerDisplayName: String(data.ownerDisplayName || ''),
      ownerAvatarUrl: String(data.ownerAvatarUrl || ''),
      title: String(data.title || ''),
      description: String(data.description || ''),
      coverImageUrl: String(data.coverImageUrl || ''),
      visibility: data.visibility === 'public' ? 'public' : 'private',
      items: [],
      itemCount: typeof data.itemCount === 'number' ? data.itemCount : 0,
      likeCount: typeof data.likeCount === 'number' ? data.likeCount : 0,
      saveCount: typeof data.saveCount === 'number' ? data.saveCount : 0,
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  });
}

export async function moderateContentViaCallableOrDirect(
  admin: AdminAccountRecord,
  params: {
    kind: 'report' | 'copyright' | 'post' | 'comment' | 'community' | 'collection';
    targetId: string;
    action: 'remove' | 'restore' | 'dismiss' | 'escalate';
    reason: string;
    evidenceSummary?: string;
    reportStatus?: AdminReportRecord['status'];
    copyrightStatus?: CopyrightComplaint['status'];
    contentCollection?: string;
    contentDocPath?: string;
  }
): Promise<void> {
  try {
    const callable = httpsCallable(functions, 'adminModerateContent');
    await callable({
      kind: params.kind,
      targetId: params.targetId,
      action: params.action,
      reason: params.reason,
      evidenceSummary:
        params.evidenceSummary ||
        `Action ${params.action} on ${params.kind} ${params.targetId}`,
      reportStatus: params.reportStatus,
      status: params.copyrightStatus,
      contentCollection: params.contentCollection,
      contentDocPath: params.contentDocPath,
    });
    if (params.kind === 'collection') {
      invalidateCacheKey(`collectionById:${params.targetId}`);
      invalidateCachePrefix('publicCollections:');
      invalidateCachePrefix('publicCollectionsByOwner:');
      invalidateCachePrefix('userCollections:');
    } else if (params.kind === 'community') {
      invalidateCacheKey(`communityById:${params.targetId}`);
      invalidateCachePrefix('communities:popular:');
      invalidateCachePrefix('communities:recent:');
      invalidateCachePrefix('communities:owned:');
    }
    return;
  } catch (err) {
    if (!isFunctionsUnavailableError(err)) {
      throw err;
    }
  }

  // Fallback for direct-rule collections (reports, copyrightComplaints, userCollections)
  if (params.kind === 'report') {
    await updateDoc(doc(db, 'reports', params.targetId), {
      status: params.reportStatus || 'action_taken',
      reviewNotes: params.reason.slice(0, 500),
      reviewedByUid: admin.uid,
      reviewedAt: serverTimestamp(),
    });
  } else if (params.kind === 'copyright') {
    await updateDoc(doc(db, 'copyrightComplaints', params.targetId), {
      status: params.copyrightStatus || 'action_taken',
      resolutionNotes: params.reason.slice(0, 800),
      handledByUid: admin.uid,
      updatedAt: serverTimestamp(),
    });
  } else if (params.kind === 'collection') {
    await updateDoc(doc(db, 'userCollections', params.targetId), {
      visibility: params.action === 'remove' ? 'private' : 'public',
      updatedAt: serverTimestamp(),
    });
    invalidateCacheKey(`collectionById:${params.targetId}`);
    invalidateCachePrefix('publicCollections:');
    invalidateCachePrefix('publicCollectionsByOwner:');
    invalidateCachePrefix('userCollections:');
  } else {
    throw new Error(
      `Moderating ${params.kind} documents requires the adminModerateContent Cloud Function to be deployed. See /ADMIN_PROVISIONING.md.`
    );
  }

  const decisionRef = doc(collection(db, 'moderationDecisions'));
  await setDoc(decisionRef, {
    id: decisionRef.id,
    targetType: params.contentCollection || params.kind,
    targetId: params.targetId,
    action: params.action,
    reason: (params.reason || 'Reviewed by admin').slice(0, 400),
    evidenceSummary: (
      params.evidenceSummary ||
      `Direct admin console review (${params.kind} ${params.targetId}).`
    ).slice(0, 600),
    actorUid: admin.uid,
    actorRole: admin.role,
    createdAt: serverTimestamp(),
  });

  await recordConsoleAuditLog(admin, {
    actionType: `moderate_${params.kind}_${params.action}`,
    targetCollection: params.contentCollection || params.kind,
    targetId: params.targetId,
    summary: `Moderated ${params.kind} ${params.targetId} (${params.action}).`,
  });
}

export async function fetchAdminChallengesAndParties(maxCount = 50): Promise<{
  challenges: AnimeChallenge[];
  watchParties: WatchParty[];
}> {
  const [chSnap, wpSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'animeChallenges'),
        orderBy('updatedAt', 'desc'),
        limit(maxCount)
      )
    ),
    getDocs(
      query(
        collection(db, 'watchParties'),
        orderBy('updatedAt', 'desc'),
        limit(maxCount)
      )
    ),
  ]);

  return {
    challenges: chSnap.docs.map((d) =>
      mapDocToChallenge(d.id, d.data() as Record<string, unknown>)
    ),
    watchParties: wpSnap.docs.map((d) =>
      mapDocToWatchParty(d.id, d.data() as Record<string, unknown>)
    ),
  };
}

export async function moderateEventViaAdmin(
  admin: AdminAccountRecord,
  params: {
    eventType: 'challenge' | 'watch_party';
    eventId: string;
    action: 'remove' | 'suspend' | 'restore' | 'feature' | 'unfeature';
    reason?: string;
  }
): Promise<void> {
  const cleanReason = (params.reason || '').trim().slice(0, 400);
  try {
    const callable = httpsCallable(functions, 'adminModerateEvent');
    await callable({
      eventType: params.eventType,
      eventId: params.eventId,
      action: params.action,
      reason: cleanReason,
    });
    if (params.eventType === 'watch_party') {
      invalidateCacheKey(`watchPartyById:${params.eventId}`);
      invalidateCachePrefix('watchParties:list:');
    } else {
      invalidateCacheKey(`challengeById:${params.eventId}`);
      invalidateCachePrefix('challenges:list:');
    }
    return;
  } catch (err) {
    if (!isFunctionsUnavailableError(err)) {
      throw err;
    }
  }

  // Fallback direct Firestore update permitted by firestore.rules for active admins
  const colName =
    params.eventType === 'watch_party' ? 'watchParties' : 'animeChallenges';
  const ref = doc(db, colName, params.eventId);
  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (params.action === 'remove') {
    updates.moderationStatus = 'removed_by_moderator';
    updates.moderationReason = cleanReason || 'Removed by administrator';
    updates.moderatedAt = serverTimestamp();
    updates.moderatedBy = admin.uid;
  } else if (params.action === 'suspend') {
    updates.moderationStatus = 'suspended';
    updates.moderationReason = cleanReason || 'Suspended by administrator';
    updates.status = params.eventType === 'watch_party' ? 'cancelled' : 'archived';
    updates.moderatedAt = serverTimestamp();
    updates.moderatedBy = admin.uid;
  } else if (params.action === 'restore') {
    updates.moderationStatus = 'active';
    updates.moderationReason = '';
    updates.status = params.eventType === 'watch_party' ? 'scheduled' : 'active';
    updates.moderatedAt = serverTimestamp();
    updates.moderatedBy = admin.uid;
  } else if (
    params.eventType === 'challenge' &&
    (params.action === 'feature' || params.action === 'unfeature')
  ) {
    updates.isFeatured = params.action === 'feature';
  } else {
    throw new Error('Unsupported event moderation action.');
  }

  await updateDoc(ref, updates);
  if (params.eventType === 'watch_party') {
    invalidateCacheKey(`watchPartyById:${params.eventId}`);
    invalidateCachePrefix('watchParties:list:');
  } else {
    invalidateCacheKey(`challengeById:${params.eventId}`);
    invalidateCachePrefix('challenges:list:');
  }

  const decisionRef = doc(collection(db, 'moderationDecisions'));
  await setDoc(decisionRef, {
    id: decisionRef.id,
    targetType: params.eventType,
    targetId: params.eventId,
    action:
      params.action === 'feature' || params.action === 'unfeature'
        ? 'restore'
        : params.action,
    reason: cleanReason || `Admin ${params.action} on ${params.eventType}.`,
    evidenceSummary: `Admin console direct ${params.action} on ${colName}/${params.eventId}.`,
    actorUid: admin.uid,
    actorRole: admin.role,
    createdAt: serverTimestamp(),
  });

  await recordConsoleAuditLog(admin, {
    actionType: `event_${params.eventType}_${params.action}`,
    targetCollection: colName,
    targetId: params.eventId,
    summary: `Executed ${params.action} on ${params.eventType} ${params.eventId}.`,
  });
}

// ==========================================
// Module C: Catalogue Overrides & News Manager
// ==========================================

export async function listCatalogueOverridesForAdmin(): Promise<
  CatalogueOverrideRecord[]
> {
  const snap = await getDocs(query(collection(db, 'catalogueOverrides'), limit(500)));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      animeId: typeof data.animeId === 'number' ? data.animeId : Number(d.id) || 0,
      animeTitle: String(data.animeTitle || ''),
      overrideTitle:
        typeof data.overrideTitle === 'string' ? data.overrideTitle : '',
      overrideSynopsis:
        typeof data.overrideSynopsis === 'string' ? data.overrideSynopsis : '',
      editorialNote:
        typeof data.editorialNote === 'string' ? data.editorialNote : '',
      isFeatured: Boolean(data.isFeatured),
      isTrendingOverride: Boolean(data.isTrendingOverride),
      isSeasonalHighlight: Boolean(data.isSeasonalHighlight),
      recommendationPinned: Boolean(data.recommendationPinned),
      isHiddenFromCatalogue: Boolean(data.isHiddenFromCatalogue),
      metadataIssueFlag: Boolean(data.metadataIssueFlag),
      updatedByUid: String(data.updatedByUid || ''),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  });
}

export async function saveCatalogueOverride(
  admin: AdminAccountRecord,
  input: Omit<CatalogueOverrideRecord, 'id' | 'updatedByUid' | 'updatedAt'>
): Promise<void> {
  if (!Number.isInteger(input.animeId) || input.animeId <= 0) {
    throw new Error('AniList Anime ID must be a positive integer.');
  }
  const title = input.animeTitle.trim();
  if (!title || title.length > 200) {
    throw new Error('Anime reference title must be between 1 and 200 characters.');
  }

  const docId = String(input.animeId);
  const payload: Record<string, unknown> = {
    id: docId,
    animeId: input.animeId,
    animeTitle: title,
    isFeatured: Boolean(input.isFeatured),
    isTrendingOverride: Boolean(input.isTrendingOverride),
    isSeasonalHighlight: Boolean(input.isSeasonalHighlight),
    recommendationPinned: Boolean(input.recommendationPinned),
    isHiddenFromCatalogue: Boolean(input.isHiddenFromCatalogue),
    metadataIssueFlag: Boolean(input.metadataIssueFlag),
    updatedByUid: admin.uid,
    updatedAt: serverTimestamp(),
  };

  if (input.overrideTitle?.trim()) {
    payload.overrideTitle = input.overrideTitle.trim().slice(0, 200);
  }
  if (input.overrideSynopsis?.trim()) {
    payload.overrideSynopsis = input.overrideSynopsis.trim().slice(0, 2000);
  }
  if (input.editorialNote?.trim()) {
    payload.editorialNote = input.editorialNote.trim().slice(0, 500);
  }

  await setDoc(doc(db, 'catalogueOverrides', docId), payload);
  invalidateCacheKey('catalogueOverrides:all');
  await recordConsoleAuditLog(admin, {
    actionType: 'catalogue_override_saved',
    targetCollection: 'catalogueOverrides',
    targetId: docId,
    summary: `Saved catalogue override for AniList #${docId} (${title}).`,
  });
}

export async function deleteCatalogueOverride(
  admin: AdminAccountRecord,
  animeId: number
): Promise<void> {
  const docId = String(animeId);
  await deleteDoc(doc(db, 'catalogueOverrides', docId));
  invalidateCacheKey('catalogueOverrides:all');
  await recordConsoleAuditLog(admin, {
    actionType: 'catalogue_override_deleted',
    targetCollection: 'catalogueOverrides',
    targetId: docId,
    summary: `Removed catalogue override for AniList #${docId}.`,
  });
}

export async function listAllAdminNews(): Promise<AdminNewsArticle[]> {
  const q = query(
    collection(db, 'adminNews'),
    orderBy('updatedAt', 'desc'),
    limit(60)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: String(data.title || ''),
      source: String(data.source || ''),
      sourceUrl: typeof data.sourceUrl === 'string' ? data.sourceUrl : '',
      category: (data.category as AdminNewsArticle['category']) || 'Industry',
      publishedAt: String(data.publishedAt || ''),
      summary: String(data.summary || ''),
      imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
      author: String(data.author || ''),
      status: (data.status as AdminNewsArticle['status']) || 'draft',
      isFeatured: Boolean(data.isFeatured),
      createdByUid: String(data.createdByUid || ''),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  });
}

export async function saveAdminNewsArticle(
  admin: AdminAccountRecord,
  input: Omit<AdminNewsArticle, 'createdByUid' | 'updatedAt' | 'id'> & { id?: string }
): Promise<string> {
  const err = validateAdminNewsInput(input);
  if (err) throw new Error(err);

  const docRef = input.id
    ? doc(db, 'adminNews', input.id)
    : doc(collection(db, 'adminNews'));

  await setDoc(docRef, {
    id: docRef.id,
    title: input.title.trim(),
    source: input.source.trim(),
    sourceUrl: (input.sourceUrl || '').trim(),
    category: input.category,
    publishedAt: input.publishedAt.trim(),
    summary: input.summary.trim(),
    imageUrl: (input.imageUrl || '').trim(),
    author: input.author.trim(),
    status: input.status,
    isFeatured: Boolean(input.isFeatured),
    createdByUid: admin.uid,
    updatedAt: serverTimestamp(),
  });
  invalidateCacheKey('publishedAdminNews');

  await recordConsoleAuditLog(admin, {
    actionType: input.id ? 'admin_news_updated' : 'admin_news_created',
    targetCollection: 'adminNews',
    targetId: docRef.id,
    summary: `News article "${input.title.trim()}" (${input.status}).`,
  });

  return docRef.id;
}

export async function deleteAdminNewsArticle(
  admin: AdminAccountRecord,
  articleId: string
): Promise<void> {
  await deleteDoc(doc(db, 'adminNews', articleId));
  invalidateCacheKey('publishedAdminNews');
  await recordConsoleAuditLog(admin, {
    actionType: 'admin_news_deleted',
    targetCollection: 'adminNews',
    targetId: articleId,
    summary: `Deleted admin news article ${articleId}.`,
  });
}

// ==========================================
// Module D: Where to Watch Directory Admin CRUD
// ==========================================

export async function listAdminStreamingProviders(): Promise<StreamingProvider[]> {
  const snap = await getDocs(query(collection(db, 'streamingProviders'), limit(500)));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: String(data.name || ''),
      shortLabel: String(data.shortLabel || ''),
      accentHex: String(data.accentHex || '#EF3038'),
      logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : undefined,
      description: String(data.description || ''),
      supportedCountries: Array.isArray(data.supportedCountries)
        ? data.supportedCountries.map((c) => String(c))
        : [],
      officialUrl: String(data.officialUrl || ''),
      allowedDomains: Array.isArray(data.allowedDomains)
        ? data.allowedDomains.map((dom) => String(dom))
        : [],
      accessModel: data.accessModel === 'Free' ? 'Free' : 'Free with Ads',
      isFree: Boolean(data.isFree),
      isLegitimate: Boolean(data.isLegitimate),
      verificationStatus:
        (data.verificationStatus as StreamingProvider['verificationStatus']) ||
        'needs_review',
      lastVerifiedAt: String(data.lastVerifiedAt || ''),
    };
  });
}

export async function saveAdminStreamingProvider(
  admin: AdminAccountRecord,
  provider: StreamingProvider
): Promise<void> {
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(provider.id)) {
    throw new Error('Provider ID must use 2-64 letters, numbers, underscores, or hyphens.');
  }
  if (!isEligibleVerifiedFreeProvider(provider)) {
    throw new Error(
      'Provider must be marked isFree=true, isLegitimate=true, verificationStatus=verified, use an approved HTTPS official streaming domain, and list valid ISO country codes.'
    );
  }
  const payload: Record<string, unknown> = {
    id: provider.id,
    name: provider.name.trim(),
    shortLabel: provider.shortLabel.trim(),
    accentHex: provider.accentHex.trim(),
    description: provider.description.trim(),
    supportedCountries: provider.supportedCountries,
    officialUrl: provider.officialUrl.trim(),
    allowedDomains: provider.allowedDomains,
    accessModel: provider.accessModel,
    isFree: true,
    isLegitimate: true,
    verificationStatus: provider.verificationStatus,
    lastVerifiedAt: provider.lastVerifiedAt.trim(),
  };
  if (provider.logoUrl?.trim()) {
    payload.logoUrl = provider.logoUrl.trim();
  }

  await setDoc(doc(db, 'streamingProviders', provider.id), payload);
  await recordConsoleAuditLog(admin, {
    actionType: 'streaming_provider_saved',
    targetCollection: 'streamingProviders',
    targetId: provider.id,
    summary: `Saved verified free provider ${provider.name} (${provider.supportedCountries.join(',')}).`,
  });
}

export async function deleteAdminStreamingProvider(
  admin: AdminAccountRecord,
  providerId: string
): Promise<void> {
  await deleteDoc(doc(db, 'streamingProviders', providerId));
  await recordConsoleAuditLog(admin, {
    actionType: 'streaming_provider_deleted',
    targetCollection: 'streamingProviders',
    targetId: providerId,
    summary: `Deleted streaming provider override ${providerId}.`,
  });
}

export async function listAdminStreamingAvailability(): Promise<
  AnimeStreamingAvailability[]
> {
  const snap = await getDocs(query(collection(db, 'streamingAvailability'), limit(500)));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      animeId: Number(data.animeId || 0),
      animeTitle: String(data.animeTitle || ''),
      providerId: String(data.providerId || ''),
      providerName: String(data.providerName || ''),
      countryCode: String(data.countryCode || 'ZA'),
      isFree: Boolean(data.isFree),
      isLegitimate: Boolean(data.isLegitimate),
      officialUrl: String(data.officialUrl || ''),
      accessModel: data.accessModel === 'Free' ? 'Free' : 'Free with Ads',
      availabilityType:
        (data.availabilityType as AnimeStreamingAvailability['availabilityType']) ||
        'full_series',
      verificationStatus:
        (data.verificationStatus as AnimeStreamingAvailability['verificationStatus']) ||
        'needs_review',
      lastVerifiedAt: String(data.lastVerifiedAt || ''),
      source: String(data.source || ''),
      notes: typeof data.notes === 'string' ? data.notes : undefined,
    };
  });
}

export async function saveAdminStreamingAvailability(
  admin: AdminAccountRecord,
  record: AnimeStreamingAvailability,
  providers: StreamingProvider[]
): Promise<void> {
  const countryErr = validateCountryCode(record.countryCode);
  if (countryErr) throw new Error(countryErr);
  if (!isApprovedOfficialStreamingUrl(record.officialUrl)) {
    throw new Error(
      'Official streaming URL must be HTTPS on an approved legitimate domain.'
    );
  }
  if (!isEligibleVerifiedFreeAvailability(record, providers)) {
    throw new Error(
      'Streaming availability entry must pass verified free legal eligibility checks (isFree=true, isLegitimate=true, verified status, supported provider country).'
    );
  }

  const docId =
    record.id.trim() ||
    `${record.animeId}_${record.providerId}_${record.countryCode}`;

  const payload: Record<string, unknown> = {
    id: docId,
    animeId: record.animeId,
    animeTitle: record.animeTitle.trim(),
    providerId: record.providerId.trim(),
    providerName: record.providerName.trim(),
    countryCode: record.countryCode.trim().toUpperCase(),
    isFree: true,
    isLegitimate: true,
    officialUrl: record.officialUrl.trim(),
    accessModel: record.accessModel,
    availabilityType: record.availabilityType,
    verificationStatus: record.verificationStatus,
    lastVerifiedAt: record.lastVerifiedAt.trim(),
    source: record.source.trim(),
  };
  if (record.notes?.trim()) {
    payload.notes = record.notes.trim().slice(0, 300);
  }

  await setDoc(doc(db, 'streamingAvailability', docId), payload);
  await recordConsoleAuditLog(admin, {
    actionType: 'streaming_availability_saved',
    targetCollection: 'streamingAvailability',
    targetId: docId,
    summary: `Saved ${record.animeTitle} on ${record.providerName} (${record.countryCode}).`,
  });
}

export async function deleteAdminStreamingAvailability(
  admin: AdminAccountRecord,
  availabilityId: string
): Promise<void> {
  await deleteDoc(doc(db, 'streamingAvailability', availabilityId));
  await recordConsoleAuditLog(admin, {
    actionType: 'streaming_availability_deleted',
    targetCollection: 'streamingAvailability',
    targetId: availabilityId,
    summary: `Deleted streaming availability override ${availabilityId}.`,
  });
}

export async function listStreamingReportsForAdmin(): Promise<
  StreamingAvailabilityReport[]
> {
  const q = query(
    collection(db, 'streamingReports'),
    orderBy('createdAt', 'desc'),
    limit(80)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId: String(data.userId || ''),
      animeId: Number(data.animeId || 0),
      animeTitle: String(data.animeTitle || ''),
      countryCode: String(data.countryCode || 'ZA'),
      providerId: typeof data.providerId === 'string' ? data.providerId : '',
      providerName: typeof data.providerName === 'string' ? data.providerName : '',
      reason: String(data.reason || ''),
      details: String(data.details || ''),
      status: data.status === 'reviewed' ? 'reviewed' : 'open',
      createdAt: toDateOrNull(data.createdAt),
    };
  });
}

export async function markStreamingReportReviewed(
  admin: AdminAccountRecord,
  reportId: string,
  nextStatus: 'open' | 'reviewed'
): Promise<void> {
  await updateDoc(doc(db, 'streamingReports', reportId), {
    status: nextStatus,
  });
  await recordConsoleAuditLog(admin, {
    actionType: `streaming_report_${nextStatus}`,
    targetCollection: 'streamingReports',
    targetId: reportId,
    summary: `Streaming report ${reportId} marked ${nextStatus}.`,
  });
}

// ==========================================
// Module E: Announcements & Notifications
// ==========================================

export async function listAllAnnouncementsForAdmin(): Promise<
  PlatformAnnouncement[]
> {
  const q = query(
    collection(db, 'platformAnnouncements'),
    orderBy('updatedAt', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: String(data.title || ''),
      body: String(data.body || ''),
      kind: (data.kind as PlatformAnnouncement['kind']) || 'general',
      audience: data.audience === 'selected_users' ? 'selected_users' : 'all_users',
      targetUserIds: Array.isArray(data.targetUserIds)
        ? data.targetUserIds.map((u) => String(u))
        : [],
      isActive: Boolean(data.isActive),
      sendInAppNotification: Boolean(data.sendInAppNotification),
      createdByUid: String(data.createdByUid || ''),
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
      archivedAt: toDateOrNull(data.archivedAt),
    };
  });
}

export async function publishOrUpdateAnnouncement(
  admin: AdminAccountRecord,
  input: {
    id?: string;
    title: string;
    body: string;
    kind: PlatformAnnouncement['kind'];
    audience: PlatformAnnouncement['audience'];
    targetUserIds: string[];
    isActive: boolean;
    sendInAppNotification: boolean;
  }
): Promise<string> {
  const err = validateAnnouncementInput(input);
  if (err) throw new Error(err);

  try {
    const callable = httpsCallable<
      typeof input,
      { ok: boolean; id: string }
    >(functions, 'adminPublishAnnouncement');
    const res = await callable(input);
    invalidateCachePrefix('announcements:');
    return res.data.id;
  } catch (callableErr) {
    if (!isFunctionsUnavailableError(callableErr)) {
      throw callableErr;
    }

    const docRef = input.id
      ? doc(db, 'platformAnnouncements', input.id)
      : doc(collection(db, 'platformAnnouncements'));
    const now = serverTimestamp();

    await setDoc(
      docRef,
      {
        id: docRef.id,
        title: input.title.trim(),
        body: input.body.trim(),
        kind: input.kind,
        audience: input.audience,
        targetUserIds: input.targetUserIds,
        isActive: input.isActive,
        sendInAppNotification: false,
        createdByUid: admin.uid,
        createdAt: now,
        updatedAt: now,
        archivedAt: input.isActive ? null : now,
      },
      { merge: true }
    );
    invalidateCachePrefix('announcements:');

    await recordConsoleAuditLog(admin, {
      actionType: input.isActive
        ? 'announcement_published'
        : 'announcement_archived',
      targetCollection: 'platformAnnouncements',
      targetId: docRef.id,
      summary: `Announcement "${input.title.trim()}" (active=${input.isActive}).`,
    });

    return docRef.id;
  }
}

// ==========================================
// Module F & G: Feedback, Legal, Security Incidents, Diagnostics, Seats & Audit Logs
// ==========================================

export async function listUserFeedbackForAdmin(): Promise<UserFeedbackRecord[]> {
  const q = query(
    collection(db, 'userFeedback'),
    orderBy('createdAt', 'desc'),
    limit(80)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId: String(data.userId || ''),
      category: (data.category as UserFeedbackRecord['category']) || 'general',
      subject: String(data.subject || ''),
      message: String(data.message || ''),
      pageContext: String(data.pageContext || '/'),
      status: (data.status as UserFeedbackRecord['status']) || 'open',
      adminNotes:
        typeof data.adminNotes === 'string' ? data.adminNotes : undefined,
      reviewedByUid:
        typeof data.reviewedByUid === 'string' ? data.reviewedByUid : undefined,
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  });
}

export async function updateUserFeedbackStatus(
  admin: AdminAccountRecord,
  feedbackId: string,
  status: UserFeedbackRecord['status'],
  adminNotes: string
): Promise<void> {
  await updateDoc(doc(db, 'userFeedback', feedbackId), {
    status,
    adminNotes: adminNotes.trim().slice(0, 600),
    reviewedByUid: admin.uid,
    updatedAt: serverTimestamp(),
  });
  await recordConsoleAuditLog(admin, {
    actionType: `feedback_${status}`,
    targetCollection: 'userFeedback',
    targetId: feedbackId,
    summary: `Feedback ${feedbackId} updated to ${status}.`,
  });
}

export async function saveLegalDocumentOverride(
  admin: AdminAccountRecord,
  input: {
    id: LegalPageSlug;
    title: string;
    customSummary: string;
    guidelinesList: string[];
    lastUpdatedLabel: string;
  }
): Promise<void> {
  const title = input.title.trim();
  if (title.length < 2 || title.length > 120) {
    throw new Error('Legal document title must be between 2 and 120 characters.');
  }
  const lastUpdatedLabel = input.lastUpdatedLabel.trim();
  if (lastUpdatedLabel.length < 4 || lastUpdatedLabel.length > 60) {
    throw new Error('Last updated label must be between 4 and 60 characters.');
  }

  await setDoc(doc(db, 'legalDocuments', input.id), {
    id: input.id,
    title,
    customSummary: input.customSummary.trim().slice(0, 2000),
    guidelinesList: input.guidelinesList
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 30),
    lastUpdatedLabel,
    updatedByUid: admin.uid,
    updatedAt: serverTimestamp(),
  } satisfies Omit<LegalDocumentOverride, 'updatedAt'> & { updatedAt: unknown });
  invalidateCacheKey('legalDocs:all');
  invalidateCacheKey(`legalDoc:${input.id}`);

  await recordConsoleAuditLog(admin, {
    actionType: 'legal_document_updated',
    targetCollection: 'legalDocuments',
    targetId: input.id,
    summary: `Updated legal/guidelines override for ${input.id}.`,
  });
}

export async function listSecurityIncidentsForAdmin(): Promise<
  SecurityIncidentRecord[]
> {
  const q = query(
    collection(db, 'securityIncidents'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: String(data.title || ''),
      severity: (data.severity as SecurityIncidentRecord['severity']) || 'low',
      status:
        (data.status as SecurityIncidentRecord['status']) || 'investigating',
      summary: String(data.summary || ''),
      remediationSteps: String(data.remediationSteps || ''),
      regulatorsNotified: Boolean(data.regulatorsNotified),
      reportedByUid: String(data.reportedByUid || ''),
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  });
}

export async function saveSecurityIncident(
  admin: AdminAccountRecord,
  input: {
    id?: string;
    title: string;
    severity: SecurityIncidentRecord['severity'];
    status: SecurityIncidentRecord['status'];
    summary: string;
    remediationSteps: string;
    regulatorsNotified: boolean;
  }
): Promise<string> {
  const err = validateSecurityIncidentInput(input);
  if (err) throw new Error(err);

  const now = serverTimestamp();
  if (input.id) {
    const refDoc = doc(db, 'securityIncidents', input.id);
    const snap = await getDoc(refDoc);
    await setDoc(refDoc, {
      id: input.id,
      title: input.title.trim(),
      severity: input.severity,
      status: input.status,
      summary: input.summary.trim(),
      remediationSteps: input.remediationSteps.trim(),
      regulatorsNotified: Boolean(input.regulatorsNotified),
      reportedByUid: snap.exists()
        ? String(snap.data().reportedByUid || admin.uid)
        : admin.uid,
      createdAt: snap.exists() ? snap.data().createdAt : now,
      updatedAt: now,
    });
    await recordConsoleAuditLog(admin, {
      actionType: 'security_incident_updated',
      targetCollection: 'securityIncidents',
      targetId: input.id,
      summary: `Incident "${input.title.trim()}" (${input.severity}, ${input.status}).`,
    });
    return input.id;
  }

  const newRef = doc(collection(db, 'securityIncidents'));
  await setDoc(newRef, {
    id: newRef.id,
    title: input.title.trim(),
    severity: input.severity,
    status: input.status,
    summary: input.summary.trim(),
    remediationSteps: input.remediationSteps.trim(),
    regulatorsNotified: Boolean(input.regulatorsNotified),
    reportedByUid: admin.uid,
    createdAt: now,
    updatedAt: now,
  });
  await recordConsoleAuditLog(admin, {
    actionType: 'security_incident_logged',
    targetCollection: 'securityIncidents',
    targetId: newRef.id,
    summary: `Logged security incident "${input.title.trim()}" (${input.severity}).`,
  });
  return newRef.id;
}

export async function listAdminSeatsForAdmin(): Promise<AdminSeatSummary[]> {
  const snap = await getDocs(query(collection(db, 'adminSeats'), limit(20)));
  const bySeat = new Map<string, Record<string, unknown>>();
  snap.forEach((d) => {
    bySeat.set(d.id, d.data());
  });

  return ADMIN_SEAT_IDS.map((seatId) => {
    const meta = ADMIN_SEAT_METADATA[seatId];
    const data = bySeat.get(seatId);
    if (!data) {
      return {
        seatId,
        title: meta.title,
        description: meta.description,
        occupied: false,
        uid: '',
        email: '',
        displayLabel: 'Unassigned',
        role: meta.role,
        permissions: [...meta.defaultPermissions],
        status: 'revoked',
        restrictionReason: '',
        updatedAt: null,
        lastLoginAt: null,
      };
    }

    return {
      seatId,
      title: meta.title,
      description: meta.description,
      occupied: Boolean(data.uid),
      uid: String(data.uid || ''),
      email: String(data.email || ''),
      displayLabel: String(data.displayLabel || meta.title),
      role: meta.role,
      permissions: sanitizeAdminPermissions(
        meta.role,
        Array.isArray(data.permissions)
          ? data.permissions.map((p) => String(p))
          : undefined
      ),
      status: (data.status as AdminSeatStatus) || 'active',
      restrictionReason:
        typeof data.restrictionReason === 'string'
          ? data.restrictionReason
          : '',
      updatedAt: toDateOrNull(data.updatedAt),
      lastLoginAt: toDateOrNull(data.lastLoginAt),
    };
  });
}

export async function manageAdminSeatViaCallable(params: {
  seatId: AdminSeatId;
  targetUid: string;
  status: AdminSeatStatus;
  displayLabel: string;
  permissions: AdminPermission[];
  restrictionReason?: string;
  transferOwnership?: boolean;
}): Promise<void> {
  const callable = httpsCallable(functions, 'adminManageSeatAndPermissions');
  try {
    await callable(params);
  } catch (err) {
    if (isFunctionsUnavailableError(err)) {
      throw new Error(
        'Cloud Function adminManageSeatAndPermissions is not deployed yet. Administrator seat assignment and custom claims require deployed Cloud Functions — see /ADMIN_PROVISIONING.md.'
      );
    }
    throw err;
  }
}

export async function listAdminAuditLogs(
  maxCount = 80
): Promise<AdminAuditLogEntry[]> {
  const q = query(
    collection(db, 'adminAuditLogs'),
    orderBy('createdAt', 'desc'),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      actorUid: String(data.actorUid || ''),
      actorRole: (data.actorRole as AdminAuditLogEntry['actorRole']) || 'owner',
      actorSeatId:
        (data.actorSeatId as AdminAuditLogEntry['actorSeatId']) || 'owner',
      actionType: String(data.actionType || ''),
      targetCollection: String(data.targetCollection || ''),
      targetId: String(data.targetId || ''),
      summary: String(data.summary || ''),
      source: data.source === 'admin_console' ? 'admin_console' : 'cloud_function',
      createdAt: toDateOrNull(data.createdAt),
    };
  });
}

export async function listAdminLoginEvents(
  maxCount = 60
): Promise<AdminLoginEvent[]> {
  const q = query(
    collection(db, 'adminLoginEvents'),
    orderBy('createdAt', 'desc'),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      actorUid: String(data.actorUid || ''),
      emailMasked: String(data.emailMasked || 'unknown'),
      seatId: (data.seatId as AdminLoginEvent['seatId']) || 'unknown',
      outcome: (data.outcome as AdminLoginEvent['outcome']) || 'login_denied',
      reason: String(data.reason || ''),
      createdAt: toDateOrNull(data.createdAt),
    };
  });
}

export interface SystemHealthDiagnosticSnapshot {
  projectId: string;
  firestoreDatabaseId: string;
  storageConfigured: boolean;
  storageBucket: string;
  firestoreConnected: boolean;
  firestoreLatencyMs: number | null;
  anilistReachable: boolean;
  checkedAtIso: string;
  notes: string[];
}

export async function checkSystemHealthDiagnostics(): Promise<SystemHealthDiagnosticSnapshot> {
  const notes: string[] = [];
  let firestoreConnected = false;
  let firestoreLatencyMs: number | null = null;

  const t0 = performance.now();
  try {
    await getCountFromServer(collection(db, 'catalogueOverrides'));
    firestoreConnected = true;
    firestoreLatencyMs = Math.round(performance.now() - t0);
  } catch (err) {
    notes.push(
      `Firestore ping error: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }

  let anilistReachable = false;
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ Media(id: 1, type: ANIME) { id } }' }),
    });
    anilistReachable = response.ok;
    if (!response.ok) {
      notes.push(`AniList GraphQL returned HTTP ${response.status}.`);
    }
  } catch (err) {
    notes.push(
      `AniList reachability check failed: ${
        err instanceof Error ? err.message : 'Network error'
      }`
    );
  }

  if (
    firebaseProjectMeta.firestoreDatabaseId !==
    'ai-studio-ataallthingsanim-42a903d6-0b6a-478d-9d62-c82df4c9e0e2'
  ) {
    notes.push(
      `Warning: active database ID is ${firebaseProjectMeta.firestoreDatabaseId}.`
    );
  }

  return {
    projectId: firebaseProjectMeta.projectId,
    firestoreDatabaseId: firebaseProjectMeta.firestoreDatabaseId,
    storageConfigured: isStorageConfigured,
    storageBucket: firebaseProjectMeta.storageBucket,
    firestoreConnected,
    firestoreLatencyMs,
    anilistReachable,
    checkedAtIso: new Date().toISOString(),
    notes,
  };
}
