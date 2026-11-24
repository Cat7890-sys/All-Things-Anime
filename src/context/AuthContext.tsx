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

  const loadUserProfile = useCallback(async (user: User) => {
    setIsLoadingProfile(true);
    setProfileError(null);
    try {
      let account = await getOwnAccountProfile(user.uid);
      if (
        account &&
        user.emailVerified &&
        !account.emailVerified &&
        account.accountStatus === 'pending_verification'
      ) {
        await syncEmailVerificationToFirestore(user.uid);
        account = await getOwnAccountProfile(user.uid);
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
      setFirebaseUser(user);
      setIsLoadingAuth(false);

      if (user) {
        void loadUserProfile(user);
      } else {
        setProfile(null);
        setProfileError(null);
        setIsLoadingProfile(false);
      }
    });

    return () => unsubscribe();
  }, [loadUserProfile]);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return;
    await loadUserProfile(auth.currentUser);
  }, [loadUserProfile]);

  const refreshVerification = useCallback(async () => {
    const verified = await refreshAuthVerificationState();
    if (auth.currentUser) {
      setFirebaseUser(auth.currentUser);
      await loadUserProfile(auth.currentUser);
    }
    return verified;
  }, [loadUserProfile]);

  const resendVerification = useCallback(async () => {
    await resendVerificationEmail();
  }, []);

  const logout = useCallback(async () => {
    await logoutAtaAccount();
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
