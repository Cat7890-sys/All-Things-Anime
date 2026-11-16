import { createNotification } from './notifications/notificationEventService';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import type {
  AtaCommunity,
  AtaUserAccount,
  CommunityCategory,
  CommunityJoinRequest,
  CommunityMembership,
  CommunityRole,
  CommunityStatus,
  CommunityVisibility,
  CreateCommunityInput,
  UpdateCommunityInput,
} from '../types';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  storage,
} from './firebase';
import {
  validateCreateCommunityForm,
  validateJoinRequestMessage,
  validateUpdateCommunityForm,
} from './validation';

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return null;
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.slice(0, 80) || 'image.jpg';
}

function cleanStringList(items: string[], maxItems: number): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= maxItems) break;
  }
  return result;
}

function mapDocToCommunity(
  id: string,
  data: Record<string, unknown>
): AtaCommunity {
  return {
    id,
    name: String(data.name || ''),
    nameLowercase: String(data.nameLowercase || ''),
    slug: String(data.slug || ''),
    description: String(data.description || ''),
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
    avatarPath: typeof data.avatarPath === 'string' ? data.avatarPath : '',
    coverUrl: typeof data.coverUrl === 'string' ? data.coverUrl : '',
    coverPath: typeof data.coverPath === 'string' ? data.coverPath : '',
    category: (data.category as CommunityCategory) || 'General',
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
  };
}

function mapDocToMembership(
  id: string,
  data: Record<string, unknown>
): CommunityMembership {
  const role: CommunityRole =
    data.role === 'owner'
      ? 'owner'
      : data.role === 'moderator'
        ? 'moderator'
        : 'member';

  return {
    id,
    communityId: String(data.communityId || ''),
    userId: String(data.userId || ''),
    username: String(data.username || ''),
    displayName: String(data.displayName || 'ATA Member'),
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
    role,
    joinedAt: toDateOrNull(data.joinedAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

function mapDocToJoinRequest(
  id: string,
  data: Record<string, unknown>
): CommunityJoinRequest {
  const status =
    data.status === 'approved'
      ? 'approved'
      : data.status === 'rejected'
        ? 'rejected'
        : 'pending';

  return {
    id,
    communityId: String(data.communityId || ''),
    userId: String(data.userId || ''),
    username: String(data.username || ''),
    displayName: String(data.displayName || 'ATA Member'),
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
    message: typeof data.message === 'string' ? data.message : '',
    status,
    reviewedBy: typeof data.reviewedBy === 'string' ? data.reviewedBy : '',
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

async function uploadCommunityAsset(
  uid: string,
  communityId: string,
  kind: 'avatar' | 'cover',
  file: File
): Promise<{ url: string; path: string }> {
  if (!storage) {
    throw new Error(
      'Firebase Storage is not configured in this project. You can provide an HTTPS image URL instead.'
    );
  }
  const safeName = sanitizeFilename(file.name);
  const path = `communities/${uid}/${communityId}/${kind}_${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  try {
    await uploadBytes(storageRef, file, {
      contentType: file.type,
    });
    const url = await getDownloadURL(storageRef);
    return { url, path };
  } catch (uploadError) {
    const code =
      typeof uploadError === 'object' &&
      uploadError !== null &&
      'code' in uploadError
        ? String((uploadError as { code: unknown }).code)
        : '';
    if (
      code.includes('storage/unauthorized') ||
      code.includes('storage/unknown')
    ) {
      throw new Error(
        'Image upload failed because Firebase Storage rules or bucket activation may not be completed yet. Try providing an HTTPS image URL or creating without uploading a file.'
      );
    }
    throw new Error(`Unable to upload ${kind} image. Please try again.`);
  }
}

async function bestEffortDeleteStorageObject(path: string): Promise<void> {
  if (!path || !storage) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // Best-effort cleanup
  }
}

export async function isCommunitySlugAvailable(slug: string): Promise<boolean> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return false;
  try {
    const snap = await getDoc(doc(db, 'communitySlugs', normalized));
    return !snap.exists();
  } catch {
    return false;
  }
}

export async function fetchPopularCommunities(
  maxCount = 40
): Promise<AtaCommunity[]> {
  try {
    const q = query(
      collection(db, 'communities'),
      where('status', '==', 'active'),
      orderBy('memberCount', 'desc'),
      limit(maxCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDocToCommunity(d.id, d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'communities');
  }
}

export async function fetchRecentCommunities(
  maxCount = 40
): Promise<AtaCommunity[]> {
  try {
    const q = query(
      collection(db, 'communities'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDocToCommunity(d.id, d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'communities');
  }
}

export async function fetchOwnedCommunities(
  ownerId: string
): Promise<AtaCommunity[]> {
  if (!ownerId) return [];
  try {
    const q = query(
      collection(db, 'communities'),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDocToCommunity(d.id, d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'communities');
  }
}

export async function fetchCommunityById(
  communityId: string
): Promise<AtaCommunity | null> {
  if (!communityId) return null;
  try {
    const snap = await getDoc(doc(db, 'communities', communityId));
    if (!snap.exists()) return null;
    return mapDocToCommunity(snap.id, snap.data());
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.GET,
      `communities/${communityId}`
    );
  }
}

export async function fetchUserMemberships(
  uid: string
): Promise<CommunityMembership[]> {
  if (!uid) return [];
  try {
    const q = query(
      collection(db, 'communityMemberships'),
      where('userId', '==', uid),
      orderBy('joinedAt', 'desc'),
      limit(60)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDocToMembership(d.id, d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'communityMemberships');
  }
}

export async function fetchUserPendingJoinRequestMap(
  uid: string
): Promise<Record<string, CommunityJoinRequest>> {
  if (!uid) return {};
  try {
    const q = query(
      collection(db, 'communityJoinRequests'),
      where('userId', '==', uid),
      where('status', '==', 'pending'),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    const map: Record<string, CommunityJoinRequest> = {};
    for (const d of snapshot.docs) {
      const req = mapDocToJoinRequest(d.id, d.data());
      map[req.communityId] = req;
    }
    return map;
  } catch {
    return {};
  }
}

export async function createCommunity(
  creatorProfile: AtaUserAccount,
  input: CreateCommunityInput
): Promise<AtaCommunity> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== creatorProfile.uid) {
    throw new Error('You must be signed in to create a community.');
  }
  if (!currentUser.emailVerified) {
    throw new Error(
      'Please verify your email address before creating a community.'
    );
  }

  const validationError = validateCreateCommunityForm(input);
  if (validationError) {
    throw new Error(validationError);
  }

  await currentUser.getIdToken(true);

  const normalizedSlug = input.slug.trim().toLowerCase();
  const communityRef = doc(collection(db, 'communities'));
  const communityId = communityRef.id;
  const slugRef = doc(db, 'communitySlugs', normalizedSlug);
  const membershipId = `${communityId}__${currentUser.uid}`;
  const membershipRef = doc(db, 'communityMemberships', membershipId);
  const rateLimitRef = doc(db, 'communityRateLimits', currentUser.uid);

  const slugSnap = await getDoc(slugRef);
  if (slugSnap.exists()) {
    throw new Error(
      `The slug "${normalizedSlug}" is already taken. Please choose a unique URL slug.`
    );
  }

  let avatarUrl = (input.avatarUrl || '').trim();
  let avatarPath = '';
  let coverUrl = (input.coverUrl || '').trim();
  let coverPath = '';

  if (input.avatarFile) {
    const uploaded = await uploadCommunityAsset(
      currentUser.uid,
      communityId,
      'avatar',
      input.avatarFile
    );
    avatarUrl = uploaded.url;
    avatarPath = uploaded.path;
  }

  if (input.coverFile) {
    try {
      const uploaded = await uploadCommunityAsset(
        currentUser.uid,
        communityId,
        'cover',
        input.coverFile
      );
      coverUrl = uploaded.url;
      coverPath = uploaded.path;
    } catch (coverErr) {
      if (avatarPath) await bestEffortDeleteStorageObject(avatarPath);
      throw coverErr;
    }
  }

  const trimmedName = input.name.trim();
  const trimmedDesc = input.description.trim();
  const cleanedTags = cleanStringList(input.animeTags, 8);
  const cleanedRules = cleanStringList(input.rules, 10);

  try {
    await runTransaction(db, async (transaction) => {
      const [latestSlugSnap, rateLimitSnap] = await Promise.all([
        transaction.get(slugRef),
        transaction.get(rateLimitRef),
      ]);

      if (latestSlugSnap.exists()) {
        throw new Error(
          `The slug "${normalizedSlug}" is already taken. Please choose another.`
        );
      }

      if (rateLimitSnap.exists()) {
        const lastCreated = toDateOrNull(rateLimitSnap.data().lastCreatedAt);
        if (lastCreated && Date.now() - lastCreated.getTime() < 30000) {
          throw new Error(
            'Please wait 30 seconds before creating another community.'
          );
        }
      }

      const now = serverTimestamp();

      transaction.set(rateLimitRef, {
        uid: currentUser.uid,
        lastCreatedAt: now,
      });

      transaction.set(slugRef, {
        communityId,
        slug: normalizedSlug,
        ownerId: currentUser.uid,
        createdAt: now,
      });

      transaction.set(communityRef, {
        id: communityId,
        name: trimmedName,
        nameLowercase: trimmedName.toLowerCase(),
        slug: normalizedSlug,
        description: trimmedDesc,
        avatarUrl,
        avatarPath,
        coverUrl,
        coverPath,
        category: input.category,
        animeTags: cleanedTags,
        rules: cleanedRules,
        ownerId: currentUser.uid,
        moderatorIds: [currentUser.uid],
        memberCount: 1,
        visibility: input.visibility,
        status: 'active',
        isFeatured: false,
        createdAt: now,
        updatedAt: now,
      });

      transaction.set(membershipRef, {
        id: membershipId,
        communityId,
        userId: currentUser.uid,
        username: creatorProfile.username,
        displayName: creatorProfile.displayName,
        avatarUrl: creatorProfile.avatarUrl,
        role: 'owner',
        joinedAt: now,
        updatedAt: now,
      });
    });

    const createdSnap = await getDoc(communityRef);
    if (!createdSnap.exists()) {
      throw new Error('Community was created but could not be reloaded.');
    }
    return mapDocToCommunity(createdSnap.id, createdSnap.data());
  } catch (error) {
    if (avatarPath) await bestEffortDeleteStorageObject(avatarPath);
    if (coverPath) await bestEffortDeleteStorageObject(coverPath);

    if (
      error instanceof Error &&
      (error.message.includes('already taken') ||
        error.message.includes('30 seconds'))
    ) {
      throw error;
    }

    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.toLowerCase().includes('permission') ||
      msg.toLowerCase().includes('insufficient')
    ) {
      try {
        const rateSnap = await getDoc(rateLimitRef);
        if (rateSnap.exists()) {
          const lastAt = toDateOrNull(rateSnap.data().lastCreatedAt);
          if (lastAt && Date.now() - lastAt.getTime() < 31000) {
            throw new Error(
              'You are creating communities too quickly. Please wait 30 seconds before trying again.'
            );
          }
        }
      } catch (cooldownErr) {
        if (
          cooldownErr instanceof Error &&
          cooldownErr.message.includes('30 seconds')
        ) {
          throw cooldownErr;
        }
      }
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `communities/${communityId}`
      );
    }

    throw error;
  }
}

export async function updateCommunityDetails(
  community: AtaCommunity,
  input: UpdateCommunityInput
): Promise<AtaCommunity> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error(
      'Verified authentication is required to update community details.'
    );
  }

  const validationError = validateUpdateCommunityForm(input);
  if (validationError) {
    throw new Error(validationError);
  }

  await currentUser.getIdToken(true);

  let nextAvatarUrl = input.removeAvatar
    ? ''
    : (input.avatarUrl ?? community.avatarUrl).trim();
  let nextAvatarPath = input.removeAvatar ? '' : community.avatarPath;

  let nextCoverUrl = input.removeCover
    ? ''
    : (input.coverUrl ?? community.coverUrl).trim();
  let nextCoverPath = input.removeCover ? '' : community.coverPath;

  let newAvatarPath = '';
  let newCoverPath = '';

  if (input.avatarFile) {
    const uploaded = await uploadCommunityAsset(
      currentUser.uid,
      community.id,
      'avatar',
      input.avatarFile
    );
    nextAvatarUrl = uploaded.url;
    nextAvatarPath = uploaded.path;
    newAvatarPath = uploaded.path;
  } else if (input.avatarUrl !== undefined && input.avatarUrl !== community.avatarUrl) {
    nextAvatarPath = '';
  }

  if (input.coverFile) {
    try {
      const uploaded = await uploadCommunityAsset(
        currentUser.uid,
        community.id,
        'cover',
        input.coverFile
      );
      nextCoverUrl = uploaded.url;
      nextCoverPath = uploaded.path;
      newCoverPath = uploaded.path;
    } catch (coverErr) {
      if (newAvatarPath) await bestEffortDeleteStorageObject(newAvatarPath);
      throw coverErr;
    }
  } else if (input.coverUrl !== undefined && input.coverUrl !== community.coverUrl) {
    nextCoverPath = '';
  }

  const trimmedName = input.name.trim();
  const trimmedDesc = input.description.trim();
  const cleanedTags = cleanStringList(input.animeTags, 8);
  const cleanedRules = cleanStringList(input.rules, 10);

  const communityRef = doc(db, 'communities', community.id);
  try {
    await runTransaction(db, async (transaction) => {
      transaction.update(communityRef, {
        name: trimmedName,
        nameLowercase: trimmedName.toLowerCase(),
        description: trimmedDesc,
        avatarUrl: nextAvatarUrl,
        avatarPath: nextAvatarPath,
        coverUrl: nextCoverUrl,
        coverPath: nextCoverPath,
        category: input.category,
        animeTags: cleanedTags,
        rules: cleanedRules,
        updatedAt: serverTimestamp(),
      });
    });

    if (
      (input.removeAvatar || newAvatarPath) &&
      community.avatarPath &&
      community.avatarPath !== nextAvatarPath
    ) {
      await bestEffortDeleteStorageObject(community.avatarPath);
    }
    if (
      (input.removeCover || newCoverPath) &&
      community.coverPath &&
      community.coverPath !== nextCoverPath
    ) {
      await bestEffortDeleteStorageObject(community.coverPath);
    }

    const updatedSnap = await getDoc(communityRef);
    if (!updatedSnap.exists()) {
      throw new Error('Community could not be reloaded after updating.');
    }
    return mapDocToCommunity(updatedSnap.id, updatedSnap.data());
  } catch (error) {
    if (newAvatarPath) await bestEffortDeleteStorageObject(newAvatarPath);
    if (newCoverPath) await bestEffortDeleteStorageObject(newCoverPath);
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `communities/${community.id}`
    );
  }
}

export async function updateCommunityOwnerSettings(
  communityId: string,
  settings: {
    visibility: CommunityVisibility;
    status: CommunityStatus;
  }
): Promise<AtaCommunity> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error(
      'Verified authentication is required to update owner settings.'
    );
  }

  await currentUser.getIdToken(true);

  const communityRef = doc(db, 'communities', communityId);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(communityRef);
      if (!snap.exists()) {
        throw new Error('Community no longer exists.');
      }
      if (snap.data().ownerId !== currentUser.uid) {
        throw new Error('Only the community owner can change these settings.');
      }
      transaction.update(communityRef, {
        visibility: settings.visibility,
        status: settings.status,
        updatedAt: serverTimestamp(),
      });
    });

    const updatedSnap = await getDoc(communityRef);
    if (!updatedSnap.exists()) {
      throw new Error('Community could not be reloaded.');
    }
    return mapDocToCommunity(updatedSnap.id, updatedSnap.data());
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('owner') || error.message.includes('exists'))
    ) {
      throw error;
    }
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `communities/${communityId}`
    );
  }
}

export async function deleteCommunity(community: AtaCommunity): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Verified authentication is required to delete a community.');
  }
  if (community.ownerId !== currentUser.uid) {
    throw new Error('Only the community owner can permanently delete this club.');
  }

  await currentUser.getIdToken(true);

  try {
    const [membersSnap, requestsSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'communityMemberships'),
          where('communityId', '==', community.id),
          limit(150)
        )
      ),
      getDocs(
        query(
          collection(db, 'communityJoinRequests'),
          where('communityId', '==', community.id),
          limit(150)
        )
      ),
    ]);

    const batch = writeBatch(db);
    batch.delete(doc(db, 'communities', community.id));
    batch.delete(doc(db, 'communitySlugs', community.slug));
    batch.delete(
      doc(db, 'communityMemberships', `${community.id}__${currentUser.uid}`)
    );

    for (const mDoc of membersSnap.docs) {
      if (mDoc.id !== `${community.id}__${currentUser.uid}`) {
        batch.delete(mDoc.ref);
      }
    }
    for (const rDoc of requestsSnap.docs) {
      batch.delete(rDoc.ref);
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `communities/${community.id}`
    );
  }

  await Promise.all([
    bestEffortDeleteStorageObject(community.avatarPath),
    bestEffortDeleteStorageObject(community.coverPath),
  ]);
}

export async function fetchMyCommunityMembership(
  communityId: string,
  uid: string
): Promise<CommunityMembership | null> {
  if (!communityId || !uid) return null;
  const membershipId = `${communityId}__${uid}`;
  try {
    const snap = await getDoc(doc(db, 'communityMemberships', membershipId));
    if (!snap.exists()) return null;
    return mapDocToMembership(snap.id, snap.data());
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.GET,
      `communityMemberships/${membershipId}`
    );
  }
}

export async function fetchCommunityMembers(
  communityId: string,
  maxCount = 100
): Promise<CommunityMembership[]> {
  if (!communityId) return [];
  try {
    const q = query(
      collection(db, 'communityMemberships'),
      where('communityId', '==', communityId),
      orderBy('joinedAt', 'desc'),
      limit(maxCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDocToMembership(d.id, d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'communityMemberships');
  }
}

export async function joinPublicCommunity(
  communityId: string,
  userProfile: AtaUserAccount
): Promise<{ membership: CommunityMembership; memberCount: number }> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userProfile.uid) {
    throw new Error('Please sign in to join this community.');
  }
  if (!currentUser.emailVerified) {
    throw new Error(
      'Please verify your email address before joining communities.'
    );
  }

  await currentUser.getIdToken(true);

  const membershipId = `${communityId}__${currentUser.uid}`;
  const communityRef = doc(db, 'communities', communityId);
  const membershipRef = doc(db, 'communityMemberships', membershipId);

  try {
    const nextCount = await runTransaction(db, async (transaction) => {
      const [commSnap, memSnap] = await Promise.all([
        transaction.get(communityRef),
        transaction.get(membershipRef),
      ]);

      if (!commSnap.exists()) {
        throw new Error('This community no longer exists.');
      }
      const data = commSnap.data();
      if (data.status !== 'active') {
        throw new Error('This community is archived and closed to new members.');
      }
      if (data.visibility !== 'public') {
        throw new Error(
          'This is a private community. Please submit a membership request instead.'
        );
      }
      if (memSnap.exists()) {
        throw new Error('You are already a member of this community.');
      }

      const currentMembers =
        typeof data.memberCount === 'number' ? data.memberCount : 0;
      const updatedCount = currentMembers + 1;
      const now = serverTimestamp();

      transaction.set(membershipRef, {
        id: membershipId,
        communityId,
        userId: currentUser.uid,
        username: userProfile.username,
        displayName: userProfile.displayName,
        avatarUrl: userProfile.avatarUrl,
        role: 'member',
        joinedAt: now,
        updatedAt: now,
      });

      transaction.update(communityRef, {
        memberCount: updatedCount,
      });

      return updatedCount;
    });

    const createdSnap = await getDoc(membershipRef);
    if (!createdSnap.exists()) {
      throw new Error('Membership was saved but could not be loaded.');
    }
    return {
      membership: mapDocToMembership(createdSnap.id, createdSnap.data()),
      memberCount: nextCount,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('already a member') ||
        error.message.includes('private community') ||
        error.message.includes('archived'))
    ) {
      throw error;
    }
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `communityMemberships/${membershipId}`
    );
  }
}

export async function leaveCommunity(
  communityId: string,
  uid: string
): Promise<number> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    throw new Error('Please sign in first.');
  }
  if (!currentUser.emailVerified) {
    throw new Error('Please verify your email address first.');
  }

  await currentUser.getIdToken(true);

  const membershipId = `${communityId}__${uid}`;
  const communityRef = doc(db, 'communities', communityId);
  const membershipRef = doc(db, 'communityMemberships', membershipId);

  try {
    return await runTransaction(db, async (transaction) => {
      const [commSnap, memSnap] = await Promise.all([
        transaction.get(communityRef),
        transaction.get(membershipRef),
      ]);

      if (!memSnap.exists()) {
        throw new Error('You are not currently a member of this community.');
      }
      if (memSnap.data().role === 'owner') {
        throw new Error(
          'Community owners cannot leave without deleting or archiving the community.'
        );
      }

      const currentMembers =
        commSnap.exists() && typeof commSnap.data().memberCount === 'number'
          ? commSnap.data().memberCount
          : 0;
      const nextCount = Math.max(0, currentMembers - 1);

      transaction.delete(membershipRef);
      if (commSnap.exists() && currentMembers >= 1) {
        transaction.update(communityRef, {
          memberCount: nextCount,
        });
      }
      return nextCount;
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('owners cannot leave') ||
        error.message.includes('not currently a member'))
    ) {
      throw error;
    }
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `communityMemberships/${membershipId}`
    );
  }
}

export async function fetchMyJoinRequest(
  communityId: string,
  uid: string
): Promise<CommunityJoinRequest | null> {
  if (!communityId || !uid) return null;
  const requestId = `${communityId}__${uid}`;
  try {
    const snap = await getDoc(doc(db, 'communityJoinRequests', requestId));
    if (!snap.exists()) return null;
    return mapDocToJoinRequest(snap.id, snap.data());
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.GET,
      `communityJoinRequests/${requestId}`
    );
  }
}

export async function requestPrivateMembership(
  communityId: string,
  userProfile: AtaUserAccount,
  message = ''
): Promise<CommunityJoinRequest> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userProfile.uid) {
    throw new Error('Please sign in to request membership.');
  }
  if (!currentUser.emailVerified) {
    throw new Error(
      'Please verify your email address before requesting private community access.'
    );
  }

  const msgError = validateJoinRequestMessage(message);
  if (msgError) {
    throw new Error(msgError);
  }

  await currentUser.getIdToken(true);

  const requestId = `${communityId}__${currentUser.uid}`;
  const requestRef = doc(db, 'communityJoinRequests', requestId);
  const membershipRef = doc(db, 'communityMemberships', requestId);
  const communityRef = doc(db, 'communities', communityId);

  try {
    await runTransaction(db, async (transaction) => {
      const [commSnap, memSnap, reqSnap] = await Promise.all([
        transaction.get(communityRef),
        transaction.get(membershipRef),
        transaction.get(requestRef),
      ]);

      if (!commSnap.exists()) {
        throw new Error('This community no longer exists.');
      }
      if (commSnap.data().status !== 'active') {
        throw new Error('This community is archived.');
      }
      if (commSnap.data().visibility === 'public') {
        throw new Error('This community is public — you can join directly.');
      }
      if (memSnap.exists()) {
        throw new Error('You are already a member of this community.');
      }

      const trimmedMessage = message.trim();
      const now = serverTimestamp();

      if (!reqSnap.exists()) {
        transaction.set(requestRef, {
          id: requestId,
          communityId,
          userId: currentUser.uid,
          username: userProfile.username,
          displayName: userProfile.displayName,
          avatarUrl: userProfile.avatarUrl,
          message: trimmedMessage,
          status: 'pending',
          reviewedBy: '',
          createdAt: now,
          updatedAt: now,
        });
      } else {
        if (reqSnap.data().status === 'pending') {
          throw new Error('Your membership request is already pending review.');
        }
        transaction.update(requestRef, {
          message: trimmedMessage,
          status: 'pending',
          reviewedBy: '',
          updatedAt: now,
        });
      }
    });

    const savedSnap = await getDoc(requestRef);
    if (!savedSnap.exists()) {
      throw new Error('Membership request could not be reloaded.');
    }
    const commSnap = await getDoc(communityRef);
    if (commSnap.exists()) {
      const commData = commSnap.data();
      const recipients = Array.from(
        new Set([
          String(commData.ownerId || ''),
          ...((commData.moderatorIds as string[]) || []),
        ])
      ).filter((id) => id && id !== currentUser.uid);

      for (const recipientId of recipients) {
        void createNotification({
          recipientId,
          actorId: currentUser.uid,
          type: 'join_request',
          category: 'communities',
          title: 'Community Join Request',
          body: `${userProfile.displayName} requested to join ${commData.name || 'community'}.`,
          targetType: 'community',
          targetId: communityId,
          route: `/communities/${communityId}`,
          dedupeKey: `joinreq_${communityId}_${currentUser.uid}`,
        });
      }
    }
    return mapDocToJoinRequest(savedSnap.id, savedSnap.data());
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('already pending') ||
        error.message.includes('already a member') ||
        error.message.includes('join directly'))
    ) {
      throw error;
    }
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `communityJoinRequests/${requestId}`
    );
  }
}

export async function cancelJoinRequest(
  communityId: string,
  uid: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid || !currentUser.emailVerified) {
    throw new Error('Verified authentication is required.');
  }

  await currentUser.getIdToken(true);

  const requestId = `${communityId}__${uid}`;
  try {
    await runTransaction(db, async (transaction) => {
      const reqRef = doc(db, 'communityJoinRequests', requestId);
      const snap = await transaction.get(reqRef);
      if (!snap.exists()) return;
      if (snap.data().status === 'pending') {
        transaction.delete(reqRef);
      }
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `communityJoinRequests/${requestId}`
    );
  }
}

export async function fetchPendingJoinRequests(
  communityId: string
): Promise<CommunityJoinRequest[]> {
  if (!communityId) return [];
  try {
    const q = query(
      collection(db, 'communityJoinRequests'),
      where('communityId', '==', communityId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapDocToJoinRequest(d.id, d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'communityJoinRequests');
  }
}

export async function approveJoinRequest(
  communityId: string,
  request: CommunityJoinRequest,
  moderatorUid: string
): Promise<number> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== moderatorUid) {
    throw new Error('Please sign in first.');
  }
  if (!currentUser.emailVerified) {
    throw new Error('Please verify your email address first.');
  }

  await currentUser.getIdToken(true);

  const pairId = `${communityId}__${request.userId}`;
  const communityRef = doc(db, 'communities', communityId);
  const requestRef = doc(db, 'communityJoinRequests', pairId);
  const membershipRef = doc(db, 'communityMemberships', pairId);

  try {
    const nextCount = await runTransaction(db, async (transaction) => {
      const [commSnap, reqSnap, memSnap] = await Promise.all([
        transaction.get(communityRef),
        transaction.get(requestRef),
        transaction.get(membershipRef),
      ]);

      if (!commSnap.exists()) {
        throw new Error('Community no longer exists.');
      }
      if (!reqSnap.exists() || reqSnap.data().status !== 'pending') {
        throw new Error('This join request is no longer pending.');
      }
      if (memSnap.exists()) {
        throw new Error('This user is already a community member.');
      }

      const currentMembers =
        typeof commSnap.data().memberCount === 'number'
          ? commSnap.data().memberCount
          : 0;
      const countVal = currentMembers + 1;
      const now = serverTimestamp();

      transaction.update(requestRef, {
        status: 'approved',
        reviewedBy: moderatorUid,
        updatedAt: now,
      });

      transaction.set(membershipRef, {
        id: pairId,
        communityId,
        userId: request.userId,
        username: request.username,
        displayName: request.displayName,
        avatarUrl: request.avatarUrl,
        role: 'member',
        joinedAt: now,
        updatedAt: now,
      });

      transaction.update(communityRef, {
        memberCount: countVal,
      });

      return countVal;
    });

    void createNotification({
      recipientId: request.userId,
      actorId: moderatorUid,
      type: 'approve_request',
      category: 'communities',
      title: 'Membership Approved',
      body: 'Your community membership request was approved.',
      targetType: 'community',
      targetId: communityId,
      route: `/communities/${communityId}`,
      dedupeKey: `appreq_${communityId}_${request.userId}`,
    });

    return nextCount;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('no longer pending') ||
        error.message.includes('already a community member'))
    ) {
      throw error;
    }
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `communityJoinRequests/${pairId}`
    );
  }
}

export async function rejectJoinRequest(
  communityId: string,
  targetUserId: string,
  moderatorUid: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== moderatorUid) {
    throw new Error('Please sign in first.');
  }
  if (!currentUser.emailVerified) {
    throw new Error('Please verify your email address first.');
  }

  await currentUser.getIdToken(true);

  const pairId = `${communityId}__${targetUserId}`;
  const requestRef = doc(db, 'communityJoinRequests', pairId);

  try {
    await runTransaction(db, async (transaction) => {
      const reqSnap = await transaction.get(requestRef);
      if (!reqSnap.exists() || reqSnap.data().status !== 'pending') {
        throw new Error('This join request is no longer pending.');
      }
      transaction.update(requestRef, {
        status: 'rejected',
        reviewedBy: moderatorUid,
        updatedAt: serverTimestamp(),
      });
    });

    void createNotification({
      recipientId: targetUserId,
      actorId: moderatorUid,
      type: 'decline_request',
      category: 'communities',
      title: 'Membership Declined',
      body: 'Your community membership request was declined.',
      targetType: 'community',
      targetId: communityId,
      route: `/communities/${communityId}`,
      dedupeKey: `decreq_${communityId}_${targetUserId}`,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('no longer pending')) {
      throw error;
    }
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `communityJoinRequests/${pairId}`
    );
  }
}

export async function setMemberRole(
  communityId: string,
  targetUserId: string,
  nextRole: 'member' | 'moderator'
): Promise<string[]> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Verified owner authentication is required.');
  }

  await currentUser.getIdToken(true);

  const communityRef = doc(db, 'communities', communityId);
  const membershipId = `${communityId}__${targetUserId}`;
  const membershipRef = doc(db, 'communityMemberships', membershipId);

  try {
    return await runTransaction(db, async (transaction) => {
      const [commSnap, memSnap] = await Promise.all([
        transaction.get(communityRef),
        transaction.get(membershipRef),
      ]);

      if (!commSnap.exists()) {
        throw new Error('Community no longer exists.');
      }
      const commData = commSnap.data();
      if (commData.ownerId !== currentUser.uid) {
        throw new Error('Only the community owner can manage moderator roles.');
      }
      if (!memSnap.exists()) {
        throw new Error('Member record was not found.');
      }
      if (memSnap.data().role === 'owner' || targetUserId === commData.ownerId) {
        throw new Error('The owner role cannot be changed.');
      }

      const currentMods: string[] = Array.isArray(commData.moderatorIds)
        ? commData.moderatorIds.map((v: unknown) => String(v))
        : [String(commData.ownerId)];

      const nextMods =
        nextRole === 'moderator'
          ? currentMods.includes(targetUserId)
            ? currentMods
            : [...currentMods, targetUserId]
          : currentMods.filter((id) => id !== targetUserId);

      if (nextMods.length > 25) {
        throw new Error('A community can have at most 25 moderators.');
      }

      const now = serverTimestamp();
      transaction.update(communityRef, {
        moderatorIds: nextMods,
        updatedAt: now,
      });
      transaction.update(membershipRef, {
        role: nextRole,
        updatedAt: now,
      });

      return nextMods;
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('owner') || error.message.includes('25 moderators'))
    ) {
      throw error;
    }
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `communityMemberships/${membershipId}`
    );
  }
}

export async function removeCommunityMember(
  communityId: string,
  targetUserId: string
): Promise<{ memberCount: number; moderatorIds: string[] }> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Verified moderator authentication is required.');
  }

  await currentUser.getIdToken(true);

  const communityRef = doc(db, 'communities', communityId);
  const membershipId = `${communityId}__${targetUserId}`;
  const membershipRef = doc(db, 'communityMemberships', membershipId);

  // If the owner is removing an active moderator, first demote them atomically so
  // moderatorIds stays synchronized with the community document under rules.
  const preMemSnap = await getDoc(membershipRef);
  if (!preMemSnap.exists()) {
    throw new Error('Member is no longer in this community.');
  }
  if (preMemSnap.data().role === 'owner') {
    throw new Error('The community owner cannot be removed.');
  }
  if (preMemSnap.data().role === 'moderator') {
    await setMemberRole(communityId, targetUserId, 'member');
  }

  try {
    return await runTransaction(db, async (transaction) => {
      const [commSnap, memSnap] = await Promise.all([
        transaction.get(communityRef),
        transaction.get(membershipRef),
      ]);

      if (!commSnap.exists()) {
        throw new Error('Community no longer exists.');
      }
      if (!memSnap.exists()) {
        throw new Error('Member is no longer in this community.');
      }
      if (memSnap.data().role === 'owner') {
        throw new Error('The community owner cannot be removed.');
      }

      const currentMembers =
        typeof commSnap.data().memberCount === 'number'
          ? commSnap.data().memberCount
          : 0;
      const nextCount = Math.max(0, currentMembers - 1);

      transaction.delete(membershipRef);
      if (currentMembers >= 1) {
        transaction.update(communityRef, {
          memberCount: nextCount,
        });
      }

      const mods: string[] = Array.isArray(commSnap.data().moderatorIds)
        ? commSnap.data().moderatorIds.map((v: unknown) => String(v))
        : [];
      return { memberCount: nextCount, moderatorIds: mods };
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `communityMemberships/${membershipId}`
    );
  }
}
