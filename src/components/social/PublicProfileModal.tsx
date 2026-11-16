import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Check,
  Film,
  ShieldAlert,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchPostsByAuthor } from '../../services/postService';
import {
  blockUser,
  checkBlockBetween,
  checkFollowStatus,
  followUser,
  unblockUser,
  unfollowUser,
} from '../../services/socialGraphService';
import { getPublicProfile } from '../../services/userProfileService';
import type { AtaPost, AtaPublicProfile, AuthViewMode } from '../../types';
import { formatRelativeTimestamp } from '../../utils/time';
import { AtaLoadingSpinner } from '../AtaLoadingSpinner';
import { UserAvatar } from '../UserAvatar';
import { SpoilerGate } from './SpoilerGate';

interface PublicProfileModalProps {
  targetUserId: string | null;
  onClose: () => void;
  onFollowStateChanged?: (targetUserId: string, isFollowing: boolean) => void;
  onBlockStateChanged?: (targetUserId: string, isBlocked: boolean) => void;
  onOpenAuth?: (mode: AuthViewMode) => void;
  onOpenPostDetail?: (post: AtaPost) => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  targetUserId,
  onClose,
  onFollowStateChanged,
  onBlockStateChanged,
  onOpenAuth,
  onOpenPostDetail,
}) => {
  const { firebaseUser } = useAuth();

  const [publicProfile, setPublicProfile] = useState<AtaPublicProfile | null>(
    null
  );
  const [recentPosts, setRecentPosts] = useState<AtaPost[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedByThem, setBlockedByThem] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [isTogglingBlock, setIsTogglingBlock] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetUserId) return;

    let active = true;
    setIsLoading(true);
    setError(null);
    setConfirmBlock(false);

    async function loadProfileView(uid: string) {
      try {
        const [prof, postsResult] = await Promise.all([
          getPublicProfile(uid),
          fetchPostsByAuthor(uid, 10),
        ]);

        if (!active) return;

        setPublicProfile(prof);
        setRecentPosts(postsResult.posts);

        if (firebaseUser && firebaseUser.uid !== uid) {
          const [followingStatus, blockStatus] = await Promise.all([
            checkFollowStatus(firebaseUser.uid, uid),
            checkBlockBetween(firebaseUser.uid, uid),
          ]);
          if (!active) return;
          setIsFollowing(followingStatus);
          setBlockedByMe(blockStatus.blockedByMe);
          setBlockedByThem(blockStatus.blockedByThem);
        } else {
          setIsFollowing(false);
          setBlockedByMe(false);
          setBlockedByThem(false);
        }
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load member profile.'
        );
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadProfileView(targetUserId);

    return () => {
      active = false;
    };
  }, [targetUserId, firebaseUser]);

  if (!targetUserId) return null;

  const isSelf = Boolean(firebaseUser && firebaseUser.uid === targetUserId);
  const isVerified = Boolean(firebaseUser?.emailVerified);

  const handleToggleFollow = async () => {
    if (!publicProfile) return;
    setError(null);

    if (!firebaseUser) {
      onClose();
      onOpenAuth?.('login');
      return;
    }
    if (!isVerified) {
      setError('Please verify your email address before following members.');
      return;
    }
    if (blockedByMe || blockedByThem || isTogglingFollow) return;

    setIsTogglingFollow(true);
    try {
      if (isFollowing) {
        await unfollowUser(firebaseUser.uid, publicProfile.uid);
        setIsFollowing(false);
        setPublicProfile((prev) =>
          prev
            ? {
                ...prev,
                followersCount: Math.max(0, prev.followersCount - 1),
              }
            : prev
        );
        onFollowStateChanged?.(publicProfile.uid, false);
      } else {
        await followUser(firebaseUser.uid, publicProfile.uid);
        setIsFollowing(true);
        setPublicProfile((prev) =>
          prev ? { ...prev, followersCount: prev.followersCount + 1 } : prev
        );
        onFollowStateChanged?.(publicProfile.uid, true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update follow status.'
      );
    } finally {
      setIsTogglingFollow(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!publicProfile || !firebaseUser || !isVerified || isTogglingBlock) {
      return;
    }
    setError(null);
    setIsTogglingBlock(true);
    try {
      if (blockedByMe) {
        await unblockUser(firebaseUser.uid, publicProfile.uid);
        setBlockedByMe(false);
        onBlockStateChanged?.(publicProfile.uid, false);
      } else {
        await blockUser(
          firebaseUser.uid,
          publicProfile.uid,
          publicProfile.username
        );
        setBlockedByMe(true);
        if (isFollowing) {
          setIsFollowing(false);
          setPublicProfile((prev) =>
            prev
              ? {
                  ...prev,
                  followersCount: Math.max(0, prev.followersCount - 1),
                }
              : prev
          );
          onFollowStateChanged?.(publicProfile.uid, false);
        }
        setConfirmBlock(false);
        onBlockStateChanged?.(publicProfile.uid, true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update block status.'
      );
    } finally {
      setIsTogglingBlock(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ata-public-profile-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#090B14] px-5 py-5 border-b border-[#303342] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] text-[#EF3038] uppercase">
              ATA Member Profile
            </p>
            <h2
              id="ata-public-profile-title"
              className="mt-1 font-display-space font-bold text-xl text-white truncate"
            >
              {publicProfile ? publicProfile.displayName : 'Member Profile'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close member profile"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#303342] bg-[#171923] text-white hover:border-[#EF3038] transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {isLoading ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3">
              <AtaLoadingSpinner size="md" label="Loading member profile" />
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Loading profile &amp; recent posts...
              </p>
            </div>
          ) : error && !publicProfile ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-4 text-xs text-[#090B14] dark:text-white"
            >
              <AlertCircle
                className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          ) : !publicProfile ? (
            <p className="text-sm text-[#52576B] dark:text-[#A7A9B8] py-6 text-center">
              This member profile could not be found.
            </p>
          ) : (
            <>
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3 text-xs text-[#090B14] dark:text-white"
                >
                  <AlertCircle
                    className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{error}</span>
                </div>
              )}

              {/* Identity & Follow/Block Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <UserAvatar
                    displayName={publicProfile.displayName}
                    avatarUrl={publicProfile.avatarUrl}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="font-display-space font-bold text-lg text-[#090B14] dark:text-white truncate">
                      {publicProfile.displayName}
                    </p>
                    <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] truncate">
                      @{publicProfile.username}
                      {publicProfile.createdAt
                        ? ` · Joined ${publicProfile.createdAt.toLocaleDateString(
                            undefined,
                            { month: 'short', year: 'numeric' }
                          )}`
                        : ''}
                    </p>
                    <div className="mt-1.5 flex items-center gap-4 text-xs tabular-nums">
                      <span>
                        <strong className="font-display-space text-[#090B14] dark:text-white">
                          {publicProfile.followersCount}
                        </strong>{' '}
                        <span className="text-[#52576B] dark:text-[#A7A9B8]">
                          Followers
                        </span>
                      </span>
                      <span>
                        <strong className="font-display-space text-[#090B14] dark:text-white">
                          {publicProfile.followingCount}
                        </strong>{' '}
                        <span className="text-[#52576B] dark:text-[#A7A9B8]">
                          Following
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {!isSelf && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={
                        isTogglingFollow || blockedByMe || blockedByThem
                      }
                      onClick={handleToggleFollow}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap disabled:opacity-50 ${
                        isFollowing
                          ? 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]'
                          : 'bg-[#EF3038] text-white border-[#B92335] hover:bg-[#B92335]'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck
                            className="h-3.5 w-3.5 text-[#EF3038]"
                            aria-hidden="true"
                          />
                          <span>
                            {isTogglingFollow ? 'Updating...' : 'Following'}
                          </span>
                        </>
                      ) : (
                        <>
                          <UserPlus
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          <span>
                            {isTogglingFollow ? 'Updating...' : 'Follow'}
                          </span>
                        </>
                      )}
                    </button>

                    {isVerified &&
                      (blockedByMe ? (
                        <button
                          type="button"
                          disabled={isTogglingBlock}
                          onClick={handleToggleBlock}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] transition-colors"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>
                            {isTogglingBlock ? 'Updating...' : 'Unblock'}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmBlock((prev) => !prev)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8] bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] hover:text-[#EF3038] transition-colors"
                        >
                          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Block</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {confirmBlock && (
                <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#EF3038] p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[#090B14] dark:text-white">
                    Block @{publicProfile.username}? Their posts and comments
                    will be hidden and you will unfollow them.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmBlock(false)}
                      className="px-3 py-1.5 min-h-[36px] text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isTogglingBlock}
                      onClick={handleToggleBlock}
                      className="px-3 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-lg hover:bg-[#B92335] disabled:opacity-60"
                    >
                      {isTogglingBlock ? 'Blocking...' : 'Confirm Block'}
                    </button>
                  </div>
                </div>
              )}

              {/* Bio */}
              <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8]">
                  Bio
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[#090B14] dark:text-white/90">
                  {publicProfile.bio
                    ? publicProfile.bio
                    : 'No public bio shared yet.'}
                </p>
              </div>

              {/* Recent Posts or Block Notice */}
              <div className="space-y-3">
                <h3 className="font-display-space font-bold text-base text-[#090B14] dark:text-white border-b border-[#D4D7E2] dark:border-[#303342] pb-2">
                  Recent Posts
                </h3>

                {blockedByMe || blockedByThem ? (
                  <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 flex items-start gap-2.5 text-xs text-[#52576B] dark:text-[#A7A9B8]">
                    <ShieldAlert
                      className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>
                      {blockedByMe
                        ? `You have blocked @${publicProfile.username}. Unblock this account to view their posts again.`
                        : `Interactions with @${publicProfile.username} are unavailable because of an active account block.`}
                    </span>
                  </div>
                ) : recentPosts.length === 0 ? (
                  <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] py-3">
                    @{publicProfile.username} hasn&apos;t published any posts
                    yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recentPosts.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8]/60 dark:bg-[#090B14]/70 p-3.5 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                          <span>
                            {formatRelativeTimestamp(item.createdAt)}
                            {item.isEdited ? ' · Edited' : ''}
                          </span>
                          {item.animeTitle && (
                            <span className="inline-flex items-center gap-1 font-semibold text-[#B92335] dark:text-[#EF3038]">
                              <Film className="h-3 w-3" aria-hidden="true" />
                              <span>{item.animeTitle}</span>
                            </span>
                          )}
                        </div>

                        <SpoilerGate
                          hasSpoiler={item.hasSpoiler}
                          spoilerLabel={item.spoilerLabel}
                          compact
                        >
                          <p className="text-xs sm:text-sm leading-relaxed text-[#090B14] dark:text-white/95 line-clamp-4 whitespace-pre-wrap break-words">
                            {item.content}
                          </p>
                        </SpoilerGate>

                        <div className="flex items-center justify-between pt-1 text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                          <span>
                            {item.likeCount} likes · {item.commentCount}{' '}
                            comments
                          </span>
                          {onOpenPostDetail && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenPostDetail(item);
                              }}
                              className="font-semibold text-[#B92335] dark:text-[#EF3038] hover:underline"
                            >
                              View Thread
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
