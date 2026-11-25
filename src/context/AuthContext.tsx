import React, { createContext, useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { AtaUserAccount } from '../types';
import {
  logoutAtaAccount,
  refreshAuthVerificationState,
  resendVerificationEmail,
} from '../services/authService';
import { auth, isFirebaseConfigured } from '../services/firebase';
import {
  clearUserScopedCache,
} from '../services/memoryCache';
import {
  clearUserSharedSubscriptions,
} from '../services/sharedSubscriptionManager';
import {
  getOwnAccountProfile,
  syncEmailVerificationToFirestore,
} from '../services/userProfileService';

export interface AuthContextValue {
  firebaseUser: User | null;
  profile: AtaUserAccount | null;
  isLoadingAuth: boolean;
  isLoadingProfile: boolean;
  profileError: string | null;
  isFirebaseConfigured: boolean;
  refreshProfile: () => Promise<void>;
  refreshVerification: () => Promise<boolean>;
  resendVerification: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AtaUserAccount | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const previousUidRef = React.useRef<string | null>(null);

  const loadUserProfile = useCallback(async (user: User, forceRefresh = false) => {
    setIsLoadingProfile(true);
    setProfileError(null);
    try {
      let account = await getOwnAccountProfile(user.uid, forceRefresh);
      if (
        account &&
        user.emailVerified &&
        !account.emailVerified &&
        account.accountStatus === 'pending_verification'
      ) {
        await syncEmailVerificationToFirestore(user.uid);
        account = await getOwnAccountProfile(user.uid, true);
      }
      setProfile(account);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load your ATA profile right now.';
      setProfileError(message);
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setIsLoadingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const prevUid = previousUidRef.current;
      const nextUid = user?.uid ?? null;
      if (prevUid && prevUid !== nextUid) {
        clearUserSharedSubscriptions(prevUid);
        clearUserScopedCache(prevUid);
      }
      previousUidRef.current = nextUid;

      setFirebaseUser(user);
      setIsLoadingAuth(false);

      if (user) {
        void loadUserProfile(user);
      } else {
        clearUserScopedCache();
        setProfile(null);
        setProfileError(null);
        setIsLoadingProfile(false);
      }
    });

    return () => unsubscribe();
  }, [loadUserProfile]);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return;
    await loadUserProfile(auth.currentUser, true);
  }, [loadUserProfile]);

  const refreshVerification = useCallback(async () => {
    const verified = await refreshAuthVerificationState();
    if (auth.currentUser) {
      setFirebaseUser(auth.currentUser);
      await loadUserProfile(auth.currentUser, true);
    }
    return verified;
  }, [loadUserProfile]);

  const resendVerification = useCallback(async () => {
    await resendVerificationEmail();
  }, []);

  const logout = useCallback(async () => {
    const activeUid = auth.currentUser?.uid || previousUidRef.current;
    await logoutAtaAccount();
    if (activeUid) {
      clearUserSharedSubscriptions(activeUid);
      clearUserScopedCache(activeUid);
    } else {
      clearUserScopedCache();
    }
    previousUidRef.current = null;
    setProfile(null);
    setProfileError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        isLoadingAuth,
        isLoadingProfile,
        profileError,
        isFirebaseConfigured,
        refreshProfile,
        refreshVerification,
        resendVerification,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
