import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Edit3,
  FileText,
  Lock,
  LogOut,
  MailCheck,
  Quote,
  RefreshCw,
  Save,
  Scale,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AtaLoadingSpinner } from '../components/AtaLoadingSpinner';
import { PostCard } from '../components/social/PostCard';
import { PostDetailModal } from '../components/social/PostDetailModal';
import { PublicProfileModal } from '../components/social/PublicProfileModal';
import { ReportModal } from '../components/social/ReportModal';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../hooks/useAuth';
import {
  fetchOwnDeletionRequests,
  submitAccountDeletionRequest,
} from '../services/moderationService';
import {
  fetchPostsByAuthor,
  getUserLikedPostMap,
  togglePostLike,
} from '../services/postService';
import {
  blockUser,
  fetchBlockedUsers,
  unblockUser,
} from '../services/socialGraphService';
import {
  getPublicProfile,
  updateOwnProfile,
} from '../services/userProfileService';
import { validateProfileEditForm } from '../services/validation';
import type {
  AccountDeletionRequest,
  AtaComment,
  AtaPost,
  AtaPublicProfile,
  AuthViewMode,
  BlockedUserRecord,
  LegalPageSlug,
  UpdatePostInput,
  UpdateProfileInput,
  ValidationErrors,
} from '../types';
import { AuthPage } from './AuthPage';

interface ProfilePageProps {
  initialAuthMode?: AuthViewMode;
  onStartDirectMessage?: (targetUserId: string) => void;
  onNavigatePersonalisation?: () => void;
  onNavigateLegal?: (slug: LegalPageSlug) => void;
  onOpenCopyrightModal?: () => void;
  onOpenFeedbackModal?: () => void;
  onOpenCookiePreferences?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  initialAuthMode = 'login',
  onStartDirectMessage,
  onNavigatePersonalisation,
  onNavigateLegal,
  onOpenCopyrightModal,
  onOpenFeedbackModal,
  onOpenCookiePreferences,
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
    bannerUrl: '',
    favouriteQuote: '',
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

  // Build 03 Social Profile Data
  const [publicSocialProfile, setPublicSocialProfile] =
    useState<AtaPublicProfile | null>(null);
  const [ownPosts, setOwnPosts] = useState<AtaPost[]>([]);
  const [isLoadingOwnPosts, setIsLoadingOwnPosts] = useState(false);
  const [ownPostsError, setOwnPostsError] = useState<string | null>(null);
  const [likedPostMap, setLikedPostMap] = useState<Record<string, boolean>>({});
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserRecord[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [inspectProfileUid, setInspectProfileUid] = useState<string | null>(
    null
  );
  const [reportCommentTarget, setReportCommentTarget] =
    useState<AtaComment | null>(null);

  // Build 08B Privacy & Account Deletion Request State
  const [deletionRequests, setDeletionRequests] = useState<AccountDeletionRequest[]>([]);
  const [deletionReason, setDeletionReason] = useState('');
  const [deletionAcknowledged, setDeletionAcknowledged] = useState(false);
  const [isSubmittingDeletion, setIsSubmittingDeletion] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [deletionSuccessId, setDeletionSuccessId] = useState<string | null>(null);

  const loadSocialProfileData = useCallback(async (uid: string) => {
    setIsLoadingOwnPosts(true);
    setIsLoadingBlocked(true);
    setOwnPostsError(null);
    try {
      const [pubProf, postsRes, blockedList, ownDeletionReqs] = await Promise.all([
        getPublicProfile(uid),
        fetchPostsByAuthor(uid, 15),
        fetchBlockedUsers(uid),
        fetchOwnDeletionRequests(uid),
      ]);
      setPublicSocialProfile(pubProf);
      setOwnPosts(postsRes.posts);
      setBlockedUsers(blockedList);
      setDeletionRequests(ownDeletionReqs);

      if (pubProf) {
        setEditForm((prev) => ({
          ...prev,
          bannerUrl: pubProf.bannerUrl || '',
          favouriteQuote: pubProf.favouriteQuote || '',
        }));
      }

      if (postsRes.posts.length > 0) {
        const likes = await getUserLikedPostMap(
          postsRes.posts.map((p) => p.id),
          uid
        );
        setLikedPostMap(likes);
      }
    } catch (err) {
      setOwnPostsError(
        err instanceof Error
          ? err.message
          : 'Unable to load your social activity.'
      );
    } finally {
      setIsLoadingOwnPosts(false);
      setIsLoadingBlocked(false);
    }
  }, []);

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

    if (firebaseUser) {
      void loadSocialProfileData(firebaseUser.uid);
    }
  }, [profile, firebaseUser, loadSocialProfileData]);

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
    return (
      <AuthPage
        initialMode={initialAuthMode}
        onNavigateLegal={onNavigateLegal}
      />
    );
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

  const handleSubmitDeletionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingDeletion) return;
    setDeletionError(null);
    setDeletionSuccessId(null);
    setIsSubmittingDeletion(true);
    try {
      const id = await submitAccountDeletionRequest({
        username,
        email: profile?.email || firebaseUser.email || '',
        reason: deletionReason,
        acknowledgedIrreversible: deletionAcknowledged,
      });
      setDeletionSuccessId(id);
      setDeletionReason('');
      setDeletionAcknowledged(false);
      const updatedReqs = await fetchOwnDeletionRequests(firebaseUser.uid);
      setDeletionRequests(updatedReqs);
    } catch (err) {
      setDeletionError(
        err instanceof Error
          ? err.message
          : 'Unable to submit account deletion request.'
      );
    } finally {
      setIsSubmittingDeletion(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Account Restriction / Deletion Status Banner */}
      {profile &&
        (profile.accountStatus === 'suspended' ||
          profile.accountStatus === 'banned' ||
          profile.accountStatus === 'deletion_requested') && (
          <section
            role="alert"
            aria-label="Account status notice"
            className="bg-white dark:bg-[#171923] border border-[#EF3038] rounded-2xl p-5 space-y-1.5"
          >
            <div className="flex items-start gap-3">
              <ShieldAlert
                className="h-5 w-5 text-[#EF3038] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="space-y-1 text-xs sm:text-sm">
                <h2 className="font-display-space font-bold text-base text-[#090B14] dark:text-white">
                  {profile.accountStatus === 'banned'
                    ? 'Account Permanently Restricted'
                    : profile.accountStatus === 'suspended'
                      ? 'Account Temporarily Suspended'
                      : 'Account Deletion Request Recorded'}
                </h2>
                <p className="text-[#52576B] dark:text-[#D4D7E2] leading-relaxed">
                  {profile.accountStatus === 'banned'
                    ? profile.banReason || 'Your account has been permanently restricted for violating ATA Terms or Community Guidelines.'
                    : profile.accountStatus === 'suspended'
                      ? profile.suspensionReason || 'Your account is currently suspended pending moderation review.'
                      : 'An account deletion request is recorded against your account and is awaiting administrator processing.'}
                </p>
              </div>
            </div>
          </section>
        )}

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
        {publicSocialProfile?.bannerUrl && (
          <div className="h-32 sm:h-44 w-full overflow-hidden bg-[#090B14]">
            <img
              src={publicSocialProfile.bannerUrl}
              alt={`${displayName}'s profile banner`}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

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
                <div className="mt-2 flex items-center gap-4 text-xs text-[#A7A9B8] tabular-nums">
                  <span>
                    <strong className="font-display-space text-white">
                      {publicSocialProfile?.followersCount ?? 0}
                    </strong>{' '}
                    Followers
                  </span>
                  <span>
                    <strong className="font-display-space text-white">
                      {publicSocialProfile?.followingCount ?? 0}
                    </strong>{' '}
                    Following
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
              {onNavigatePersonalisation && (
                <button
                  type="button"
                  onClick={onNavigatePersonalisation}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[42px] text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-colors whitespace-nowrap"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                  <span>Personalisation</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[42px] text-xs font-semibold text-white bg-[#171923] border border-[#303342] rounded-xl hover:border-[#EF3038] transition-colors whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {publicSocialProfile?.favouriteQuote && (
            <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 flex items-start gap-3">
              <Quote className="h-5 w-5 text-[#EF3038] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8] uppercase tracking-wider">
                  Favourite Anime Quote / Motto
                </p>
                <p className="mt-1 text-sm italic font-medium text-[#090B14] dark:text-white">
                  &ldquo;{publicSocialProfile.favouriteQuote}&rdquo;
                </p>
              </div>
            </div>
          )}

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

          <div>
            <label
              htmlFor="ata-edit-banner-url"
              className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
            >
              Profile Banner Image URL (Optional)
            </label>
            <input
              id="ata-edit-banner-url"
              type="url"
              disabled={!isVerified || isSaving}
              value={editForm.bannerUrl || ''}
              onChange={(e) => {
                setEditForm((prev) => ({ ...prev, bannerUrl: e.target.value }));
              }}
              placeholder="https://example.com/anime-banner.jpg"
              className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3.5 py-2.5 min-h-[44px] text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 disabled:opacity-60 focus:border-[#EF3038] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="ata-edit-quote"
              className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
            >
              Favourite Anime Quote / Motto (Optional)
            </label>
            <input
              id="ata-edit-quote"
              type="text"
              maxLength={140}
              disabled={!isVerified || isSaving}
              value={editForm.favouriteQuote || ''}
              onChange={(e) => {
                setEditForm((prev) => ({
                  ...prev,
                  favouriteQuote: e.target.value,
                }));
              }}
              placeholder="e.g. In the ninja world, those who break the rules are scum..."
              className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3.5 py-2.5 min-h-[44px] text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 disabled:opacity-60 focus:border-[#EF3038] focus:outline-none"
            />
          </div>

          {onNavigatePersonalisation && (
            <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-[#090B14] dark:text-white flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                  <span>Looking for Anime Interests & Theme Colors?</span>
                </p>
                <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                  Select your top genres, favorite characters, accent palette, and feed density in the Personalisation Centre.
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigatePersonalisation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#EF3038] rounded-xl hover:bg-[#B92335] shrink-0 transition-colors"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Open Personalisation</span>
              </button>
            </div>
          )}

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

      {/* My Posts */}
      <section
        aria-labelledby="ata-my-posts-heading"
        className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
            <h2
              id="ata-my-posts-heading"
              className="font-display-space font-bold text-xl text-[#090B14] dark:text-white"
            >
              My Posts ({ownPosts.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void loadSocialProfileData(firebaseUser.uid)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>

        {isLoadingOwnPosts ? (
          <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#52576B] dark:text-[#A7A9B8]">
            <AtaLoadingSpinner size="sm" label="Loading your posts" />
            <span>Loading your posts...</span>
          </div>
        ) : ownPostsError ? (
          <div
            role="alert"
            className="rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3.5 text-xs text-[#090B14] dark:text-white"
          >
            {ownPostsError}
          </div>
        ) : ownPosts.length === 0 ? (
          <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] py-3">
            You haven&apos;t published any posts yet. Head to the Home Feed to
            share your first anime opinion.
          </p>
        ) : (
          <div className="space-y-4">
            {ownPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isLiked={Boolean(likedPostMap[post.id])}
                onToggleLike={async (target) => {
                  const res = await togglePostLike(target.id, firebaseUser.uid);
                  setLikedPostMap((prev) => ({
                    ...prev,
                    [target.id]: res.liked,
                  }));
                  setOwnPosts((prev) =>
                    prev.map((p) =>
                      p.id === target.id ? { ...p, likeCount: res.likeCount } : p
                    )
                  );
                }}
                onOpenDetail={(p) => setDetailPostId(p.id)}
                onOpenAuthorProfile={(uid) => setInspectProfileUid(uid)}
                onPostUpdated={(postId, updated: UpdatePostInput) => {
                  setOwnPosts((prev) =>
                    prev.map((p) =>
                      p.id === postId
                        ? {
                            ...p,
                            content: updated.content.trim(),
                            animeTitle: updated.animeTitle.trim(),
                            hasSpoiler: updated.hasSpoiler,
                            spoilerLabel: updated.hasSpoiler
                              ? updated.spoilerLabel.trim()
                              : '',
                            isEdited: true,
                          }
                        : p
                    )
                  );
                }}
                onPostDeleted={(postId) => {
                  setOwnPosts((prev) => prev.filter((p) => p.id !== postId));
                }}
                onRequestReport={() => {}}
                onBlockAuthor={async () => {}}
              />
            ))}
          </div>
        )}
      </section>

      {/* Blocked Accounts Management */}
      <section
        aria-labelledby="ata-blocked-accounts-heading"
        className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
          <Ban className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
          <h2
            id="ata-blocked-accounts-heading"
            className="font-display-space font-bold text-xl text-[#090B14] dark:text-white"
          >
            Blocked Accounts ({blockedUsers.length})
          </h2>
        </div>

        {isLoadingBlocked ? (
          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
            Loading block list...
          </p>
        ) : blockedUsers.length === 0 ? (
          <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8]">
            You haven&apos;t blocked any accounts. Blocked members&apos; posts
            and comments are hidden from your feed.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {blockedUsers.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-4 py-3"
              >
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-[#090B14] dark:text-white">
                    @{entry.blockedUsername}
                  </p>
                  <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                    Posts and comments hidden
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!isVerified || unblockingId === entry.blockedId}
                  onClick={async () => {
                    setUnblockingId(entry.blockedId);
                    try {
                      await unblockUser(firebaseUser.uid, entry.blockedId);
                      setBlockedUsers((prev) =>
                        prev.filter((b) => b.blockedId !== entry.blockedId)
                      );
                    } finally {
                      setUnblockingId(null);
                    }
                  }}
                  className="px-3.5 py-1.5 min-h-[38px] text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] disabled:opacity-50"
                >
                  {unblockingId === entry.blockedId ? 'Unblocking...' : 'Unblock'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Privacy, Account Deletion & Legal Help */}
      <section
        aria-labelledby="ata-privacy-deletion-heading"
        className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
            <h2
              id="ata-privacy-deletion-heading"
              className="font-display-space font-bold text-xl text-[#090B14] dark:text-white"
            >
              Privacy, Account Deletion &amp; Legal Help
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {onNavigateLegal && (
            <>
              <button
                type="button"
                onClick={() => onNavigateLegal('privacy-policy')}
                className="px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => onNavigateLegal('community-guidelines')}
                className="px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors"
              >
                Community Guidelines
              </button>
            </>
          )}
          {onOpenCookiePreferences && (
            <button
              type="button"
              onClick={onOpenCookiePreferences}
              className="px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors"
            >
              Browser Storage Preferences
            </button>
          )}
          {onOpenCopyrightModal && (
            <button
              type="button"
              onClick={onOpenCopyrightModal}
              className="px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors"
            >
              Copyright Complaint
            </button>
          )}
          {onOpenFeedbackModal && (
            <button
              type="button"
              onClick={onOpenFeedbackModal}
              className="px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors"
            >
              Send Platform Feedback
            </button>
          )}
        </div>

        <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 sm:p-5 space-y-4">
          <div className="flex items-start gap-2.5">
            <Trash2 className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="font-display-space font-bold text-sm text-[#090B14] dark:text-white">
                Request Account &amp; Personal Data Deletion (POPIA / GDPR)
              </h3>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] leading-relaxed">
                Submit a verified request to permanently deactivate and remove your ATA account and personal profile data. Required security/moderation audit trails may be retained briefly where legally permitted.
              </p>
            </div>
          </div>

          {deletionSuccessId && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 p-3 text-xs text-emerald-800 dark:text-emerald-200"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Deletion request recorded (Ref: {deletionSuccessId}). An ATA compliance administrator will process your request.
              </span>
            </div>
          )}

          {deletionError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3 text-xs text-[#090B14] dark:text-white"
            >
              <AlertCircle className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5" aria-hidden="true" />
              <span>{deletionError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitDeletionRequest} className="space-y-3">
            <div>
              <label
                htmlFor="ata-deletion-reason"
                className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1"
              >
                Optional Reason (max 500 characters)
              </label>
              <textarea
                id="ata-deletion-reason"
                rows={2}
                maxLength={500}
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                placeholder="Let us know why you are leaving or any privacy notes..."
                className="w-full resize-none rounded-xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] p-3 text-xs text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none"
              />
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={deletionAcknowledged}
                onChange={(e) => setDeletionAcknowledged(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#EF3038] shrink-0"
              />
              <span className="text-[#090B14] dark:text-[#D4D7E2] leading-relaxed">
                I understand that account deletion is permanent and irreversible once completed by an administrator.
              </span>
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingDeletion}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] rounded-xl text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] hover:bg-[#B92335] disabled:opacity-60 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {isSubmittingDeletion ? 'Submitting Request...' : 'Submit Deletion Request'}
                </span>
              </button>
            </div>
          </form>

          {deletionRequests.length > 0 && (
            <div className="pt-3 border-t border-[#D4D7E2] dark:border-[#303342] space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8]">
                Your Deletion Requests
              </p>
              <ul className="space-y-1.5 text-xs">
                {deletionRequests.map((reqItem) => (
                  <li
                    key={reqItem.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2"
                  >
                    <span className="font-mono text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                      Ref {reqItem.id}
                    </span>
                    <span className="font-semibold capitalize text-[#090B14] dark:text-white">
                      {reqItem.status.replace('_', ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <PostDetailModal
        post={ownPosts.find((p) => p.id === detailPostId) || null}
        isLiked={
          detailPostId ? Boolean(likedPostMap[detailPostId]) : false
        }
        blockedUserIds={new Set(blockedUsers.map((b) => b.blockedId))}
        onClose={() => setDetailPostId(null)}
        onToggleLike={async (target) => {
          const res = await togglePostLike(target.id, firebaseUser.uid);
          setLikedPostMap((prev) => ({
            ...prev,
            [target.id]: res.liked,
          }));
          setOwnPosts((prev) =>
            prev.map((p) =>
              p.id === target.id ? { ...p, likeCount: res.likeCount } : p
            )
          );
        }}
        onOpenAuthorProfile={(uid) => setInspectProfileUid(uid)}
        onPostUpdated={(postId, updated) => {
          setOwnPosts((prev) =>
            prev.map((p) =>
              p.id === postId
                ? {
                    ...p,
                    content: updated.content.trim(),
                    animeTitle: updated.animeTitle.trim(),
                    hasSpoiler: updated.hasSpoiler,
                    spoilerLabel: updated.hasSpoiler
                      ? updated.spoilerLabel.trim()
                      : '',
                    isEdited: true,
                  }
                : p
            )
          );
        }}
        onPostDeleted={(postId) => {
          setOwnPosts((prev) => prev.filter((p) => p.id !== postId));
        }}
        onRequestReportPost={() => {}}
        onRequestReportComment={(c) => setReportCommentTarget(c)}
        onBlockAuthor={async (authorId, authorUsername) => {
          await blockUser(firebaseUser.uid, authorId, authorUsername);
          void loadSocialProfileData(firebaseUser.uid);
        }}
        onCommentCountSync={(postId, count) => {
          setOwnPosts((prev) =>
            prev.map((p) =>
              p.id === postId ? { ...p, commentCount: count } : p
            )
          );
        }}
      />

      <PublicProfileModal
        targetUserId={inspectProfileUid}
        onClose={() => setInspectProfileUid(null)}
        onFollowStateChanged={() => {
          void loadSocialProfileData(firebaseUser.uid);
        }}
        onBlockStateChanged={() => {
          void loadSocialProfileData(firebaseUser.uid);
        }}
        onStartDirectMessage={onStartDirectMessage}
      />

      {reportCommentTarget && (
        <ReportModal
          isOpen
          targetType="comment"
          targetId={reportCommentTarget.id}
          postId={reportCommentTarget.postId}
          targetAuthorId={reportCommentTarget.authorId}
          targetAuthorUsername={reportCommentTarget.authorUsername}
          reporterId={firebaseUser.uid}
          onClose={() => setReportCommentTarget(null)}
        />
      )}
    </div>
  );
};
