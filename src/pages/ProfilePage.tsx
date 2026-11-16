import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Lock,
  LogOut,
  MailCheck,
  RefreshCw,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { AtaLoadingSpinner } from '../components/AtaLoadingSpinner';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../hooks/useAuth';
import { updateOwnProfile } from '../services/userProfileService';
import { validateProfileEditForm } from '../services/validation';
import type {
  AuthViewMode,
  UpdateProfileInput,
  ValidationErrors,
} from '../types';
import { AuthPage } from './AuthPage';

interface ProfilePageProps {
  initialAuthMode?: AuthViewMode;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  initialAuthMode = 'login',
}) => {
  const {
    firebaseUser,
    profile,
    isLoadingAuth,
    isLoadingProfile,
    profileError,
    refreshProfile,
    refreshVerification,
    resendVerification,
    logout,
  } = useAuth();

  const [editForm, setEditForm] = useState<UpdateProfileInput>({
    displayName: '',
    bio: '',
    avatarUrl: '',
  });
  const [fieldErrors, setFieldErrors] = useState<
    ValidationErrors<UpdateProfileInput>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [verificationNotice, setVerificationNotice] = useState<string | null>(
    null
  );
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditForm({
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
      });
    } else if (firebaseUser) {
      setEditForm({
        displayName: firebaseUser.displayName || '',
        bio: '',
        avatarUrl: '',
      });
    }
  }, [profile, firebaseUser]);

  if (isLoadingAuth) {
    return (
      <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-10 flex flex-col items-center justify-center gap-3">
        <AtaLoadingSpinner size="lg" label="Checking ATA session" />
        <p className="text-sm text-[#52576B] dark:text-[#A7A9B8]">
          Verifying your ATA session...
        </p>
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthPage initialMode={initialAuthMode} />;
  }

  if (isLoadingProfile && !profile) {
    return (
      <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-10 flex flex-col items-center justify-center gap-3">
        <AtaLoadingSpinner size="lg" label="Loading ATA profile" />
        <p className="text-sm text-[#52576B] dark:text-[#A7A9B8]">
          Loading your ATA profile...
        </p>
      </div>
    );
  }

  if (profileError && !profile) {
    return (
      <section className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="h-5 w-5 text-[#EF3038] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <h1 className="font-display-space font-bold text-xl text-[#090B14] dark:text-white">
              Could Not Load Profile
            </h1>
            <p className="mt-1 text-sm text-[#52576B] dark:text-[#A7A9B8]">
              {profileError}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void refreshProfile()}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Retry</span>
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] transition-colors"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </section>
    );
  }

  const isVerified = firebaseUser.emailVerified;
  const displayName =
    profile?.displayName || firebaseUser.displayName || 'ATA Member';
  const username = profile?.username || 'pending_handle';
  const memberSince = profile?.createdAt
    ? profile.createdAt.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Just joined';

  const handleRefreshVerification = async () => {
    setIsCheckingVerification(true);
    setVerificationNotice(null);
    try {
      const verified = await refreshVerification();
      setVerificationNotice(
        verified
          ? 'Email verified! Your ATA account is now active for profile editing.'
          : 'Your email is not verified yet. Please open the verification link sent to your inbox, then check again.'
      );
    } catch (error) {
      setVerificationNotice(
        error instanceof Error
          ? error.message
          : 'Could not refresh verification status.'
      );
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const handleResendVerification = async () => {
    setIsResendingEmail(true);
    setVerificationNotice(null);
    try {
      await resendVerification();
      setVerificationNotice(
        `Verification email re-sent to ${firebaseUser.email}. Check your inbox and spam folder.`
      );
    } catch (error) {
      setVerificationNotice(
        error instanceof Error
          ? error.message
          : 'Unable to resend verification email right now. Please wait a moment.'
      );
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !isVerified) return;

    setSaveMessage(null);
    setSaveError(null);

    const errors = validateProfileEditForm(editForm);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      await updateOwnProfile(firebaseUser.uid, editForm);
      await refreshProfile();
      setSaveMessage('Your ATA profile has been updated.');
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Unable to save profile changes.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Unverified Email Gate Banner */}
      {!isVerified && (
        <section
          aria-label="Email verification required"
          className="bg-white dark:bg-[#171923] border border-[#EF3038] rounded-2xl p-5 sm:p-6 space-y-3"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert
              className="h-5 w-5 text-[#EF3038] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
                Email Verification Pending
              </h2>
              <p className="text-xs sm:text-sm leading-relaxed text-[#52576B] dark:text-[#A7A9B8]">
                We sent a verification link to{' '}
                <span className="font-semibold text-[#090B14] dark:text-white">
                  {firebaseUser.email}
                </span>
                . Unverified accounts are restricted from editing profile
                details until verified.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={isCheckingVerification}
              onClick={handleRefreshVerification}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-60 transition-colors"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  isCheckingVerification ? 'animate-spin' : ''
                }`}
                aria-hidden="true"
              />
              <span>I&apos;ve Verified — Refresh Status</span>
            </button>

            <button
              type="button"
              disabled={isResendingEmail}
              onClick={handleResendVerification}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] disabled:opacity-60 transition-colors"
            >
              <MailCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {isResendingEmail ? 'Sending...' : 'Resend Verification Email'}
              </span>
            </button>
          </div>

          {verificationNotice && (
            <p
              role="status"
              className="text-xs text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl p-3"
            >
              {verificationNotice}
            </p>
          )}
        </section>
      )}

      {/* Member Identity Card */}
      <section
        aria-labelledby="ata-profile-heading"
        className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl overflow-hidden shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.45)]"
      >
        <div className="bg-[#090B14] px-6 py-7 border-b border-[#303342] cosmic-backdrop-grid">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <UserAvatar
                displayName={displayName}
                avatarUrl={profile?.avatarUrl}
                size="lg"
              />
              <div>
                <p className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] text-[#EF3038] uppercase">
                  {isVerified ? 'Verified ATA Member' : 'Pending Verification'}
                </p>
                <h1
                  id="ata-profile-heading"
                  className="mt-1 font-display-space font-bold text-2xl sm:text-3xl text-white"
                >
                  {displayName}
                </h1>
                <p className="text-sm text-[#A7A9B8]">
                  @{username} <span aria-hidden="true">·</span> Joined{' '}
                  {memberSince}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center justify-center gap-2 self-start sm:self-center px-4 py-2 min-h-[42px] text-xs font-semibold text-white bg-[#171923] border border-[#303342] rounded-xl hover:border-[#EF3038] transition-colors whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8]">
              Bio
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#090B14] dark:text-white/90">
              {profile?.bio
                ? profile.bio
                : 'No bio added yet. Introduce your favourite genres or anime perspectives below once verified.'}
            </p>
          </div>

          <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#090B14] dark:text-white">
                Private Account Email (Owner-Only)
              </p>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] mt-0.5">
                {profile?.email || firebaseUser.email}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#52576B] dark:text-[#A7A9B8]">
              <Lock className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
              <span>Never shown on public profiles</span>
            </span>
          </div>
        </div>
      </section>

      {/* Owner-Only Profile Editor */}
      <section
        aria-labelledby="ata-profile-edit-heading"
        className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
          <div className="flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
            <h2
              id="ata-profile-edit-heading"
              className="font-display-space font-bold text-xl text-[#090B14] dark:text-white"
            >
              Edit Profile
            </h2>
          </div>
          <span className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
            Handle @{username} is permanent
          </span>
        </div>

        {!isVerified && (
          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5">
            Profile editing unlocks automatically once you verify your email
            address above.
          </p>
        )}

        {saveMessage && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/50 p-3.5 text-xs font-medium text-emerald-800 dark:text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{saveMessage}</span>
          </div>
        )}

        {saveError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3.5 text-xs text-[#090B14] dark:text-white"
          >
            <AlertCircle
              className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span>{saveError}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="ata-edit-display-name"
              className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
            >
              Display Name
            </label>
            <input
              id="ata-edit-display-name"
              type="text"
              disabled={!isVerified || isSaving}
              value={editForm.displayName}
              onChange={(e) => {
                setEditForm((prev) => ({
                  ...prev,
                  displayName: e.target.value,
                }));
                if (fieldErrors.displayName) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    displayName: undefined,
                  }));
                }
              }}
              className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3.5 py-2.5 min-h-[44px] text-sm text-[#090B14] dark:text-white disabled:opacity-60 focus:border-[#EF3038] focus:outline-none"
            />
            {fieldErrors.displayName && (
              <p className="mt-1.5 text-xs text-[#B92335] dark:text-[#EF3038]">
                {fieldErrors.displayName}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="ata-edit-bio"
                className="block text-xs font-semibold text-[#090B14] dark:text-white"
              >
                Bio
              </label>
              <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                {editForm.bio.trim().length}/280
              </span>
            </div>
            <textarea
              id="ata-edit-bio"
              rows={3}
              disabled={!isVerified || isSaving}
              value={editForm.bio}
              onChange={(e) => {
                setEditForm((prev) => ({ ...prev, bio: e.target.value }));
                if (fieldErrors.bio) {
                  setFieldErrors((prev) => ({ ...prev, bio: undefined }));
                }
              }}
              placeholder="Share your favourite anime genres, eras, or directors..."
              className="w-full resize-none rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 disabled:opacity-60 focus:border-[#EF3038] focus:outline-none"
            />
            {fieldErrors.bio && (
              <p className="mt-1.5 text-xs text-[#B92335] dark:text-[#EF3038]">
                {fieldErrors.bio}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="ata-edit-avatar-url"
              className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
            >
              Custom Avatar Image URL (Optional)
            </label>
            <input
              id="ata-edit-avatar-url"
              type="url"
              disabled={!isVerified || isSaving}
              value={editForm.avatarUrl}
              onChange={(e) => {
                setEditForm((prev) => ({ ...prev, avatarUrl: e.target.value }));
                if (fieldErrors.avatarUrl) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    avatarUrl: undefined,
                  }));
                }
              }}
              placeholder="Leave blank to use your default ATA cosmic avatar"
              className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3.5 py-2.5 min-h-[44px] text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 disabled:opacity-60 focus:border-[#EF3038] focus:outline-none"
            />
            {fieldErrors.avatarUrl && (
              <p className="mt-1.5 text-xs text-[#B92335] dark:text-[#EF3038]">
                {fieldErrors.avatarUrl}
              </p>
            )}
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="submit"
              disabled={!isVerified || isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>{isSaving ? 'Saving Profile...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
