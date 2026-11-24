import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminAuth, db } from '../firebase';
import { dispatchNotification } from '../notificationLogic';
import {
  ADMIN_SEAT_IDS,
  AdminAuthError,
  checkRecentReauth,
  sanitizeAuditSummary,
  sanitizePermissionsForRole,
  validateSeatUpdateRequest,
  verifyCallerIsActiveAdmin,
  writeAdminLoginEvent,
  writeImmutableAuditLog,
  type AdminSeatId,
  type AdminSeatStatus,
} from './adminLogic';

function rethrowHttpsError(err: unknown): never {
  if (err instanceof HttpsError) throw err;
  if (err instanceof AdminAuthError) {
    throw new HttpsError(err.code, err.message);
  }
  throw new HttpsError(
    'internal',
    err instanceof Error ? err.message : 'Internal administrator service error.'
  );
}

export const adminGetSessionContext = onCall(async (request) => {
  try {
    const email = String(request.auth?.token?.email || '');
    const uid = request.auth?.uid || 'anonymous';
    try {
      const admin = await verifyCallerIsActiveAdmin(db, request.auth);
      await db.collection('admins').doc(admin.uid).set(
        { lastLoginAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      await db.collection('adminSeats').doc(admin.seatId).set(
        { lastLoginAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      await writeAdminLoginEvent(db, {
        actorUid: admin.uid,
        email: admin.email || email,
        seatId: admin.seatId,
        outcome: 'login_success',
        reason: 'Verified administrator session initialized.',
      });
      return {
        authorized: true,
        admin,
      };
    } catch (err) {
      await writeAdminLoginEvent(db, {
        actorUid: uid,
        email,
        seatId: 'unknown',
        outcome: 'login_denied',
        reason: err instanceof Error ? err.message : 'Unauthorized admin portal check.',
      });
      throw err;
    }
  } catch (err) {
    rethrowHttpsError(err);
  }
});

export const adminRecordSecurityEvent = onCall(async (request) => {
  try {
    const data = (request.data || {}) as Record<string, unknown>;
    const outcome = String(data.outcome || '') as
      | 'login_failed'
      | 'logout'
      | 'reauth_success'
      | 'reauth_failed';

    const allowedOutcomes = [
      'login_failed',
      'logout',
      'reauth_success',
      'reauth_failed',
    ];
    if (!allowedOutcomes.includes(outcome)) {
      throw new HttpsError('invalid-argument', 'Unsupported security event outcome.');
    }

    const actorUid = request.auth?.uid || 'anonymous';
    const email = String(data.email || request.auth?.token?.email || '');
    let seatId: AdminSeatId | 'unknown' = 'unknown';

    if (request.auth?.uid) {
      const adminSnap = await db.collection('admins').doc(request.auth.uid).get();
      if (adminSnap.exists) {
        const candidate = String(adminSnap.data()?.seatId || '');
        if ((ADMIN_SEAT_IDS as readonly string[]).includes(candidate)) {
          seatId = candidate as AdminSeatId;
        }
      }
    }

    await writeAdminLoginEvent(db, {
      actorUid,
      email,
      seatId,
      outcome,
      reason: String(data.reason || outcome),
    });

    return { recorded: true };
  } catch (err) {
    rethrowHttpsError(err);
  }
});

export const adminManageSeatAndPermissions = onCall(async (request) => {
  try {
    const actor = await verifyCallerIsActiveAdmin(db, request.auth, 'admin_management');
    checkRecentReauth(request.auth);

    const data = (request.data || {}) as Record<string, unknown>;
    const seatId = String(data.seatId || '') as AdminSeatId;
    const targetUid = String(data.targetUid || '').trim();
    const nextStatus = String(data.status || 'active') as AdminSeatStatus;
    const displayLabel = String(data.displayLabel || seatId).trim().slice(0, 60);
    const restrictionReason = String(data.restrictionReason || '').trim().slice(0, 300);
    const transferOwnership = Boolean(data.transferOwnership);
    const requestedPermissions = Array.isArray(data.permissions)
      ? data.permissions.map((p) => String(p))
      : undefined;

    validateSeatUpdateRequest({
      actorRole: actor.role,
      actorUid: actor.uid,
      seatId,
      targetUid,
      nextStatus,
      transferOwnership,
    });

    const targetAuthUser = await adminAuth.getUser(targetUid);
    if (!targetAuthUser.email || !targetAuthUser.emailVerified) {
      throw new HttpsError(
        'failed-precondition',
        'Target user must have a verified email address before being assigned an administrator seat.'
      );
    }

    const seatDocRef = db.collection('adminSeats').doc(seatId);
    const existingSeatSnap = await seatDocRef.get();
    const previousUid = existingSeatSnap.exists
      ? String(existingSeatSnap.data()?.uid || '')
      : '';

    const permissions = sanitizePermissionsForRole(seatId, requestedPermissions);
    const now = FieldValue.serverTimestamp();

    // If seat had another user previously, revoke their admin doc & claims cleanly
    if (previousUid && previousUid !== targetUid) {
      await db.collection('admins').doc(previousUid).delete();
      await adminAuth.setCustomUserClaims(previousUid, {
        ataAdminRole: null,
        ataAdminSeat: null,
      });
      await adminAuth.revokeRefreshTokens(previousUid);
    }

    // Write seat document (strictly max 3 docs: owner, platform_admin, content_admin)
    await seatDocRef.set({
      seatId,
      role: seatId,
      uid: targetUid,
      email: targetAuthUser.email,
      displayLabel: displayLabel || targetAuthUser.displayName || seatId,
      permissions,
      status: nextStatus,
      restrictionReason,
      assignedByUid: actor.uid,
      updatedAt: now,
    });

    if (nextStatus === 'revoked') {
      await db.collection('admins').doc(targetUid).set({
        uid: targetUid,
        seatId,
        role: seatId,
        email: targetAuthUser.email,
        displayLabel: displayLabel || targetAuthUser.displayName || seatId,
        permissions: [],
        status: 'revoked',
        restrictionReason,
        assignedByUid: actor.uid,
        assignedAt: now,
        updatedAt: now,
      });
      await adminAuth.setCustomUserClaims(targetUid, {
        ataAdminRole: null,
        ataAdminSeat: null,
      });
      await adminAuth.revokeRefreshTokens(targetUid);
    } else {
      await db.collection('admins').doc(targetUid).set({
        uid: targetUid,
        seatId,
        role: seatId,
        email: targetAuthUser.email,
        displayLabel: displayLabel || targetAuthUser.displayName || seatId,
        permissions,
        status: nextStatus,
        restrictionReason,
        assignedByUid: actor.uid,
        assignedAt: now,
        updatedAt: now,
      });
      await adminAuth.setCustomUserClaims(targetUid, {
        ataAdminRole: nextStatus === 'active' ? seatId : null,
        ataAdminSeat: nextStatus === 'active' ? seatId : null,
      });
      if (nextStatus === 'restricted') {
        await adminAuth.revokeRefreshTokens(targetUid);
      }
    }

    await writeImmutableAuditLog(db, {
      actorUid: actor.uid,
      actorRole: actor.role,
      actorSeatId: actor.seatId,
      actionType: transferOwnership ? 'owner_transferred' : `admin_seat_${nextStatus}`,
      targetCollection: 'adminSeats',
      targetId: seatId,
      summary: `Seat ${seatId} updated for UID ${targetUid} (status: ${nextStatus}, permissions: ${permissions.length}).`,
    });

    return { ok: true, seatId, targetUid, status: nextStatus, permissions };
  } catch (err) {
    rethrowHttpsError(err);
  }
});

export const adminModerateUser = onCall(async (request) => {
  try {
    const data = (request.data || {}) as Record<string, unknown>;
    const action = String(data.action || '');
    const requiredPerm = action === 'toggle_verify' ? 'user_management' : 'account_moderation';
    const actor = await verifyCallerIsActiveAdmin(db, request.auth, requiredPerm);

    if (action === 'ban') {
      checkRecentReauth(request.auth);
    }

    const targetUid = String(data.targetUid || '').trim();
    const reason = sanitizeAuditSummary(String(data.reason || '').trim());
    const requestId = String(data.deletionRequestId || '').trim();

    if (!targetUid) {
      throw new HttpsError('invalid-argument', 'Target user UID is required.');
    }

    // Protect Owner seat from moderation
    const targetAdminSnap = await db.collection('admins').doc(targetUid).get();
    if (targetAdminSnap.exists && targetAdminSnap.data()?.role === 'owner') {
      throw new HttpsError(
        'failed-precondition',
        'The Owner / Super Admin account cannot be suspended or banned.'
      );
    }

    const userRef = db.collection('users').doc(targetUid);
    const now = FieldValue.serverTimestamp();

    if (action === 'suspend') {
      if (!reason) {
        throw new HttpsError('invalid-argument', 'A suspension reason is required.');
      }
      await adminAuth.updateUser(targetUid, { disabled: true });
      await adminAuth.revokeRefreshTokens(targetUid);
      await userRef.set(
        {
          accountStatus: 'suspended',
          suspensionReason: reason,
          updatedAt: now,
        },
        { merge: true }
      );
    } else if (action === 'ban') {
      if (!reason) {
        throw new HttpsError('invalid-argument', 'A permanent ban reason is required.');
      }
      await adminAuth.updateUser(targetUid, { disabled: true });
      await adminAuth.revokeRefreshTokens(targetUid);
      await userRef.set(
        {
          accountStatus: 'banned',
          banReason: reason,
          updatedAt: now,
        },
        { merge: true }
      );
    } else if (action === 'restore') {
      await adminAuth.updateUser(targetUid, { disabled: false });
      await userRef.set(
        {
          accountStatus: 'active',
          suspensionReason: '',
          banReason: '',
          updatedAt: now,
        },
        { merge: true }
      );
    } else if (action === 'toggle_verify') {
      const nextVerified = Boolean(data.isVerifiedBadge);
      await userRef.set(
        {
          isVerifiedBadge: nextVerified,
          updatedAt: now,
        },
        { merge: true }
      );
    } else if (action === 'complete_deletion_request') {
      if (!requestId) {
        throw new HttpsError('invalid-argument', 'Deletion request ID is required.');
      }
      await adminAuth.updateUser(targetUid, { disabled: true });
      await adminAuth.revokeRefreshTokens(targetUid);
      await userRef.set(
        {
          accountStatus: 'banned',
          banReason: 'Account deactivated per user deletion request.',
          updatedAt: now,
        },
        { merge: true }
      );
      await db.collection('accountDeletionRequests').doc(requestId).set(
        {
          status: 'completed',
          reviewNotes: reason || 'Processed by ATA administrator.',
          reviewedByUid: actor.uid,
          updatedAt: now,
        },
        { merge: true }
      );
    } else if (action === 'decline_deletion_request') {
      if (!requestId) {
        throw new HttpsError('invalid-argument', 'Deletion request ID is required.');
      }
      await db.collection('accountDeletionRequests').doc(requestId).set(
        {
          status: 'declined',
          reviewNotes: reason || 'Declined after review.',
          reviewedByUid: actor.uid,
          updatedAt: now,
        },
        { merge: true }
      );
    } else {
      throw new HttpsError('invalid-argument', 'Unsupported user moderation action.');
    }

    await db.collection('moderationDecisions').doc().set({
      targetType: 'user',
      targetId: targetUid,
      action: action === 'restore' ? 'restore_account' : action,
      reason: reason || action,
      evidenceSummary: `User moderation action (${action}) recorded by ${actor.role}.`,
      actorUid: actor.uid,
      actorRole: actor.role,
      createdAt: now,
    });

    await writeImmutableAuditLog(db, {
      actorUid: actor.uid,
      actorRole: actor.role,
      actorSeatId: actor.seatId,
      actionType: `user_${action}`,
      targetCollection: 'users',
      targetId: targetUid,
      summary: `User ${targetUid}: ${action}. ${reason}`,
    });

    return { ok: true, targetUid, action };
  } catch (err) {
    rethrowHttpsError(err);
  }
});

export const adminModerateContent = onCall(async (request) => {
  try {
    const data = (request.data || {}) as Record<string, unknown>;
    const kind = String(data.kind || 'report');
    const requiredPerm =
      kind === 'copyright'
        ? 'copyright_complaints'
        : kind === 'community'
          ? 'community_management'
          : 'content_moderation';

    const actor = await verifyCallerIsActiveAdmin(db, request.auth, requiredPerm);
    const targetId = String(data.targetId || '').trim();
    const action = String(data.action || '');
    const reason = sanitizeAuditSummary(String(data.reason || '').trim());
    const evidenceSummary = sanitizeAuditSummary(String(data.evidenceSummary || '').trim());
    const now = FieldValue.serverTimestamp();

    if (!targetId) {
      throw new HttpsError('invalid-argument', 'Target document ID is required.');
    }

    if (kind === 'report') {
      const reportStatus = String(data.reportStatus || 'action_taken');
      await db.collection('reports').doc(targetId).set(
        {
          status: reportStatus,
          reviewNotes: reason,
          reviewedByUid: actor.uid,
          reviewedAt: now,
        },
        { merge: true }
      );
    } else if (kind === 'copyright') {
      const status = String(data.status || 'action_taken');
      await db.collection('copyrightComplaints').doc(targetId).set(
        {
          status,
          resolutionNotes: reason,
          handledByUid: actor.uid,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    const contentCollection = String(data.contentCollection || '');
    const contentDocPath = String(data.contentDocPath || '');
    if (contentDocPath && (action === 'remove' || action === 'restore')) {
      const moderationStatus = action === 'remove' ? 'removed_by_moderator' : 'active';
      await db.doc(contentDocPath).set(
        {
          moderationStatus,
          moderationReason: action === 'remove' ? reason : '',
          moderatedAt: now,
          moderatedBy: actor.uid,
        },
        { merge: true }
      );
    }

    await db.collection('moderationDecisions').doc().set({
      targetType: contentCollection || kind,
      targetId,
      action: action || 'dismiss',
      reason: reason || 'Reviewed by administrator',
      evidenceSummary: evidenceSummary || `Moderation decision recorded for ${kind} ${targetId}.`,
      actorUid: actor.uid,
      actorRole: actor.role,
      createdAt: now,
    });

    await writeImmutableAuditLog(db, {
      actorUid: actor.uid,
      actorRole: actor.role,
      actorSeatId: actor.seatId,
      actionType: `moderate_${kind}_${action || 'update'}`,
      targetCollection: contentCollection || kind,
      targetId,
      summary: `${kind} ${targetId}: ${action || 'reviewed'}. ${reason}`,
    });

    return { ok: true, targetId, action };
  } catch (err) {
    rethrowHttpsError(err);
  }
});

export const adminPublishAnnouncement = onCall(async (request) => {
  try {
    const actor = await verifyCallerIsActiveAdmin(db, request.auth, 'announcements');
    const data = (request.data || {}) as Record<string, unknown>;
    const announcementId =
      String(data.id || '').trim() || db.collection('platformAnnouncements').doc().id;
    const title = String(data.title || '').trim().slice(0, 120);
    const body = String(data.body || '').trim().slice(0, 1200);
    const kind = String(data.kind || 'general');
    const audience =
      data.audience === 'selected_users' ? 'selected_users' : 'all_users';
    const targetUserIds = Array.isArray(data.targetUserIds)
      ? data.targetUserIds.map((u) => String(u).trim()).filter(Boolean).slice(0, 50)
      : [];
    const isActive = Boolean(data.isActive);
    const sendInAppNotification = Boolean(data.sendInAppNotification);

    if (!title || !body) {
      throw new HttpsError('invalid-argument', 'Announcement title and body are required.');
    }

    const now = FieldValue.serverTimestamp();
    await db.collection('platformAnnouncements').doc(announcementId).set(
      {
        id: announcementId,
        title,
        body,
        kind,
        audience,
        targetUserIds,
        isActive,
        sendInAppNotification,
        createdByUid: actor.uid,
        updatedAt: now,
        archivedAt: isActive ? null : now,
      },
      { merge: true }
    );

    if (isActive && sendInAppNotification && targetUserIds.length > 0) {
      await Promise.all(
        targetUserIds.map((recipientId) =>
          dispatchNotification(db, {
            recipientId,
            actorId: actor.uid,
            type: 'system_notice',
            category: 'system',
            title,
            body: body.slice(0, 280),
            targetType: 'system',
            targetId: announcementId,
            route: '/',
            dedupeKey: `announcement_${announcementId}`,
            metadata: { announcementId, kind },
          })
        )
      );
    }

    await writeImmutableAuditLog(db, {
      actorUid: actor.uid,
      actorRole: actor.role,
      actorSeatId: actor.seatId,
      actionType: isActive ? 'announcement_published' : 'announcement_archived',
      targetCollection: 'platformAnnouncements',
      targetId: announcementId,
      summary: `Announcement "${title}" (${kind}, active=${isActive}).`,
    });

    return { ok: true, id: announcementId };
  } catch (err) {
    rethrowHttpsError(err);
  }
});

export const adminModerateEvent = onCall(async (request) => {
  try {
    const data = (request.data || {}) as Record<string, unknown>;
    const eventType = data.eventType === 'watch_party' ? 'watch_party' : 'challenge';
    const action = String(data.action || '');
    const requiredPerm =
      action === 'feature' || action === 'unfeature'
        ? 'featured_content'
        : 'content_moderation';

    const actor = await verifyCallerIsActiveAdmin(db, request.auth, requiredPerm);
    const eventId = String(data.eventId || '').trim();
    const reason = sanitizeAuditSummary(String(data.reason || '').trim());
    if (!eventId) {
      throw new HttpsError('invalid-argument', 'eventId is required.');
    }

    const col = eventType === 'watch_party' ? 'watchParties' : 'animeChallenges';
    const docRef = db.collection(col).doc(eventId);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Target event does not exist.');
    }

    const now = FieldValue.serverTimestamp();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (action === 'remove') {
      updates.moderationStatus = 'removed_by_moderator';
      updates.moderationReason = reason || 'Removed by administrator';
    } else if (action === 'suspend') {
      updates.moderationStatus = 'suspended';
      updates.moderationReason = reason || 'Suspended by administrator';
      if (eventType === 'watch_party') {
        updates.status = 'cancelled';
      } else {
        updates.status = 'archived';
      }
    } else if (action === 'restore') {
      updates.moderationStatus = 'active';
      updates.moderationReason = '';
      if (eventType === 'watch_party') {
        updates.status = 'scheduled';
      } else {
        updates.status = 'active';
      }
    } else if (eventType === 'challenge' && (action === 'feature' || action === 'unfeature')) {
      updates.isFeatured = action === 'feature';
    } else {
      throw new HttpsError('invalid-argument', 'Unsupported event moderation action.');
    }

    await docRef.set(updates, { merge: true });

    await db.collection('moderationDecisions').doc().set({
      targetType: eventType,
      targetId: eventId,
      action: action === 'feature' || action === 'unfeature' ? 'restore' : action,
      reason: reason || `Admin ${action} on ${eventType}`,
      evidenceSummary: `Admin ${actor.role} executed ${action} on ${col}/${eventId}.`,
      actorUid: actor.uid,
      actorRole: actor.role,
      createdAt: now,
    });

    await writeImmutableAuditLog(db, {
      actorUid: actor.uid,
      actorRole: actor.role,
      actorSeatId: actor.seatId,
      actionType: `event_${eventType}_${action}`,
      targetCollection: col,
      targetId: eventId,
      summary: `${eventType} ${eventId}: ${action}. ${reason}`,
    });

    return { ok: true, eventType, eventId, action };
  } catch (err) {
    rethrowHttpsError(err);
  }
});

