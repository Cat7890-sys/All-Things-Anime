import { updateProfile } from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type {
  AnimeActivitySummary,
  AtaPublicProfile,
  AtaUserAccount,
  UpdateProfileInput,
} from '../types';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  storage,
} from './firebase';
import {
  validateAccentColor,
  validateFavouriteQuote,
  validateOptionalHttpsUrl,
  validatePostImageFile,
  validatePreferenceStringList,
  validateProfileEditForm,
} from './validation';

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return null;
}

function sanitizeProfileFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.slice(0, 80) || 'profile-image.jpg';
}

function mapActivitySummary(raw: unknown): AnimeActivitySummary | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  return {
    totalTracked: typeof obj.totalTracked === 'number' ? obj.totalTracked : 0,
    totalCompleted:
      typeof obj.totalCompleted === 'number' ? obj.totalCompleted : 0,
    totalWatching: typeof obj.totalWatching === 'number' ? obj.totalWatching : 0,
    totalEpisodesWatched:
      typeof obj.totalEpisodesWatched === 'number'
        ? obj.totalEpisodesWatched
        : 0,
    favouriteGenres: Array.isArray(obj.favouriteGenres)
      ? (obj.favouriteGenres as unknown[])
          .filter((g): g is string => typeof g === 'string')
          .slice(0, 10)
      : [],
  };
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
      bannerUrl: typeof data.bannerUrl === 'string' ? data.bannerUrl : '',
      accentColor:
        typeof data.accentColor === 'string' ? data.accentColor : 'red',
      favouriteQuote:
        typeof data.favouriteQuote === 'string' ? data.favouriteQuote : '',
      favouriteAnimeTitles: Array.isArray(data.favouriteAnimeTitles)
        ? (data.favouriteAnimeTitles as string[])
        : [],
      favouriteCharacters: Array.isArray(data.favouriteCharacters)
        ? (data.favouriteCharacters as string[])
        : [],
      favouriteGenres: Array.isArray(data.favouriteGenres)
        ? (data.favouriteGenres as string[])
        : [],
      showAnimeActivity: Boolean(data.showAnimeActivity),
      animeActivitySummary: mapActivitySummary(data.animeActivitySummary),
      followersCount:
        typeof data.followersCount === 'number' ? data.followersCount : 0,
      followingCount:
        typeof data.followingCount === 'number' ? data.followingCount : 0,
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

export async function uploadProfileImage(
  uid: string,
  kind: 'avatar' | 'banner',
  file: File
): Promise<{ url: string; path: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    throw new Error('You must be signed in to upload profile media.');
  }
  if (!currentUser.emailVerified) {
    throw new Error(
      'Please verify your email address before uploading profile images.'
    );
  }

  const imgErr = validatePostImageFile(file);
  if (imgErr) {
    throw new Error(imgErr);
  }

  await currentUser.getIdToken(true);

  if (!storage) {
    throw new Error('Firebase Storage is not configured.');
  }

  const safeName = sanitizeProfileFilename(file.name);
  const storagePath = `users/${uid}/profile/${kind}_${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      ownerId: uid,
      kind,
    },
  });

  const url = await getDownloadURL(storageRef);
  return { url, path: storagePath };
}

export interface UpdatePublicProfileShowcaseInput {
  avatarUrl?: string;
  bannerUrl?: string;
  accentColor?: string;
  favouriteQuote?: string;
  favouriteAnimeTitles?: string[];
  favouriteCharacters?: string[];
  favouriteGenres?: string[];
  showAnimeActivity?: boolean;
  animeActivitySummary?: AnimeActivitySummary;
  bio?: string;
  displayName?: string;
}

export async function updatePublicProfileShowcase(
  uid: string,
  input: UpdatePublicProfileShowcaseInput
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    throw new Error('You must be signed in to update your profile.');
  }
  if (!currentUser.emailVerified) {
    throw new Error(
      'Please verify your email address before updating your public profile.'
    );
  }

  if (input.bannerUrl !== undefined) {
    const err = validateOptionalHttpsUrl(input.bannerUrl, 1000, 'Banner URL');
    if (err) throw new Error(err);
  }
  if (input.avatarUrl !== undefined) {
    const err = validateOptionalHttpsUrl(input.avatarUrl, 500, 'Avatar URL');
    if (err) throw new Error(err);
  }
  if (input.favouriteQuote !== undefined) {
    const err = validateFavouriteQuote(input.favouriteQuote);
    if (err) throw new Error(err);
  }
  if (input.accentColor !== undefined) {
    const err = validateAccentColor(input.accentColor);
    if (err) throw new Error(err);
  }
  if (input.favouriteAnimeTitles !== undefined) {
    const err = validatePreferenceStringList(
      input.favouriteAnimeTitles,
      10,
      120,
      'Favourite anime'
    );
    if (err) throw new Error(err);
  }
  if (input.favouriteGenres !== undefined) {
    const err = validatePreferenceStringList(
      input.favouriteGenres,
      15,
      60,
      'Favourite genres'
    );
    if (err) throw new Error(err);
  }

  await currentUser.getIdToken(true);

  const path = `publicProfiles/${uid}`;
  try {
    const publicUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    const userUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    let shouldUpdateUserDoc = false;

    if (input.displayName !== undefined) {
      publicUpdate.displayName = input.displayName.trim();
      userUpdate.displayName = input.displayName.trim();
      shouldUpdateUserDoc = true;
    }
    if (input.bio !== undefined) {
      publicUpdate.bio = input.bio.trim();
      userUpdate.bio = input.bio.trim();
      shouldUpdateUserDoc = true;
    }
    if (input.avatarUrl !== undefined) {
      publicUpdate.avatarUrl = input.avatarUrl.trim();
      userUpdate.avatarUrl = input.avatarUrl.trim();
      shouldUpdateUserDoc = true;
    }
    if (input.bannerUrl !== undefined) {
      publicUpdate.bannerUrl = input.bannerUrl.trim();
    }
    if (input.accentColor !== undefined) {
      publicUpdate.accentColor = input.accentColor;
    }
    if (input.favouriteQuote !== undefined) {
      publicUpdate.favouriteQuote = input.favouriteQuote.trim();
    }
    if (Array.isArray(input.favouriteAnimeTitles)) {
      publicUpdate.favouriteAnimeTitles = input.favouriteAnimeTitles.slice(0, 10);
    }
    if (Array.isArray(input.favouriteCharacters)) {
      publicUpdate.favouriteCharacters = input.favouriteCharacters.slice(0, 10);
    }
    if (Array.isArray(input.favouriteGenres)) {
      publicUpdate.favouriteGenres = input.favouriteGenres.slice(0, 15);
    }
    if (typeof input.showAnimeActivity === 'boolean') {
      publicUpdate.showAnimeActivity = input.showAnimeActivity;
    }
    if (input.animeActivitySummary !== undefined) {
      publicUpdate.animeActivitySummary = {
        totalTracked: Math.max(0, Math.round(input.animeActivitySummary.totalTracked || 0)),
        totalCompleted: Math.max(0, Math.round(input.animeActivitySummary.totalCompleted || 0)),
        totalWatching: Math.max(0, Math.round(input.animeActivitySummary.totalWatching || 0)),
        totalEpisodesWatched: Math.max(
          0,
          Math.round(input.animeActivitySummary.totalEpisodesWatched || 0)
        ),
        favouriteGenres: (input.animeActivitySummary.favouriteGenres || []).slice(0, 6),
      };
    }

    await runTransaction(db, async (transaction) => {
      const publicRef = doc(db, 'publicProfiles', uid);
      const userRef = doc(db, 'users', uid);
      const publicSnap = await transaction.get(publicRef);
      if (!publicSnap.exists()) {
        throw new Error('Public profile document does not exist.');
      }
      transaction.update(publicRef, publicUpdate);
      if (shouldUpdateUserDoc) {
        transaction.update(userRef, userUpdate);
      }
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes('permission')
    ) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    throw error;
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
      const baseUpdate: Record<string, unknown> = {
        displayName: trimmedDisplayName,
        bio: trimmedBio,
        avatarUrl: trimmedAvatarUrl,
        updatedAt: now,
      };

      const publicUpdate: Record<string, unknown> = {
        ...baseUpdate,
      };

      if (input.bannerUrl !== undefined) {
        publicUpdate.bannerUrl = input.bannerUrl.trim();
      }
      if (input.accentColor !== undefined) {
        publicUpdate.accentColor = input.accentColor;
      }
      if (input.favouriteQuote !== undefined) {
        publicUpdate.favouriteQuote = input.favouriteQuote.trim();
      }
      if (Array.isArray(input.favouriteAnimeTitles)) {
        publicUpdate.favouriteAnimeTitles = input.favouriteAnimeTitles.slice(0, 10);
      }
      if (Array.isArray(input.favouriteCharacters)) {
        publicUpdate.favouriteCharacters = input.favouriteCharacters.slice(0, 10);
      }
      if (Array.isArray(input.favouriteGenres)) {
        publicUpdate.favouriteGenres = input.favouriteGenres.slice(0, 15);
      }
      if (typeof input.showAnimeActivity === 'boolean') {
        publicUpdate.showAnimeActivity = input.showAnimeActivity;
      }
      if (input.animeActivitySummary !== undefined) {
        publicUpdate.animeActivitySummary = input.animeActivitySummary;
      }

      transaction.update(userRef, baseUpdate);
      transaction.update(publicRef, publicUpdate);
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
