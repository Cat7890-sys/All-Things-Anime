import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { ATA_DATABASE_ID } from '../config';
import { db } from '../firebase';
import { dispatchNotification, isBlockedBetween } from '../notificationLogic';
import {
  computeServerChallengePoints,
  computeServerWatchPartyPoints,
  evaluateServerAchievements,
  sanitizeTargetAnimeIds,
  SERVER_ACHIEVEMENT_DEFS,
  SERVER_SCORING_RULES,
} from './challengeWatchPartyLogic';

async function recomputeUserGamificationState(
  uid: string,
  sourceEventId: string
): Promise<{
  totalPoints: number;
  newlyUnlocked: string[];
}> {
  const [profileSnap, partSnaps, wpPartSnaps, hostedPartySnaps, existingAchSnaps] =
    await Promise.all([
      db.collection('publicProfiles').doc(uid).get(),
      db.collection('challengeParticipants').where('userId', '==', uid).get(),
      db.collection('watchPartyParticipants').where('userId', '==', uid).get(),
      db.collection('watchParties').where('creatorId', '==', uid).get(),
      db.collection('userAchievements').where('userId', '==', uid).get(),
    ]);

  let challengePoints = 0;
  let challengesJoined = 0;
  let challengesCompleted = 0;
  let communityEventsJoined = 0;

  // Fetch associated challenges so difficulty & target counts cannot be spoofed
  const challengeDocs = new Map<string, Record<string, unknown>>();
  const challengeIds = Array.from(
    new Set(
      partSnaps.docs
        .map((d) => String(d.data().challengeId || ''))
        .filter(Boolean)
    )
  );
  await Promise.all(
    challengeIds.map(async (cid) => {
      const snap = await db.collection('animeChallenges').doc(cid).get();
      if (snap.exists) {
        challengeDocs.set(cid, snap.data() || {});
      }
    })
  );

  for (const docSnap of partSnaps.docs) {
    const pData = docSnap.data();
    const cid = String(pData.challengeId || '');
    const challenge = challengeDocs.get(cid);
    if (!challenge || challenge.moderationStatus !== 'active') continue;

    challengesJoined += 1;
    if (challenge.visibility === 'community' && String(challenge.communityId || '')) {
      communityEventsJoined += 1;
    }
    const targetIds = Array.isArray(challenge.animeTargets)
      ? challenge.animeTargets
          .map((t) => Number((t as { animeId?: unknown })?.animeId))
          .filter((n) => Number.isInteger(n) && n > 0)
      : [];
    const claimedIds = Array.isArray(pData.completedAnimeIds)
      ? pData.completedAnimeIds
      : [];
    const validCompleted = sanitizeTargetAnimeIds(claimedIds, targetIds);
    const { points, isCompleted } = computeServerChallengePoints({
      completedAnimeCount: validCompleted.length,
      totalAnimeCount: targetIds.length,
      difficulty: String(challenge.difficulty || 'casual'),
    });
    challengePoints += points;
    if (isCompleted) {
      challengesCompleted += 1;
    }
  }

  let watchPartyPoints = 0;
  let watchPartiesAttended = 0;
  let watchPartiesHostedCompleted = 0;

  const partyIds = Array.from(
    new Set(
      wpPartSnaps.docs
        .map((d) => String(d.data().partyId || ''))
        .filter(Boolean)
    )
  );
  const partyDocs = new Map<string, Record<string, unknown>>();
  await Promise.all(
    partyIds.map(async (pid) => {
      const snap = await db.collection('watchParties').doc(pid).get();
      if (snap.exists) {
        partyDocs.set(pid, snap.data() || {});
      }
    })
  );

  for (const docSnap of wpPartSnaps.docs) {
    const pData = docSnap.data();
    const pid = String(pData.partyId || '');
    const party = partyDocs.get(pid);
    if (!party || party.moderationStatus !== 'active' || party.status === 'cancelled') {
      continue;
    }
    if (party.visibility === 'community' && String(party.communityId || '')) {
      communityEventsJoined += 1;
    }
    const rsvp = String(pData.rsvpStatus || 'joined');
    if (rsvp === 'attending' || rsvp === 'completed') {
      watchPartiesAttended += 1;
      watchPartyPoints += computeServerWatchPartyPoints(rsvp);
    }
  }

  for (const hostSnap of hostedPartySnaps.docs) {
    const hData = hostSnap.data();
    if (
      hData.moderationStatus === 'active' &&
      hData.status === 'completed' &&
      Number(hData.participantCount || 0) >= SERVER_SCORING_RULES.watchPartyHostMinAttendees
    ) {
      watchPartiesHostedCompleted += 1;
      watchPartyPoints += SERVER_SCORING_RULES.watchPartyHostCompletedBonus;
    }
  }

  const totalPoints = challengePoints + watchPartyPoints;
  const profileData = profileSnap.data() || {};
  const username =
    typeof profileData.username === 'string' ? profileData.username : 'ata_member';
  const displayName =
    typeof profileData.displayName === 'string' && profileData.displayName.trim()
      ? profileData.displayName
      : username;
  const avatarUrl =
    typeof profileData.avatarUrl === 'string' ? profileData.avatarUrl : '';

  await db
    .collection('leaderboardProfiles')
    .doc(uid)
    .set({
      userId: uid,
      username,
      displayName,
      avatarUrl,
      totalPoints,
      challengePoints,
      watchPartyPoints,
      challengesJoined,
      challengesCompleted,
      watchPartiesAttended,
      watchPartiesHosted: watchPartiesHostedCompleted,
      updatedAt: FieldValue.serverTimestamp(),
    });

  const existingIds = new Set(
    existingAchSnaps.docs.map((d) => String(d.data().achievementId || ''))
  );
  const newlyUnlocked = evaluateServerAchievements(
    {
      challengesJoined,
      challengesCompleted,
      communityEventsJoined,
      watchPartiesAttended,
      watchPartiesHostedCompleted,
    },
    existingIds
  );

  for (const achievementId of newlyUnlocked) {
    const def = SERVER_ACHIEVEMENT_DEFS[achievementId];
    const docId = `${uid}__${achievementId}`;
    try {
      await db
        .collection('userAchievements')
        .doc(docId)
        .create({
          id: docId,
          userId: uid,
          achievementId,
          title: def.title,
          description: def.description,
          sourceEventId,
          unlockedAt: FieldValue.serverTimestamp(),
        });
      await dispatchNotification(db, {
        recipientId: uid,
        type: 'achievement_unlocked',
        category: 'system',
        title: `Achievement Unlocked: ${def.title}`,
        body: def.description,
        targetType: 'profile',
        targetId: uid,
        route: '/profile',
        dedupeKey: `ach_${achievementId}`,
        metadata: { achievementId },
      });
    } catch {
      // Idempotent duplicate protection if concurrent triggers fire
    }
  }

  return { totalPoints, newlyUnlocked };
}

export const syncChallengeProgressAndRewards = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to sync challenge progress.');
  }
  if (!request.auth.token.email_verified) {
    throw new HttpsError('permission-denied', 'Email verification required.');
  }

  const uid = request.auth.uid;
  const data = (request.data || {}) as Record<string, unknown>;
  const challengeId = String(data.challengeId || '').trim();
  if (!challengeId) {
    throw new HttpsError('invalid-argument', 'challengeId is required.');
  }

  const partId = `${challengeId}__${uid}`;
  const [challengeSnap, partSnap] = await Promise.all([
    db.collection('animeChallenges').doc(challengeId).get(),
    db.collection('challengeParticipants').doc(partId).get(),
  ]);

  if (!challengeSnap.exists) {
    throw new HttpsError('not-found', 'Challenge not found.');
  }
  const challengeData = challengeSnap.data() || {};
  const targetIds = Array.isArray(challengeData.animeTargets)
    ? challengeData.animeTargets
        .map((t) => Number((t as { animeId?: unknown })?.animeId))
        .filter((n) => Number.isInteger(n) && n > 0)
    : [];

  let isCompleted = false;
  if (partSnap.exists) {
    const pData = partSnap.data() || {};
    const claimedIds = Array.isArray(pData.completedAnimeIds)
      ? pData.completedAnimeIds
      : [];
    const validCompleted = sanitizeTargetAnimeIds(claimedIds, targetIds);
    const computed = computeServerChallengePoints({
      completedAnimeCount: validCompleted.length,
      totalAnimeCount: targetIds.length,
      difficulty: String(challengeData.difficulty || 'casual'),
    });
    isCompleted = computed.isCompleted;
    const wasCompleted = pData.status === 'completed';

    await db
      .collection('challengeParticipants')
      .doc(partId)
      .set(
        {
          completedAnimeIds: validCompleted,
          totalAnimeCount: targetIds.length,
          progressPercent: computed.progressPercent,
          status: computed.isCompleted ? 'completed' : 'active',
          pointsAwarded: computed.points,
          completedAt:
            computed.isCompleted && !wasCompleted
              ? FieldValue.serverTimestamp()
              : pData.completedAt || null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    if (computed.isCompleted && !wasCompleted) {
      await db
        .collection('animeChallenges')
        .doc(challengeId)
        .update({
          completedCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });

      await dispatchNotification(db, {
        recipientId: uid,
        type: 'challenge_completed',
        category: 'system',
        title: 'Challenge Completed!',
        body: `You completed "${String(challengeData.title || 'Anime Challenge')}".`,
        targetType: 'challenge',
        targetId: challengeId,
        route: `/challenges/${challengeId}`,
        dedupeKey: `chal_complete_${challengeId}`,
        metadata: { challengeId },
      });
    }
  }

  const state = await recomputeUserGamificationState(uid, challengeId);
  return {
    ok: true,
    isCompleted,
    totalPoints: state.totalPoints,
    newlyUnlocked: state.newlyUnlocked,
  };
});

export const syncWatchPartyRsvpRewards = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to update watch party stats.');
  }
  if (!request.auth.token.email_verified) {
    throw new HttpsError('permission-denied', 'Email verification required.');
  }
  const uid = request.auth.uid;
  const data = (request.data || {}) as Record<string, unknown>;
  const partyId = String(data.partyId || '').trim();
  if (!partyId) {
    throw new HttpsError('invalid-argument', 'partyId is required.');
  }

  const state = await recomputeUserGamificationState(uid, partyId);
  return {
    ok: true,
    totalPoints: state.totalPoints,
    newlyUnlocked: state.newlyUnlocked,
  };
});

export const sendEventInvites = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to send invites.');
  }
  if (!request.auth.token.email_verified) {
    throw new HttpsError('permission-denied', 'Email verification required.');
  }
  const actorUid = request.auth.uid;
  const data = (request.data || {}) as Record<string, unknown>;
  const eventType = data.eventType === 'watch_party' ? 'watch_party' : 'challenge';
  const eventId = String(data.eventId || '').trim();
  const recipientIds = Array.isArray(data.recipientIds)
    ? Array.from(
        new Set(
          data.recipientIds
            .map((v) => String(v).trim())
            .filter((v) => v && v !== actorUid)
        )
      ).slice(0, 25)
    : [];

  if (!eventId || recipientIds.length === 0) {
    throw new HttpsError('invalid-argument', 'eventId and recipientIds are required.');
  }

  const col = eventType === 'watch_party' ? 'watchParties' : 'animeChallenges';
  const snap = await db.collection(col).doc(eventId).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Event not found.');
  }
  const eventData = snap.data() || {};
  if (eventData.moderationStatus !== 'active') {
    throw new HttpsError('failed-precondition', 'Event is not active.');
  }

  let authorized = String(eventData.creatorId || '') === actorUid;
  const communityId = String(eventData.communityId || '');
  if (!authorized && communityId) {
    const commSnap = await db.collection('communities').doc(communityId).get();
    const commData = commSnap.data() || {};
    const mods = Array.isArray(commData.moderatorIds)
      ? commData.moderatorIds.map(String)
      : [];
    authorized = String(commData.ownerId || '') === actorUid || mods.includes(actorUid);
  }
  if (!authorized) {
    throw new HttpsError('permission-denied', 'Only event creators or moderators can send invites.');
  }

  const title = String(eventData.title || 'ATA Event');
  let sentCount = 0;

  await Promise.all(
    recipientIds.map(async (recipientId) => {
      const blocked = await isBlockedBetween(db, actorUid, recipientId);
      if (blocked) return;
      const ok = await dispatchNotification(db, {
        recipientId,
        actorId: actorUid,
        type: eventType === 'watch_party' ? 'watch_party_invite' : 'challenge_invite',
        category: communityId ? 'communities' : 'social',
        title:
          eventType === 'watch_party'
            ? 'Watch Party Invitation'
            : 'Anime Challenge Invitation',
        body:
          eventType === 'watch_party'
            ? `Invited you to watch party "${title}".`
            : `Invited you to join challenge "${title}".`,
        targetType: eventType,
        targetId: eventId,
        route: `/challenges/${eventId}`,
        dedupeKey: `invite_${eventType}_${eventId}_${recipientId}`,
        metadata: {
          eventType,
          eventId,
          ...(communityId ? { communityId } : {}),
        },
      });
      if (ok) sentCount += 1;
    })
  );

  return { ok: true, sentCount };
});

export const onChallengeCreated = onDocumentCreated(
  {
    document: 'animeChallenges/{challengeId}',
    database: ATA_DATABASE_ID,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    if (data.visibility !== 'community') return;
    const communityId = String(data.communityId || '');
    const creatorId = String(data.creatorId || '');
    const challengeId = event.params.challengeId;
    if (!communityId || !creatorId) return;

    const memberSnaps = await db
      .collection('communityMemberships')
      .where('communityId', '==', communityId)
      .limit(100)
      .get();

    const title = String(data.title || 'New Community Challenge');
    const communityName = String(data.communityName || 'your community');

    await Promise.all(
      memberSnaps.docs.map(async (mDoc) => {
        const memberUid = String(mDoc.data().userId || '');
        if (!memberUid || memberUid === creatorId) return;
        await dispatchNotification(db, {
          recipientId: memberUid,
          actorId: creatorId,
          type: 'community_challenge_created',
          category: 'communities',
          title: `New Challenge in ${communityName}`,
          body: `"${title}" is now open for members.`,
          targetType: 'challenge',
          targetId: challengeId,
          route: `/challenges/${challengeId}`,
          dedupeKey: `comm_chal_${challengeId}`,
          metadata: { communityId, challengeId },
        });
      })
    );
  }
);

export const onWatchPartyUpdated = onDocumentUpdated(
  {
    document: 'watchParties/{partyId}',
    database: ATA_DATABASE_ID,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const partyId = event.params.partyId;
    const creatorId = String(after.creatorId || '');
    const title = String(after.title || 'Watch Party');

    const wasCancelled =
      before.status !== 'cancelled' && after.status === 'cancelled';
    const wasRescheduled =
      before.scheduledDate !== after.scheduledDate ||
      before.startTime !== after.startTime ||
      before.timezone !== after.timezone;

    if (!wasCancelled && !wasRescheduled) return;

    const participantsSnap = await db
      .collection('watchPartyParticipants')
      .where('partyId', '==', partyId)
      .limit(200)
      .get();

    await Promise.all(
      participantsSnap.docs.map(async (pDoc) => {
        const recipientId = String(pDoc.data().userId || '');
        if (!recipientId || recipientId === creatorId) return;
        await dispatchNotification(db, {
          recipientId,
          actorId: creatorId,
          type: wasCancelled ? 'watch_party_cancelled' : 'watch_party_updated',
          category: 'social',
          title: wasCancelled ? 'Watch Party Cancelled' : 'Watch Party Rescheduled',
          body: wasCancelled
            ? `"${title}" was cancelled by the host.`
            : `"${title}" schedule updated to ${String(after.scheduledDate)} ${String(after.startTime)} (${String(after.timezone)}).`,
          targetType: 'watch_party',
          targetId: partyId,
          route: `/challenges/${partyId}`,
          dedupeKey: `${wasCancelled ? 'wp_cancel' : 'wp_upd'}_${partyId}_${event.id}`,
          metadata: { partyId },
        });
      })
    );
  }
);
