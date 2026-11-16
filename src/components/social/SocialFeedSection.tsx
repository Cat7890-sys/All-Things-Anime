import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  AlertCircle,
  Compass,
  Flame,
  RefreshCw,
  Users,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  fetchFollowingPosts,
  fetchMoreCommunityPosts,
  getUserLikedPostMap,
  subscribeToCommunityPosts,
  togglePostLike,
} from '../../services/postService';
import {
  blockUser,
  fetchBlockedUsers,
  fetchFollowingIds,
} from '../../services/socialGraphService';
import type {
  AtaComment,
  AtaPost,
  AuthViewMode,
  FeedTabMode,
  ReportTargetType,
  UpdatePostInput,
} from '../../types';
import { AtaLoadingSpinner } from '../AtaLoadingSpinner';
import { PostCard } from './PostCard';
import { PostComposer } from './PostComposer';
import { PostDetailModal } from './PostDetailModal';
import { PublicProfileModal } from './PublicProfileModal';
import { ReportModal } from './ReportModal';

interface SocialFeedSectionProps {
  onOpenAuth?: (mode: AuthViewMode) => void;
  onNavigateProfile?: () => void;
}

interface ReportModalState {
  targetType: ReportTargetType;
  targetId: string;
  postId: string;
  targetAuthorId: string;
  targetAuthorUsername: string;
}

const PAGE_SIZE = 10;

export const SocialFeedSection: React.FC<SocialFeedSectionProps> = ({
  onOpenAuth,
  onNavigateProfile,
}) => {
  const { firebaseUser } = useAuth();
  const { isOnline } = useOnlineStatus();

  const [activeTab, setActiveTab] = useState<FeedTabMode>('community');

  // Community Feed State
  const [communityPosts, setCommunityPosts] = useState<AtaPost[]>([]);
  const [extraCommunityPosts, setExtraCommunityPosts] = useState<AtaPost[]>([]);
  const [communityCursor, setCommunityCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [communityHasMore, setCommunityHasMore] = useState(false);
  const [isLoadingCommunity, setIsLoadingCommunity] = useState(true);
  const [isLoadingMoreCommunity, setIsLoadingMoreCommunity] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);

  // Following Feed State
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followingPosts, setFollowingPosts] = useState<AtaPost[]>([]);
  const [followingCursor, setFollowingCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [followingHasMore, setFollowingHasMore] = useState(false);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
  const [isLoadingMoreFollowing, setIsLoadingMoreFollowing] = useState(false);
  const [followingError, setFollowingError] = useState<string | null>(null);

  // Social Graph & Reactions
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [likedPostMap, setLikedPostMap] = useState<Record<string, boolean>>({});

  // Modals
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportModalState | null>(
    null
  );

  // Load blocked list and following IDs when user session changes
  const refreshSocialGraph = useCallback(async () => {
    if (!firebaseUser) {
      setBlockedUserIds(new Set());
      setFollowingIds([]);
      setLikedPostMap({});
      return;
    }

    try {
      const [blockedList, followed] = await Promise.all([
        fetchBlockedUsers(firebaseUser.uid),
        fetchFollowingIds(firebaseUser.uid),
      ]);
      setBlockedUserIds(new Set(blockedList.map((b) => b.blockedId)));
      setFollowingIds(followed);
    } catch {
      // Non-fatal fallback; community feed still operates cleanly
    }
  }, [firebaseUser]);

  useEffect(() => {
    void refreshSocialGraph();
  }, [refreshSocialGraph]);

  // Subscribe to Community Feed
  useEffect(() => {
    setIsLoadingCommunity(true);
    setCommunityError(null);

    const unsubscribe = subscribeToCommunityPosts(
      PAGE_SIZE,
      (result) => {
        setCommunityPosts(result.posts);
        setCommunityCursor(result.lastCursor);
        setCommunityHasMore(result.hasMore);
        setIsLoadingCommunity(false);
      },
      (errMsg) => {
        setCommunityError(errMsg);
        setIsLoadingCommunity(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Load Following Feed when tab selected or followingIds change
  const loadFollowingFeed = useCallback(async () => {
    if (!firebaseUser || followingIds.length === 0) {
      setFollowingPosts([]);
      setFollowingCursor(null);
      setFollowingHasMore(false);
      return;
    }

    setIsLoadingFollowing(true);
    setFollowingError(null);
    try {
      const res = await fetchFollowingPosts(followingIds, PAGE_SIZE, null);
      setFollowingPosts(res.posts);
      setFollowingCursor(res.lastCursor);
      setFollowingHasMore(res.hasMore);
    } catch (err) {
      setFollowingError(
        err instanceof Error
          ? err.message
          : 'Unable to load posts from followed members.'
      );
    } finally {
      setIsLoadingFollowing(false);
    }
  }, [firebaseUser, followingIds]);

  useEffect(() => {
    if (activeTab === 'following') {
      void loadFollowingFeed();
    }
  }, [activeTab, loadFollowingFeed]);

  // Merge community head + paginated tail without duplicates and hide blocked users
  const mergedCommunityPosts = useMemo(() => {
    const seen = new Set<string>();
    const combined: AtaPost[] = [];
    for (const p of [...communityPosts, ...extraCommunityPosts]) {
      if (!seen.has(p.id) && !blockedUserIds.has(p.authorId)) {
        seen.add(p.id);
        combined.push(p);
      }
    }
    return combined;
  }, [communityPosts, extraCommunityPosts, blockedUserIds]);

  const visibleFollowingPosts = useMemo(() => {
    return followingPosts.filter((p) => !blockedUserIds.has(p.authorId));
  }, [followingPosts, blockedUserIds]);

  // Hydrate liked state for displayed posts
  useEffect(() => {
    if (!firebaseUser) return;
    const allIds = Array.from(
      new Set([
        ...mergedCommunityPosts.map((p) => p.id),
        ...visibleFollowingPosts.map((p) => p.id),
      ])
    );
    const missing = allIds.filter((id) => !(id in likedPostMap));
    if (missing.length === 0) return;

    let active = true;
    void getUserLikedPostMap(missing, firebaseUser.uid).then((map) => {
      if (!active) return;
      setLikedPostMap((prev) => ({ ...prev, ...map }));
    });

    return () => {
      active = false;
    };
  }, [firebaseUser, mergedCommunityPosts, visibleFollowingPosts, likedPostMap]);

  const handleLoadMoreCommunity = async () => {
    if (!communityCursor || isLoadingMoreCommunity) return;
    setIsLoadingMoreCommunity(true);
    try {
      const next = await fetchMoreCommunityPosts(communityCursor, PAGE_SIZE);
      setExtraCommunityPosts((prev) => [...prev, ...next.posts]);
      setCommunityCursor(next.lastCursor);
      setCommunityHasMore(next.hasMore);
    } catch (err) {
      setCommunityError(
        err instanceof Error ? err.message : 'Unable to load older posts.'
      );
    } finally {
      setIsLoadingMoreCommunity(false);
    }
  };

  const handleLoadMoreFollowing = async () => {
    if (!followingCursor || isLoadingMoreFollowing || followingIds.length === 0)
      return;
    setIsLoadingMoreFollowing(true);
    try {
      const next = await fetchFollowingPosts(
        followingIds,
        PAGE_SIZE,
        followingCursor
      );
      setFollowingPosts((prev) => [...prev, ...next.posts]);
      setFollowingCursor(next.lastCursor);
      setFollowingHasMore(next.hasMore);
    } catch (err) {
      setFollowingError(
        err instanceof Error ? err.message : 'Unable to load older posts.'
      );
    } finally {
      setIsLoadingMoreFollowing(false);
    }
  };

  const handleToggleLike = async (post: AtaPost) => {
    if (!firebaseUser) return;
    const result = await togglePostLike(post.id, firebaseUser.uid);
    setLikedPostMap((prev) => ({ ...prev, [post.id]: result.liked }));

    const applyCount = (list: AtaPost[]) =>
      list.map((p) =>
        p.id === post.id ? { ...p, likeCount: result.likeCount } : p
      );
    setCommunityPosts(applyCount);
    setExtraCommunityPosts(applyCount);
    setFollowingPosts(applyCount);
  };

  const handlePostUpdated = (postId: string, updated: UpdatePostInput) => {
    const applyUpdate = (list: AtaPost[]) =>
      list.map((p) =>
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
      );
    setCommunityPosts(applyUpdate);
    setExtraCommunityPosts(applyUpdate);
    setFollowingPosts(applyUpdate);
  };

  const handlePostDeleted = (postId: string) => {
    const remove = (list: AtaPost[]) => list.filter((p) => p.id !== postId);
    setCommunityPosts(remove);
    setExtraCommunityPosts(remove);
    setFollowingPosts(remove);
  };

  const handleCommentCountSync = (postId: string, totalCount: number) => {
    const applyCount = (list: AtaPost[]) =>
      list.map((p) =>
        p.id === postId ? { ...p, commentCount: totalCount } : p
      );
    setCommunityPosts(applyCount);
    setExtraCommunityPosts(applyCount);
    setFollowingPosts(applyCount);
  };

  const handleBlockAuthor = async (
    authorId: string,
    authorUsername: string
  ) => {
    if (!firebaseUser) return;
    await blockUser(firebaseUser.uid, authorId, authorUsername);
    setBlockedUserIds((prev) => {
      const next = new Set(prev);
      next.add(authorId);
      return next;
    });
    setFollowingIds((prev) => prev.filter((id) => id !== authorId));
  };

  const activeDetailPost = useMemo(() => {
    if (!detailPostId) return null;
    return (
      [...mergedCommunityPosts, ...visibleFollowingPosts].find(
        (p) => p.id === detailPostId
      ) || null
    );
  }, [detailPostId, mergedCommunityPosts, visibleFollowingPosts]);

  const displayedPosts =
    activeTab === 'community' ? mergedCommunityPosts : visibleFollowingPosts;

  return (
    <div id="social-feed" className="space-y-6">
      <PostComposer
        onPostCreated={(newPost) => {
          setCommunityPosts((prev) => {
            if (prev.some((p) => p.id === newPost.id)) return prev;
            return [newPost, ...prev];
          });
        }}
        onOpenAuth={onOpenAuth}
        onNavigateProfile={onNavigateProfile}
      />

      {/* Real Firestore Social Feed */}
      <section aria-labelledby="ata-social-feed-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
          <div>
            <p className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] text-[#B92335] dark:text-[#EF3038] uppercase">
              Live Community Stream <span aria-hidden="true">·</span> Firestore
            </p>
            <h2
              id="ata-social-feed-heading"
              className="font-display-space font-bold text-2xl sm:text-3xl text-[#090B14] dark:text-white mt-1"
            >
              {activeTab === 'community' ? 'Community Feed' : 'Following Feed'}
            </h2>
          </div>

          <div
            className="flex items-center gap-1.5"
            role="tablist"
            aria-label="Feed view selector"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'community'}
              onClick={() => setActiveTab('community')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-xl border transition-colors ${
                activeTab === 'community'
                  ? 'bg-[#EF3038] text-white border-[#B92335]'
                  : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]/60'
              }`}
            >
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Community</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'following'}
              onClick={() => setActiveTab('following')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-xl border transition-colors ${
                activeTab === 'following'
                  ? 'bg-[#EF3038] text-white border-[#B92335]'
                  : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]/60'
              }`}
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Following</span>
            </button>
          </div>
        </div>

        {/* Feed States */}
        {activeTab === 'following' && !firebaseUser ? (
          <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-6 text-center space-y-3">
            <p className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
              Sign In to View Your Following Feed
            </p>
            <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
              Follow anime fans across ATA to see their latest reviews,
              theories, and episode reactions in a focused timeline.
            </p>
            <button
              type="button"
              onClick={() => onOpenAuth?.('login')}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335]"
            >
              <span>Sign In</span>
            </button>
          </div>
        ) : activeTab === 'following' && followingIds.length === 0 ? (
          <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-6 text-center space-y-3">
            <Compass
              className="h-6 w-6 text-[#EF3038] mx-auto"
              aria-hidden="true"
            />
            <p className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
              You Aren&apos;t Following Anyone Yet
            </p>
            <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
              Click any member&apos;s name on the Community Feed to view their
              public profile and follow them.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('community')}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038]"
            >
              <span>Browse Community Feed</span>
            </button>
          </div>
        ) : (activeTab === 'community' && isLoadingCommunity) ||
          (activeTab === 'following' && isLoadingFollowing) ? (
          <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-10 flex flex-col items-center justify-center gap-3">
            <AtaLoadingSpinner size="md" label="Loading social feed" />
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Loading live ATA posts...
            </p>
          </div>
        ) : (activeTab === 'community' && communityError) ||
          (activeTab === 'following' && followingError) ? (
          <div
            role="alert"
            className="bg-white dark:bg-[#171923] border border-[#EF3038] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 text-xs sm:text-sm text-[#090B14] dark:text-white">
              <AlertCircle
                className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>
                {activeTab === 'community' ? communityError : followingError}
              </span>
            </div>
            {activeTab === 'following' && (
              <button
                type="button"
                onClick={() => void loadFollowingFeed()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#EF3038] rounded-xl"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Retry</span>
              </button>
            )}
          </div>
        ) : !isOnline && displayedPosts.length === 0 ? (
          <div className="bg-white dark:bg-[#171923] border border-[#EF3038]/70 rounded-2xl p-8 text-center space-y-2.5">
            <WifiOff
              className="h-6 w-6 text-[#EF3038] mx-auto"
              aria-hidden="true"
            />
            <p className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
              You&apos;re Offline
            </p>
            <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
              Live community and following streams require an active internet
              connection. Reconnect to browse posts, like, comment, or publish.
            </p>
          </div>
        ) : displayedPosts.length === 0 ? (
          <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-8 text-center space-y-2">
            <p className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
              {activeTab === 'community'
                ? 'No Community Posts Yet'
                : 'No Posts From Followed Members Yet'}
            </p>
            <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
              {activeTab === 'community'
                ? 'Be the first verified member to share an anime opinion, scene breakdown, or recommendation above.'
                : 'Members you follow have not published posts yet. Check back soon or browse the Community Feed.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isLiked={Boolean(likedPostMap[post.id])}
                onToggleLike={handleToggleLike}
                onOpenDetail={(p) => setDetailPostId(p.id)}
                onOpenAuthorProfile={(uid) => setProfileUserId(uid)}
                onPostUpdated={handlePostUpdated}
                onPostDeleted={handlePostDeleted}
                onRequestReport={(p) =>
                  setReportTarget({
                    targetType: 'post',
                    targetId: p.id,
                    postId: p.id,
                    targetAuthorId: p.authorId,
                    targetAuthorUsername: p.authorUsername,
                  })
                }
                onBlockAuthor={handleBlockAuthor}
                onOpenAuth={onOpenAuth}
              />
            ))}

            {activeTab === 'community' && communityHasMore && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  disabled={isLoadingMoreCommunity}
                  onClick={handleLoadMoreCommunity}
                  className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] disabled:opacity-60 transition-colors"
                >
                  <span>
                    {isLoadingMoreCommunity
                      ? 'Loading More...'
                      : 'Load More Community Posts'}
                  </span>
                </button>
              </div>
            )}

            {activeTab === 'following' && followingHasMore && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  disabled={isLoadingMoreFollowing}
                  onClick={handleLoadMoreFollowing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] disabled:opacity-60 transition-colors"
                >
                  <span>
                    {isLoadingMoreFollowing
                      ? 'Loading More...'
                      : 'Load More Following Posts'}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Post Detail & Comments Modal */}
      <PostDetailModal
        post={activeDetailPost}
        isLiked={
          activeDetailPost ? Boolean(likedPostMap[activeDetailPost.id]) : false
        }
        blockedUserIds={blockedUserIds}
        onClose={() => setDetailPostId(null)}
        onToggleLike={handleToggleLike}
        onOpenAuthorProfile={(uid) => setProfileUserId(uid)}
        onPostUpdated={handlePostUpdated}
        onPostDeleted={handlePostDeleted}
        onRequestReportPost={(p) =>
          setReportTarget({
            targetType: 'post',
            targetId: p.id,
            postId: p.id,
            targetAuthorId: p.authorId,
            targetAuthorUsername: p.authorUsername,
          })
        }
        onRequestReportComment={(c: AtaComment) =>
          setReportTarget({
            targetType: 'comment',
            targetId: c.id,
            postId: c.postId,
            targetAuthorId: c.authorId,
            targetAuthorUsername: c.authorUsername,
          })
        }
        onBlockAuthor={handleBlockAuthor}
        onCommentCountSync={handleCommentCountSync}
        onOpenAuth={onOpenAuth}
      />

      {/* Public Member Profile Modal */}
      <PublicProfileModal
        targetUserId={profileUserId}
        onClose={() => setProfileUserId(null)}
        onFollowStateChanged={(uid, nowFollowing) => {
          setFollowingIds((prev) =>
            nowFollowing
              ? prev.includes(uid)
                ? prev
                : [...prev, uid]
              : prev.filter((id) => id !== uid)
          );
        }}
        onBlockStateChanged={(uid, nowBlocked) => {
          setBlockedUserIds((prev) => {
            const next = new Set(prev);
            if (nowBlocked) {
              next.add(uid);
            } else {
              next.delete(uid);
            }
            return next;
          });
          if (nowBlocked) {
            setFollowingIds((prev) => prev.filter((id) => id !== uid));
          }
        }}
        onOpenAuth={onOpenAuth}
        onOpenPostDetail={(clickedPost) => {
          setCommunityPosts((prev) =>
            prev.some((p) => p.id === clickedPost.id)
              ? prev
              : [clickedPost, ...prev]
          );
          setDetailPostId(clickedPost.id);
        }}
      />

      {/* Moderation Report Modal */}
      {reportTarget && firebaseUser && (
        <ReportModal
          isOpen
          targetType={reportTarget.targetType}
          targetId={reportTarget.targetId}
          postId={reportTarget.postId}
          targetAuthorId={reportTarget.targetAuthorId}
          targetAuthorUsername={reportTarget.targetAuthorUsername}
          reporterId={firebaseUser.uid}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
};
