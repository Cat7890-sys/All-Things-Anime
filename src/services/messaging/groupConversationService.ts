import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
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
  AtaConversation,
  AtaConversationMember,
  AtaPublicProfile,
  AtaUserAccount,
  ConversationMemberRole,
  CreateGroupConversationInput,
  UpdateGroupConversationInput,
} from '../../types';
import { db, handleFirestoreError, OperationType, storage } from '../firebase';
import { checkBlockBetween } from '../socialGraphService';
import {
  GROUP_MAX_PARTICIPANTS,
  validateCreateGroupForm,
  validateUpdateGroupForm,
} from '../validation';
import {
  mapDocToConversation,
  requireVerifiedMessagingUser,
  sanitizeFilename,
  toDateOrNull,
} from './messagingUtils';
import { emitMessagingNotificationEvent } from './notificationBoundaryService';

async function uploadGroupAvatar(
  uid: string,
  conversationId: string,
  file: File
): Promise<{ url: string; path: string }> {
  if (!storage) {
    throw new Error(
      'Firebase Storage is not configured. You can still provide an HTTPS image URL or create the group without an icon.'
    );
  }
  const safeName = sanitizeFilename(file.name);
  const storagePath = `groups/${uid}/${conversationId}/avatar_${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  try {
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);
    return { url, path: storagePath };
  } catch {
    throw new Error(
      'Unable to upload group icon right now. Check image format/size or use an HTTPS URL.'
    );
  }
}

export async function createGroupConversation(
  creator: AtaUserAccount,
  input: CreateGroupConversationInput,
  resolvedParticipants: AtaPublicProfile[]
): Promise<AtaConversation> {
  const { uid } = await requireVerifiedMessagingUser();
  if (uid !== creator.uid) {
    throw new Error('Signed-in session mismatch.');
  }

  const formErr = validateCreateGroupForm(creator.uid, {
    ...input,
    participantIds: resolvedParticipants.map((p) => p.uid),
  });
  if (formErr) {
    throw new Error(formErr);
  }

  // Deduplicate and verify zero blocked users among selected participants
  const uniqueOtherProfiles: AtaPublicProfile[] = [];
  const seen = new Set<string>([creator.uid]);
  for (const profile of resolvedParticipants) {
    if (!profile.uid || seen.has(profile.uid)) continue;
    seen.add(profile.uid);
    const blockState = await checkBlockBetween(creator.uid, profile.uid);
    if (blockState.blockedByMe || blockState.blockedByThem) {
      throw new Error(
        `Cannot invite @${profile.username} because an account block is active.`
      );
    }
    uniqueOtherProfiles.push(profile);
  }

  if (uniqueOtherProfiles.length === 0) {
    throw new Error('Select at least one member to create a group chat.');
  }
  if (uniqueOtherProfiles.length + 1 > GROUP_MAX_PARTICIPANTS) {
    throw new Error(
      `Groups support up to ${GROUP_MAX_PARTICIPANTS} participants.`
    );
  }

  const convRef = doc(collection(db, 'conversations'));
  const conversationId = convRef.id;

  let avatarUrl = (input.avatarUrl || '').trim();
  let avatarPath = '';

  if (input.avatarFile) {
    const uploaded = await uploadGroupAvatar(
      creator.uid,
      conversationId,
      input.avatarFile
    );
    avatarUrl = uploaded.url;
    avatarPath = uploaded.path;
  }

  const participantIds = [
    creator.uid,
    ...uniqueOtherProfiles.map((p) => p.uid),
  ];
  const systemText = `${creator.displayName} created the group "${input.name.trim()}".`;

  try {
    await runTransaction(db, async (transaction) => {
      const rateRef = doc(db, 'messageRateLimits', creator.uid);
      const rateSnap = await transaction.get(rateRef);
      const now = serverTimestamp();

      const rateData = rateSnap.exists() ? rateSnap.data() : null;
      if (rateSnap.exists()) {
        transaction.update(rateRef, {
          lastMessageAt: rateData?.lastMessageAt ?? null,
          lastRequestAt: rateData?.lastRequestAt ?? null,
          lastGroupCreatedAt: now,
        });
      } else {
        transaction.set(rateRef, {
          uid: creator.uid,
          lastMessageAt: null,
          lastRequestAt: null,
          lastGroupCreatedAt: now,
        });
      }

      transaction.set(convRef, {
        id: conversationId,
        type: 'group',
        directKey: '',
        name: input.name.trim(),
        description: input.description.trim(),
        avatarUrl,
        avatarPath,
        ownerId: creator.uid,
        adminIds: [creator.uid],
        participantIds,
        lastMessageText: systemText.slice(0, 200),
        lastMessageSenderId: creator.uid,
        lastMessageType: 'system',
        lastMessageAt: now,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      transaction.set(
        doc(db, 'conversationMembers', `${conversationId}__${creator.uid}`),
        {
          id: `${conversationId}__${creator.uid}`,
          conversationId,
          userId: creator.uid,
          username: creator.username,
          displayName: creator.displayName,
          avatarUrl: creator.avatarUrl,
          role: 'owner',
          unreadCount: 0,
          lastReadAt: now,
          muted: false,
          archived: false,
          joinedAt: now,
          updatedAt: now,
        }
      );

      for (const peer of uniqueOtherProfiles) {
        transaction.set(
          doc(db, 'conversationMembers', `${conversationId}__${peer.uid}`),
          {
            id: `${conversationId}__${peer.uid}`,
            conversationId,
            userId: peer.uid,
            username: peer.username,
            displayName: peer.displayName,
            avatarUrl: peer.avatarUrl,
            role: 'member',
            unreadCount: 1,
            lastReadAt: null,
            muted: false,
            archived: false,
            joinedAt: now,
            updatedAt: now,
          }
        );
      }

      const initMsgRef = doc(
        collection(db, 'conversations', conversationId, 'messages')
      );
      transaction.set(initMsgRef, {
        id: initMsgRef.id,
        conversationId,
        senderId: creator.uid,
        senderUsername: creator.username,
        senderDisplayName: creator.displayName,
        senderAvatarUrl: creator.avatarUrl,
        messageType: 'system',
        text: systemText,
        replyToMessageId: '',
        replyToPreview: '',
        replyToSenderName: '',
        editedAt: null,
        deletedAt: null,
        createdAt: now,
      });
    });

    emitMessagingNotificationEvent({
      type: 'group_membership_change',
      recipientIds: uniqueOtherProfiles.map((p) => p.uid),
      actorId: creator.uid,
      conversationId,
    });

    const createdSnap = await getDoc(convRef);
    if (!createdSnap.exists()) {
      throw new Error('Group was created but could not be reloaded.');
    }
    return mapDocToConversation(createdSnap.id, createdSnap.data());
  } catch (error) {
    if (avatarPath && storage) {
      try {
        await deleteObject(ref(storage, avatarPath));
      } catch {
        // Ignore best-effort cleanup
      }
    }
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.toLowerCase().includes('permission') ||
      msg.toLowerCase().includes('insufficient')
    ) {
      try {
        const rateSnap = await getDoc(doc(db, 'messageRateLimits', creator.uid));
        if (rateSnap.exists()) {
          const lastAt = toDateOrNull(rateSnap.data().lastGroupCreatedAt);
          if (lastAt && Date.now() - lastAt.getTime() < 21000) {
            throw new Error(
              'Please wait 20 seconds before creating another group conversation.'
            );
          }
        }
      } catch (cooldownErr) {
        if (
          cooldownErr instanceof Error &&
          cooldownErr.message.includes('20 seconds')
        ) {
          throw cooldownErr;
        }
      }
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `conversations/${conversationId}`
      );
    }
    throw error;
  }
}

export async function updateGroupConversationDetails(
  conversation: AtaConversation,
  actorUid: string,
  input: UpdateGroupConversationInput
): Promise<void> {
  const { uid } = await requireVerifiedMessagingUser();
  if (uid !== actorUid || !conversation.adminIds.includes(actorUid)) {
    throw new Error('Only group owners or admins can update group details.');
  }

  const formErr = validateUpdateGroupForm(input);
  if (formErr) throw new Error(formErr);

  let nextAvatarUrl = input.removeAvatar
    ? ''
    : (input.avatarUrl ?? conversation.avatarUrl).trim();
  let nextAvatarPath = input.removeAvatar ? '' : conversation.avatarPath;
  const previousAvatarPath = conversation.avatarPath;

  if (input.avatarFile) {
    const uploaded = await uploadGroupAvatar(
      actorUid,
      conversation.id,
      input.avatarFile
    );
    nextAvatarUrl = uploaded.url;
    nextAvatarPath = uploaded.path;
  }

  const path = `conversations/${conversation.id}`;
  try {
    await updateDoc(doc(db, 'conversations', conversation.id), {
      name: input.name.trim(),
      description: input.description.trim(),
      avatarUrl: nextAvatarUrl,
      avatarPath: nextAvatarPath,
      updatedAt: serverTimestamp(),
    });

    if (
      previousAvatarPath &&
      storage &&
      (input.removeAvatar || (input.avatarFile && previousAvatarPath !== nextAvatarPath))
    ) {
      try {
        await deleteObject(ref(storage, previousAvatarPath));
      } catch {
        // Best-effort old avatar cleanup
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addGroupMember(
  conversation: AtaConversation,
  actor: AtaUserAccount,
  newMember: AtaPublicProfile
): Promise<void> {
  const { uid } = await requireVerifiedMessagingUser();
  if (uid !== actor.uid || !conversation.adminIds.includes(actor.uid)) {
    throw new Error('Only group owners or admins can add members.');
  }

  if (conversation.participantIds.includes(newMember.uid)) {
    throw new Error(`@${newMember.username} is already in this group.`);
  }
  if (conversation.participantIds.length >= GROUP_MAX_PARTICIPANTS) {
    throw new Error(
      `Groups support a maximum of ${GROUP_MAX_PARTICIPANTS} participants.`
    );
  }

  const blockState = await checkBlockBetween(actor.uid, newMember.uid);
  if (blockState.blockedByMe || blockState.blockedByThem) {
    throw new Error(
      `Cannot add @${newMember.username} due to an active account block.`
    );
  }

  const systemText = `${actor.displayName} added @${newMember.username} to the group.`;
  const path = `conversations/${conversation.id}`;

  try {
    await runTransaction(db, async (transaction) => {
      const convRef = doc(db, 'conversations', conversation.id);
      const memberRef = doc(
        db,
        'conversationMembers',
        `${conversation.id}__${newMember.uid}`
      );
      const sysMsgRef = doc(
        collection(db, 'conversations', conversation.id, 'messages')
      );

      const convSnap = await transaction.get(convRef);
      if (!convSnap.exists() || convSnap.data().status !== 'active') {
        throw new Error('This group conversation is not active.');
      }
      const existingParticipants: string[] = Array.isArray(
        convSnap.data().participantIds
      )
        ? convSnap.data().participantIds.map((v: unknown) => String(v))
        : [];
      if (existingParticipants.includes(newMember.uid)) {
        throw new Error(`@${newMember.username} is already in this group.`);
      }

      const now = serverTimestamp();
      const nextParticipants = [...existingParticipants, newMember.uid];

      transaction.update(convRef, {
        participantIds: nextParticipants,
        lastMessageText: systemText.slice(0, 200),
        lastMessageSenderId: actor.uid,
        lastMessageType: 'system',
        lastMessageAt: now,
        updatedAt: now,
      });

      transaction.set(memberRef, {
        id: `${conversation.id}__${newMember.uid}`,
        conversationId: conversation.id,
        userId: newMember.uid,
        username: newMember.username,
        displayName: newMember.displayName,
        avatarUrl: newMember.avatarUrl,
        role: 'member',
        unreadCount: 1,
        lastReadAt: null,
        muted: false,
        archived: false,
        joinedAt: now,
        updatedAt: now,
      });

      transaction.set(sysMsgRef, {
        id: sysMsgRef.id,
        conversationId: conversation.id,
        senderId: actor.uid,
        senderUsername: actor.username,
        senderDisplayName: actor.displayName,
        senderAvatarUrl: actor.avatarUrl,
        messageType: 'system',
        text: systemText,
        replyToMessageId: '',
        replyToPreview: '',
        replyToSenderName: '',
        editedAt: null,
        deletedAt: null,
        createdAt: now,
      });
    });

    emitMessagingNotificationEvent({
      type: 'group_membership_change',
      recipientIds: [newMember.uid],
      actorId: actor.uid,
      conversationId: conversation.id,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('already in') ||
        error.message.includes('not active'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeGroupMember(
  conversation: AtaConversation,
  actor: AtaUserAccount,
  targetMember: AtaConversationMember
): Promise<void> {
  const { uid } = await requireVerifiedMessagingUser();
  if (uid !== actor.uid || !conversation.adminIds.includes(actor.uid)) {
    throw new Error('Only group owners or admins can remove members.');
  }
  if (targetMember.role === 'owner' || targetMember.userId === conversation.ownerId) {
    throw new Error('The group owner cannot be removed.');
  }
  if (
    targetMember.role === 'admin' &&
    conversation.ownerId !== actor.uid
  ) {
    throw new Error('Only the group owner can remove an admin.');
  }

  const systemText = `${actor.displayName} removed @${targetMember.username} from the group.`;
  const path = `conversations/${conversation.id}`;

  try {
    await runTransaction(db, async (transaction) => {
      const convRef = doc(db, 'conversations', conversation.id);
      const memberRef = doc(
        db,
        'conversationMembers',
        `${conversation.id}__${targetMember.userId}`
      );
      const sysMsgRef = doc(
        collection(db, 'conversations', conversation.id, 'messages')
      );

      const convSnap = await transaction.get(convRef);
      if (!convSnap.exists()) {
        throw new Error('Group conversation no longer exists.');
      }

      const existingParticipants: string[] = Array.isArray(
        convSnap.data().participantIds
      )
        ? convSnap.data().participantIds.map((v: unknown) => String(v))
        : [];
      const existingAdmins: string[] = Array.isArray(convSnap.data().adminIds)
        ? convSnap.data().adminIds.map((v: unknown) => String(v))
        : [];

      const now = serverTimestamp();

      transaction.set(sysMsgRef, {
        id: sysMsgRef.id,
        conversationId: conversation.id,
        senderId: actor.uid,
        senderUsername: actor.username,
        senderDisplayName: actor.displayName,
        senderAvatarUrl: actor.avatarUrl,
        messageType: 'system',
        text: systemText,
        replyToMessageId: '',
        replyToPreview: '',
        replyToSenderName: '',
        editedAt: null,
        deletedAt: null,
        createdAt: now,
      });

      transaction.update(convRef, {
        participantIds: existingParticipants.filter(
          (id) => id !== targetMember.userId
        ),
        adminIds: existingAdmins.filter((id) => id !== targetMember.userId),
        lastMessageText: systemText.slice(0, 200),
        lastMessageSenderId: actor.uid,
        lastMessageType: 'system',
        lastMessageAt: now,
        updatedAt: now,
      });

      transaction.delete(memberRef);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function leaveGroupConversation(
  conversation: AtaConversation,
  member: AtaUserAccount
): Promise<void> {
  const { uid } = await requireVerifiedMessagingUser();
  if (uid !== member.uid) {
    throw new Error('Signed-in session mismatch.');
  }
  if (conversation.ownerId === member.uid) {
    throw new Error(
      'As the group owner, archive or delete the group instead of leaving it.'
    );
  }

  const systemText = `${member.displayName} left the group.`;
  const path = `conversations/${conversation.id}`;

  try {
    await runTransaction(db, async (transaction) => {
      const convRef = doc(db, 'conversations', conversation.id);
      const memberRef = doc(
        db,
        'conversationMembers',
        `${conversation.id}__${member.uid}`
      );
      const sysMsgRef = doc(
        collection(db, 'conversations', conversation.id, 'messages')
      );

      const convSnap = await transaction.get(convRef);
      if (!convSnap.exists()) return;

      const existingParticipants: string[] = Array.isArray(
        convSnap.data().participantIds
      )
        ? convSnap.data().participantIds.map((v: unknown) => String(v))
        : [];
      const existingAdmins: string[] = Array.isArray(convSnap.data().adminIds)
        ? convSnap.data().adminIds.map((v: unknown) => String(v))
        : [];

      const now = serverTimestamp();

      // Write system message while user is still a participant before removing UID
      transaction.set(sysMsgRef, {
        id: sysMsgRef.id,
        conversationId: conversation.id,
        senderId: member.uid,
        senderUsername: member.username,
        senderDisplayName: member.displayName,
        senderAvatarUrl: member.avatarUrl,
        messageType: 'system',
        text: systemText,
        replyToMessageId: '',
        replyToPreview: '',
        replyToSenderName: '',
        editedAt: null,
        deletedAt: null,
        createdAt: now,
      });

      transaction.update(convRef, {
        participantIds: existingParticipants.filter((id) => id !== member.uid),
        adminIds: existingAdmins.filter((id) => id !== member.uid),
        lastMessageText: systemText.slice(0, 200),
        lastMessageSenderId: member.uid,
        lastMessageType: 'system',
        lastMessageAt: now,
        updatedAt: now,
      });

      transaction.delete(memberRef);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function setGroupMemberRole(
  conversation: AtaConversation,
  ownerUid: string,
  targetUid: string,
  nextRole: Exclude<ConversationMemberRole, 'owner'>
): Promise<void> {
  const { uid } = await requireVerifiedMessagingUser();
  if (uid !== ownerUid || conversation.ownerId !== ownerUid) {
    throw new Error('Only the group owner can promote or demote admins.');
  }
  if (targetUid === ownerUid) {
    throw new Error('The group owner role cannot be reassigned here.');
  }

  const path = `conversations/${conversation.id}`;
  try {
    await runTransaction(db, async (transaction) => {
      const convRef = doc(db, 'conversations', conversation.id);
      const memberRef = doc(
        db,
        'conversationMembers',
        `${conversation.id}__${targetUid}`
      );
      const [convSnap, memberSnap] = await Promise.all([
        transaction.get(convRef),
        transaction.get(memberRef),
      ]);

      if (!convSnap.exists() || !memberSnap.exists()) {
        throw new Error('Group or member record no longer exists.');
      }

      const currentAdmins: string[] = Array.isArray(convSnap.data().adminIds)
        ? convSnap.data().adminIds.map((v: unknown) => String(v))
        : [];
      const nextAdmins =
        nextRole === 'admin'
          ? Array.from(new Set([...currentAdmins, targetUid]))
          : currentAdmins.filter((id) => id !== targetUid);

      const now = serverTimestamp();
      transaction.update(convRef, {
        adminIds: nextAdmins,
        updatedAt: now,
      });
      transaction.update(memberRef, {
        role: nextRole,
        updatedAt: now,
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function setGroupStatus(
  conversationId: string,
  ownerUid: string,
  status: 'active' | 'archived'
): Promise<void> {
  const { uid } = await requireVerifiedMessagingUser();
  if (uid !== ownerUid) {
    throw new Error('Only the group owner can archive or restore this group.');
  }

  const path = `conversations/${conversationId}`;
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteGroupConversation(
  conversation: AtaConversation,
  ownerUid: string
): Promise<void> {
  const { uid } = await requireVerifiedMessagingUser();
  if (uid !== ownerUid || conversation.ownerId !== ownerUid) {
    throw new Error('Only the group owner can permanently delete this group.');
  }

  const path = `conversations/${conversation.id}`;
  try {
    const membersSnap = await getDocs(
      query(
        collection(db, 'conversationMembers'),
        where('conversationId', '==', conversation.id)
      )
    );

    const batch = writeBatch(db);
    for (const memberDoc of membersSnap.docs) {
      batch.delete(memberDoc.ref);
    }
    batch.delete(doc(db, 'conversations', conversation.id));
    await batch.commit();

    if (conversation.avatarPath && storage) {
      try {
        await deleteObject(ref(storage, conversation.avatarPath));
      } catch {
        // Best-effort storage cleanup
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
