import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import type { LoginAccountInput, RegisterAccountInput } from '../types';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  normalizeEmail,
  normalizeUsername,
  validateEmail,
  validateLoginForm,
  validateRegistrationForm,
} from './validation';

export function mapAuthErrorToMessage(error: unknown): string {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email address or password.';
    case 'auth/weak-password':
      return 'Password does not meet security requirements (minimum 8 characters with uppercase, lowercase, and a number).';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error while contacting ATA authentication services. Please check your connection.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in the Firebase Console yet. Please enable it under Authentication > Sign-in method.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    default:
      if (error instanceof Error) {
        if (error.message.includes('USERNAME_TAKEN')) {
          return 'That username is already claimed. Please choose a different handle.';
        }
        return error.message;
      }
      return 'Authentication could not be completed. Please try again.';
  }
}

export async function checkUsernameAvailability(
  username: string
): Promise<boolean> {
  const normalized = normalizeUsername(username);
  const path = `usernames/${normalized}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', normalized));
    return !snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export interface RegisterResult {
  user: User;
  verificationEmailSent: boolean;
}

export async function registerAtaAccount(
  input: RegisterAccountInput
): Promise<RegisterResult> {
  const validationErrors = validateRegistrationForm(input);
  const firstError = Object.values(validationErrors)[0];
  if (firstError) {
    throw new Error(firstError);
  }

  const normalizedEmail = normalizeEmail(input.email);
  const trimmedUsername = input.username.trim();
  const usernameLowercase = normalizeUsername(trimmedUsername);
  const trimmedDisplayName = input.displayName.trim();

  // Pre-check username availability before creating Auth credentials
  const isAvailable = await checkUsernameAvailability(trimmedUsername);
  if (!isAvailable) {
    throw new Error('That username is already claimed. Please choose another.');
  }

  const credential = await createUserWithEmailAndPassword(
    auth,
    normalizedEmail,
    input.password
  );
  const createdUser = credential.user;

  try {
    await updateProfile(createdUser, {
      displayName: trimmedDisplayName,
    });

    await runTransaction(db, async (transaction) => {
      const usernameRef = doc(db, 'usernames', usernameLowercase);
      const userRef = doc(db, 'users', createdUser.uid);
      const publicProfileRef = doc(db, 'publicProfiles', createdUser.uid);

      const usernameSnap = await transaction.get(usernameRef);
      if (usernameSnap.exists()) {
        throw new Error('USERNAME_TAKEN');
      }

      const now = serverTimestamp();

      transaction.set(usernameRef, {
        uid: createdUser.uid,
        username: trimmedUsername,
        createdAt: now,
      });

      transaction.set(userRef, {
        uid: createdUser.uid,
        username: trimmedUsername,
        usernameLowercase,
        displayName: trimmedDisplayName,
        email: normalizedEmail,
        bio: '',
        avatarUrl: '',
        emailVerified: false,
        accountStatus: 'pending_verification',
        createdAt: now,
        updatedAt: now,
      });

      transaction.set(publicProfileRef, {
        uid: createdUser.uid,
        username: trimmedUsername,
        usernameLowercase,
        displayName: trimmedDisplayName,
        bio: '',
        avatarUrl: '',
        createdAt: now,
        updatedAt: now,
      });
    });
  } catch (error) {
    // Roll back orphaned Firebase Auth user if Firestore atomic reservation fails
    try {
      await deleteUser(createdUser);
    } catch {
      // Ignore rollback cleanup failure if session already invalidated
    }
    if (error instanceof Error && error.message === 'USERNAME_TAKEN') {
      throw new Error('That username is already claimed. Please choose another.');
    }
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes('permission')
    ) {
      handleFirestoreError(error, OperationType.WRITE, `users/${createdUser.uid}`);
    }
    throw error;
  }

  let verificationEmailSent = false;
  try {
    await sendEmailVerification(createdUser);
    verificationEmailSent = true;
  } catch {
    verificationEmailSent = false;
  }

  return { user: createdUser, verificationEmailSent };
}

export async function loginAtaAccount(input: LoginAccountInput): Promise<User> {
  const validationErrors = validateLoginForm(input);
  const firstError = Object.values(validationErrors)[0];
  if (firstError) {
    throw new Error(firstError);
  }

  await setPersistence(
    auth,
    input.rememberSession ? browserLocalPersistence : browserSessionPersistence
  );

  const credential = await signInWithEmailAndPassword(
    auth,
    normalizeEmail(input.email),
    input.password
  );
  return credential.user;
}

export async function logoutAtaAccount(): Promise<void> {
  await signOut(auth);
}

export async function resendVerificationEmail(): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('You must be signed in to send a verification email.');
  }
  await sendEmailVerification(auth.currentUser);
}

export async function refreshAuthVerificationState(): Promise<boolean> {
  if (!auth.currentUser) return false;
  await reload(auth.currentUser);
  await auth.currentUser.getIdToken(true);
  return auth.currentUser.emailVerified;
}

/**
 * Never reveals whether an arbitrary email address has an ATA account.
 */
export async function requestPasswordResetNeutral(email: string): Promise<void> {
  const emailErr = validateEmail(email);
  if (emailErr) {
    throw new Error(emailErr);
  }

  try {
    await sendPasswordResetEmail(auth, normalizeEmail(email));
  } catch (error) {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : '';

    // Suppress user-not-found so password reset never leaks account existence
    if (code === 'auth/user-not-found') {
      return;
    }
    throw new Error(mapAuthErrorToMessage(error));
  }
}
