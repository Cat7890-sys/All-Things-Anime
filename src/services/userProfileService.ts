import { updateProfile } from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import type {
  AtaPublicProfile,
  AtaUserAccount,
  UpdateProfileInput,
} from '../types';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { validateProfileEditForm } from './validation';

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return null;
}

export async function getOwnAccountProfile(
  uid: string
): Promise<AtaUserAccount | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid: String(data.uid),
      username: String(data.username),
      usernameLowercase: String(data.usernameLowercase),
      displayName: String(data.displayName),
      email: String(data.email),
      bio: typeof data.bio === 'string' ? data.bio : '',
      avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
      emailVerified: Boolean(data.emailVerified),
      accountStatus:
        data.accountStatus === 'active' ? 'active' : 'pending_verification',
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getPublicProfile(
  uid: string
): Promise<AtaPublicProfile | null> {
  const path = `publicProfiles/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'publicProfiles', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid: String(data.uid),
      username: String(data.username),
      usernameLowercase: String(data.usernameLowercase),
      displayName: String(data.displayName),
      bio: typeof data.bio === 'string' ? data.bio : '',
      avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function syncEmailVerificationToFirestore(
  uid: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid || !currentUser.emailVerified) {
    return;
  }

  // Ensure fresh ID token claim email_verified == true before Firestore write
  await currentUser.getIdToken(true);

  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      emailVerified: true,
      accountStatus: 'active',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateOwnProfile(
  uid: string,
  input: UpdateProfileInput
): Promise<AtaUserAccount | null> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    throw new Error('You must be signed in to update your profile.');
  }
  if (!currentUser.emailVerified) {
    throw new Error(
      'Please verify your email address before editing your profile.'
    );
  }

  const validationErrors = validateProfileEditForm(input);
  const firstError = Object.values(validationErrors)[0];
  if (firstError) {
    throw new Error(firstError);
  }

  const trimmedDisplayName = input.displayName.trim();
  const trimmedBio = input.bio.trim();
  const trimmedAvatarUrl = input.avatarUrl.trim();

  await currentUser.getIdToken(true);

  const userPath = `users/${uid}`;
  try {
    const existingSnap = await getDoc(doc(db, 'users', uid));
    if (!existingSnap.exists()) {
      throw new Error('Account profile document does not exist.');
    }

    // Perform verification activation action separately if needed before profile edit
    if (existingSnap.data().emailVerified !== true) {
      await syncEmailVerificationToFirestore(uid);
    }

    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', uid);
      const publicRef = doc(db, 'publicProfiles', uid);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('Account profile document does not exist.');
      }

      const now = serverTimestamp();

      transaction.update(userRef, {
        displayName: trimmedDisplayName,
        bio: trimmedBio,
        avatarUrl: trimmedAvatarUrl,
        updatedAt: now,
      });

      transaction.update(publicRef, {
        displayName: trimmedDisplayName,
        bio: trimmedBio,
        avatarUrl: trimmedAvatarUrl,
        updatedAt: now,
      });
    });

    await updateProfile(currentUser, {
      displayName: trimmedDisplayName,
    });

    return await getOwnAccountProfile(uid);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes('permission')
    ) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
    throw error;
  }
}
