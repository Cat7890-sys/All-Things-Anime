import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type {
  AtaPublicProfile,
  AtaUserAccount,
  CreateWatchPartyInput,
  UpdateWatchPartyInput,
  WatchParty,
  WatchPartyMessage,
  WatchPartyParticipant,
  WatchPartyRsvpStatus,
} from '../../types';
import { upsertWatchReminder } from '../companion/calendarService';
import { auth, db, functions, handleFirestoreError, OperationType } from '../firebase';
import {
  computeScheduledStartUtcMs,
  INDEPENDENT_WATCH_NOTICE,
  validateWatchPartyForm,
  validateWatchPartyMessage,
} from '../validation';
import { deriveWatchPartyLifecycleStatus } from '../challenges/gamificationRules';

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function mapDocToWatchParty(
  id: string,
  data: Record<string, unknown>
): WatchParty {
  const scheduledStartAtMs =
    typeof data.scheduledStartAtMs === 'number' ? data.scheduledStartAtMs : 0;
  const estimatedDurationMinutes =
    typeof data.estimatedDurationMinutes === 'number'
      ? data.estimatedDurationMinutes
      : 30;
  const storedStatus = (data.status as WatchParty['status']) || 'scheduled';

  return {
    id,
    title: String(data.title || 'Untitled Watch Party'),
    description: String(data.description || ''),
    animeId: typeof data.animeId === 'number' ? data.animeId : 0,
    animeTitle: String(data.animeTitle || ''),
    animeCoverUrl: String(data.animeCoverUrl || ''),
    episodeNumber:
      typeof data.episodeNumber === 'number' ? data.episodeNumber : null,
    scheduledDate: String(data.scheduledDate || ''),
    startTime: String(data.startTime || ''),
    timezone: String(data.timezone || 'UTC'),
    scheduledStartAtMs,
    estimatedDurationMinutes,
    participantLimit:
      typeof data.participantLimit === 'number' ? data.participantLimit : null,
    participantCount:
      typeof data.participantCount === 'number' ? data.participantCount : 0,
    attendingCount:
      typeof data.attendingCount === 'number' ? data.attendingCount : 0,
    completedCount:
      typeof data.completedCount === 'number' ? data.completedCount : 0,
    visibility: (data.visibility as WatchParty['visibility']) || 'public',
    communityId: String(data.communityId || ''),
    communityName: String(data.communityName || ''),
    communityVisibility:
      (data.communityVisibility as WatchParty['communityVisibility']) || 'none',
    invitedUserIds: Array.isArray(data.invitedUserIds)
      ? (data.invitedUserIds as string[])
      : [],
    discussionEnabled: data.discussionEnabled !== false,
    registrationClosed: Boolean(data.registrationClosed),
    creatorId: String(data.creatorId || ''),
    creatorUsername: String(data.creatorUsername || ''),
    creatorDisplayName: String(data.creatorDisplayName || ''),
    status: deriveWatchPartyLifecycleStatus(
      storedStatus,
      scheduledStartAtMs,
      estimatedDurationMinutes
    ),
    moderationStatus:
      (data.moderationStatus as WatchParty['moderationStatus']) || 'active',
    moderationReason:
      typeof data.moderationReason === 'string' ? data.moderationReason : undefined,
    independentWatchNotice:
      typeof data.independentWatchNotice === 'string' &&
      data.independentWatchNotice.trim()
        ? data.independentWatchNotice
        : INDEPENDENT_WATCH_NOTICE,
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function mapDocToWatchPartyParticipant(
  id: string,
  data: Record<string, unknown>
): WatchPartyParticipant {
  return {
    id,
    partyId: String(data.partyId || ''),
    userId: String(data.userId || ''),
    username: String(data.username || ''),
    displayName: String(data.displayName || ''),
    avatarUrl: String(data.avatarUrl || ''),
    rsvpStatus: (data.rsvpStatus as WatchPartyRsvpStatus) || 'joined',
    reminderSet: Boolean(data.reminderSet),
    joinedAt: toDateOrNull(data.joinedAt),
    attendedAt: toDateOrNull(data.attendedAt),
    completedAt: toDateOrNull(data.completedAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function mapDocToWatchPartyMessage(
  id: string,
  data: Record<string, unknown>
): WatchPartyMessage {
  return {
    id,
    partyId: String(data.partyId || ''),
    authorId: String(data.authorId || ''),
    authorUsername: String(data.authorUsername || ''),
    authorDisplayName: String(data.authorDisplayName || ''),
    authorAvatarUrl: String(data.authorAvatarUrl || ''),
    content: String(data.content || ''),
    hasSpoiler: Boolean(data.hasSpoiler),
    isSystem: Boolean(data.isSystem),
    moderationStatus:
      data.moderationStatus === 'removed_by_moderator'
        ? 'removed_by_moderator'
        : 'active',
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export async function fetchVisibleWatchParties(
  currentUserId?: string,
  communityId?: string
): Promise<WatchParty[]> {
  try {
    if (communityId) {
      const q = query(
        collection(db, 'watchParties'),
        where('communityId', '==', communityId),
        orderBy('scheduledStartAtMs', 'asc'),
        limit(40)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => mapDocToWatchParty(d.id, d.data()))
        .filter((p) => p.moderationStatus === 'active');
    }

    const queries = [
      getDocs(
        query(
          collection(db, 'watchParties'),
          where('visibility', '==', 'public'),
          where('moderationStatus', '==', 'active'),
          orderBy('scheduledStartAtMs', 'asc'),
          limit(50)
        )
      ),
      getDocs(
        query(
          collection(db, 'watchParties'),
          where('visibility', '==', 'community'),
          where('communityVisibility', '==', 'public'),
          where('moderationStatus', '==', 'active'),
          limit(30)
        )
      ).catch(() => null),
    ];

    if (currentUserId) {
      queries.push(
        getDocs(
          query(
            collection(db, 'watchParties'),
            where('creatorId', '==', currentUserId),
            limit(30)
          )
        ).catch(() => null),
        getDocs(
          query(
            collection(db, 'watchParties'),
            where('invitedUserIds', 'array-contains', currentUserId),
            limit(25)
          )
        ).catch(() => null)
      );
    }

    const snaps = await Promise.all(queries);
    const merged = new Map<string, WatchParty>();
    for (const snap of snaps) {
      if (!snap) continue;
      snap.docs.forEach((docSnap) => {
        const mapped = mapDocToWatchParty(docSnap.id, docSnap.data());
        if (mapped.moderationStatus === 'active') {
          merged.set(mapped.id, mapped);
        }
      });
    }

    return Array.from(merged.values()).sort(
      (a, b) => a.scheduledStartAtMs - b.scheduledStartAtMs
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'watchParties');
  }
}

export async function fetchWatchPartyById(
  partyId: string
): Promise<WatchParty | null> {
  if (!partyId) return null;
  try {
    const snap = await getDoc(doc(db, 'watchParties', partyId));
    if (!snap.exists()) return null;
    return mapDocToWatchParty(snap.id, snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `watchParties/${partyId}`);
  }
}

export async function createWatchParty(
  creator: AtaPublicProfile | AtaUserAccount,
  input: CreateWatchPartyInput
): Promise<WatchParty> {
  const user = auth.currentUser;
  if (!user || user.uid !== creator.uid) {
    throw new Error('Please sign in to host a watch party.');
  }
  if (!user.emailVerified) {
    throw new Error('Please verify your email address before creating a watch party.');
  }

  const err = validateWatchPartyForm(input);
  if (err) throw new Error(err);

  await user.getIdToken(true);

  const scheduledStartAtMs = computeScheduledStartUtcMs(
    input.scheduledDate,
    input.startTime,
    input.timezone
  );
  const docRef = doc(collection(db, 'watchParties'));
  const invitedUserIds =
    input.visibility === 'private'
      ? Array.from(new Set((input.invitedUserIds || []).filter(Boolean))).slice(0, 50)
      : [];

  const payload = {
    id: docRef.id,
    title: input.title.trim(),
    description: input.description.trim(),
    animeId: input.animeId,
    animeTitle: input.animeTitle.trim(),
    animeCoverUrl: (input.animeCoverUrl || '').trim(),
    episodeNumber: input.episodeNumber ?? null,
    scheduledDate: input.scheduledDate,
    startTime: input.startTime,
    timezone: input.timezone.trim(),
    scheduledStartAtMs,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    participantLimit: input.participantLimit ?? null,
    participantCount: 0,
    attendingCount: 0,
    completedCount: 0,
    visibility: input.visibility,
    communityId: input.visibility === 'community' ? (input.communityId || '').trim() : '',
    communityName:
      input.visibility === 'community' ? (input.communityName || '').trim() : '',
    communityVisibility:
      input.visibility === 'community'
        ? input.communityVisibility || 'public'
        : 'none',
    invitedUserIds,
    discussionEnabled: Boolean(input.discussionEnabled),
    registrationClosed: false,
    creatorId: creator.uid,
    creatorUsername: creator.username,
    creatorDisplayName: creator.displayName,
    status: 'scheduled',
    moderationStatus: 'active',
    independentWatchNotice: INDEPENDENT_WATCH_NOTICE,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, payload);
    if (invitedUserIds.length > 0) {
      void inviteUsersToWatchParty(docRef.id, invitedUserIds).catch(() => undefined);
    }
    const created = await getDoc(docRef);
    return mapDocToWatchParty(
      docRef.id,
      created.exists() ? created.data() : (payload as unknown as Record<string, unknown>)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `watchParties/${docRef.id}`);
  }
}

export async function updateWatchParty(
  partyId: string,
  input: UpdateWatchPartyInput
): Promise<void> {
  const err = validateWatchPartyForm(input);
  if (err) throw new Error(err);

  const scheduledStartAtMs = computeScheduledStartUtcMs(
    input.scheduledDate,
    input.startTime,
    input.timezone
  );

  try {
    await updateDoc(doc(db, 'watchParties', partyId), {
      title: input.title.trim(),
      description: input.description.trim(),
      episodeNumber: input.episodeNumber ?? null,
      scheduledDate: input.scheduledDate,
      startTime: input.startTime,
      timezone: input.timezone.trim(),
      scheduledStartAtMs,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      participantLimit: input.participantLimit ?? null,
      discussionEnabled: Boolean(input.discussionEnabled),
      registrationClosed: Boolean(input.registrationClosed),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `watchParties/${partyId}`);
  }
}

export async function cancelWatchParty(partyId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'watchParties', partyId), {
      status: 'cancelled',
      registrationClosed: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `watchParties/${partyId}`);
  }
}

export async function markWatchPartyCompletedByHost(partyId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'watchParties', partyId), {
      status: 'completed',
      updatedAt: serverTimestamp(),
    });
    void httpsCallable(functions, 'syncWatchPartyRsvpRewards')({
      partyId,
    }).catch(() => undefined);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `watchParties/${partyId}`);
  }
}

export async function toggleWatchPartyRegistration(
  partyId: string,
  registrationClosed: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'watchParties', partyId), {
      registrationClosed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `watchParties/${partyId}`);
  }
}

export async function joinWatchParty(
  party: WatchParty,
  profile: AtaPublicProfile | AtaUserAccount,
  setReminder = true
): Promise<WatchPartyParticipant> {
  const user = auth.currentUser;
  if (!user || user.uid !== profile.uid) {
    throw new Error('Please sign in to join this watch party.');
  }
  if (!user.emailVerified) {
    throw new Error('Please verify your email address before joining.');
  }
  if (party.status === 'cancelled' || party.moderationStatus !== 'active') {
    throw new Error('This watch party is no longer active.');
  }
  if (party.registrationClosed) {
    throw new Error('Registration for this watch party is closed.');
  }
  if (
    party.participantLimit !== null &&
    party.participantCount >= party.participantLimit
  ) {
    throw new Error('This watch party has reached its participant limit.');
  }

  const partId = `${party.id}__${profile.uid}`;
  const partRef = doc(db, 'watchPartyParticipants', partId);
  const existing = await getDoc(partRef);
  if (existing.exists()) {
    return mapDocToWatchPartyParticipant(existing.id, existing.data());
  }

  const payload = {
    id: partId,
    partyId: party.id,
    userId: profile.uid,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl || '',
    rsvpStatus: 'joined',
    reminderSet: setReminder,
    joinedAt: serverTimestamp(),
    attendedAt: null,
    completedAt: null,
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(partRef, payload);
    batch.update(doc(db, 'watchParties', party.id), {
      participantCount: party.participantCount + 1,
    });
    await batch.commit();

    if (setReminder && party.scheduledStartAtMs > 0) {
      await upsertWatchReminder(profile.uid, {
        id: `wp_${party.id}`,
        animeId: String(party.animeId),
        animeTitle: `${party.animeTitle} (Watch Party)`,
        animeCoverUrl: party.animeCoverUrl,
        episodeNumber: party.episodeNumber || 1,
        airingAt: Math.floor(party.scheduledStartAtMs / 1000),
        offsetMinutes: 15,
        isNotified: false,
      }).catch(() => undefined);
    }

    const saved = await getDoc(partRef);
    return mapDocToWatchPartyParticipant(
      partId,
      saved.exists() ? saved.data() : (payload as unknown as Record<string, unknown>)
    );
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `watchPartyParticipants/${partId}`
    );
  }
}

export async function leaveWatchParty(
  party: WatchParty,
  userId: string
): Promise<void> {
  const partId = `${party.id}__${userId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'watchPartyParticipants', partId));
    batch.update(doc(db, 'watchParties', party.id), {
      participantCount: Math.max(0, party.participantCount - 1),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `watchPartyParticipants/${partId}`
    );
  }
}

export async function updateWatchPartyRsvpStatus(params: {
  party: WatchParty;
  participant: WatchPartyParticipant;
  rsvpStatus: WatchPartyRsvpStatus;
}): Promise<WatchPartyParticipant> {
  const { party, participant, rsvpStatus } = params;
  const partRef = doc(db, 'watchPartyParticipants', participant.id);

  const wasAttending =
    participant.rsvpStatus === 'attending' ||
    participant.rsvpStatus === 'completed';
  const wasCompleted = participant.rsvpStatus === 'completed';
  const nextAttending = rsvpStatus === 'attending' || rsvpStatus === 'completed';
  const nextCompleted = rsvpStatus === 'completed';

  const attendingDelta =
    nextAttending && !wasAttending ? 1 : !nextAttending && wasAttending ? -1 : 0;
  const completedDelta =
    nextCompleted && !wasCompleted ? 1 : !nextCompleted && wasCompleted ? -1 : 0;

  try {
    const batch = writeBatch(db);
    batch.update(partRef, {
      rsvpStatus,
      attendedAt: nextAttending
        ? participant.attendedAt || serverTimestamp()
        : null,
      completedAt: nextCompleted ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'watchParties', party.id), {
      attendingCount: Math.max(0, party.attendingCount + attendingDelta),
      completedCount: Math.max(0, party.completedCount + completedDelta),
    });
    await batch.commit();

    void httpsCallable(functions, 'syncWatchPartyRsvpRewards')({
      partyId: party.id,
    }).catch(() => undefined);

    return {
      ...participant,
      rsvpStatus,
      attendedAt: nextAttending ? participant.attendedAt || new Date() : null,
      completedAt: nextCompleted ? new Date() : null,
      updatedAt: new Date(),
    };
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `watchPartyParticipants/${participant.id}`
    );
  }
}

export async function removeWatchPartyParticipantByHost(
  party: WatchParty,
  targetUserId: string
): Promise<void> {
  const partId = `${party.id}__${targetUserId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'watchPartyParticipants', partId));
    batch.update(doc(db, 'watchParties', party.id), {
      participantCount: Math.max(0, party.participantCount - 1),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `watchPartyParticipants/${partId}`
    );
  }
}

export function subscribeToWatchPartyMessages(
  partyId: string,
  onMessages: (messages: WatchPartyMessage[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  if (!partyId) {
    onMessages([]);
    return () => {};
  }

  const q = query(
    collection(db, 'watchParties', partyId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onMessages(
        snapshot.docs
          .map((d) => mapDocToWatchPartyMessage(d.id, d.data()))
          .filter((m) => m.moderationStatus === 'active')
      );
    },
    (error) => {
      onError?.(
        error instanceof Error
          ? error.message
          : 'Unable to load watch party discussion.'
      );
    }
  );
}

export async function sendWatchPartyMessage(
  partyId: string,
  author: AtaPublicProfile | AtaUserAccount,
  content: string,
  hasSpoiler: boolean
): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.uid !== author.uid) {
    throw new Error('Please sign in to post in the watch party discussion.');
  }
  if (!user.emailVerified) {
    throw new Error('Please verify your email address before posting.');
  }

  const err = validateWatchPartyMessage(content);
  if (err) throw new Error(err);

  const msgRef = doc(collection(db, 'watchParties', partyId, 'messages'));
  try {
    await setDoc(msgRef, {
      id: msgRef.id,
      partyId,
      authorId: author.uid,
      authorUsername: author.username,
      authorDisplayName: author.displayName,
      authorAvatarUrl: author.avatarUrl || '',
      content: content.trim(),
      hasSpoiler: Boolean(hasSpoiler),
      isSystem: false,
      moderationStatus: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `watchParties/${partyId}/messages/${msgRef.id}`
    );
  }
}

export async function deleteWatchPartyMessage(
  partyId: string,
  messageId: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'watchParties', partyId, 'messages', messageId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `watchParties/${partyId}/messages/${messageId}`
    );
  }
}

export async function fetchUserWatchPartyParticipations(
  userId: string
): Promise<WatchPartyParticipant[]> {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, 'watchPartyParticipants'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDocToWatchPartyParticipant(d.id, d.data()));
  } catch {
    return [];
  }
}

export async function fetchWatchPartyParticipants(
  partyId: string
): Promise<WatchPartyParticipant[]> {
  if (!partyId) return [];
  try {
    const q = query(
      collection(db, 'watchPartyParticipants'),
      where('partyId', '==', partyId),
      orderBy('joinedAt', 'asc'),
      limit(60)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDocToWatchPartyParticipant(d.id, d.data()));
  } catch {
    return [];
  }
}

export async function inviteUsersToWatchParty(
  partyId: string,
  recipientIds: string[]
): Promise<number> {
  if (!partyId || recipientIds.length === 0) return 0;
  const callable = httpsCallable<
    { eventType: 'watch_party'; eventId: string; recipientIds: string[] },
    { ok: boolean; sentCount: number }
  >(functions, 'sendEventInvites');
  const res = await callable({
    eventType: 'watch_party',
    eventId: partyId,
    recipientIds,
  });
  return res.data.sentCount || 0;
}
