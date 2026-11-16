import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  BookOpen,
  Clock,
  Flag,
  Globe,
  Lock,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  approveJoinRequest,
  cancelJoinRequest,
  deleteCommunity,
  fetchCommunityById,
  fetchCommunityMembers,
  fetchMyCommunityMembership,
  fetchMyJoinRequest,
  fetchPendingJoinRequests,
  joinPublicCommunity,
  leaveCommunity,
  rejectJoinRequest,
  removeCommunityMember,
  requestPrivateMembership,
  setMemberRole,
  updateCommunityOwnerSettings,
} from '../../services/communityService';
import {
  fetchMoreCommunityPosts,
  getUserLikedPostMap,
  subscribeToCommunityPosts,
  togglePostLike,
} from '../../services/postService';
import {
  blockUser,
  fetchBlockedUsers,
} from '../../services/socialGraphService';
import {
  JOIN_REQUEST_MESSAGE_MAX,
  validateJoinRequestMessage,
} from '../../services/validation';
import type {
  AtaComment,
  AtaCommunity,
  AtaPost,
  AuthViewMode,
  CommunityJoinRequest,
  CommunityMembership,
  ReportTargetType,
  UpdatePostInput,
} from '../../types';
import { AtaLoadingSpinner } from '../AtaLoadingSpinner';
import { PostCard } from '../social/PostCard';
import { PostComposer } from '../social/PostComposer';
import { PostDetailModal } from '../social/PostDetailModal';
import { PublicProfileModal } from '../social/PublicProfileModal';
import { ReportModal } from '../social/ReportModal';
import { CommunityAvatarBadge } from './CommunityCard';
import { CommunityFormModal } from './CommunityFormModal';
import { CommunityManageTab } from './CommunityManageTab';
import { CommunityMembersTab } from './CommunityMembersTab';

interface CommunityDetailViewProps {
  community: AtaCommunity;
  onBack: () => void;
  onCommunityUpdated: (updated: AtaCommunity) => void;
  onCommunityDeleted: (communityId: string) => void;
  onMembershipChanged: () => void;
  onOpenAuth?: (mode: AuthViewMode) => void;
  onNavigateProfile?: () => void;
}

type CommunityDetailTab = 'discussions' | 'rules' | 'members' | 'manage';

interface ReportModalState {
  targetType: ReportTargetType;
  targetId: string;
  postId: string;
  communityId?: string;
  targetAuthorId: string;
  targetAuthorUsername: string;
}

const PAGE_SIZE = 10;

export const CommunityDetailView: React.FC<CommunityDetailViewProps> = ({
  community: initialCommunity,
  onBack,
  onCommunityUpdated,
  onCommunityDeleted,
  onMembershipChanged,
  onOpenAuth,
  onNavigateProfile,
}) => {
  const { firebaseUser, profile } = useAuth();
  const { isOnline } = useOnlineStatus();

  const [community, setCommunity] = useState<AtaCommunity>(initialCommunity);
  const [activeTab, setActiveTab] = useState<CommunityDetailTab>('discussions');
  const [coverError, setCoverError] = useState(false);

  // Membership & Request State
  const [myMembership, setMyMembership] = useState<CommunityMembership | null>(
    null
  );
  const [myJoinRequest, setMyJoinRequest] =
    useState<CommunityJoinRequest | null>(null);
  const [isLoadingAccess, setIsLoadingAccess] = useState(true);
  const [isMembershipBusy, setIsMembershipBusy] = useState(false);
  const [showRequestNoteBox, setShowRequestNoteBox] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Discussion Feed State
  const [posts, setPosts] = useState<AtaPost[]>([]);
  const [extraPosts, setExtraPosts] = useState<AtaPost[]>([]);
  const [cursor, setCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [likedPostMap, setLikedPostMap] = useState<Record<string, boolean>>({});
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

  // Members & Requests State
  const [members, setMembers] = useState<CommunityMembership[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState<
    CommunityJoinRequest[]
  >([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  // Modals
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportModalState | null>(
    null
  );
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    setCommunity(initialCommunity);
    setCoverError(false);
    setActiveTab('discussions');
    setPosts([]);
    setExtraPosts([]);
    setCursor(null);
    setHasMorePosts(false);
    setLikedPostMap({});
    setBannerError(null);
    setConfirmLeave(false);
    setShowRequestNoteBox(false);
    setRequestNote('');
  }, [initialCommunity.id]);

  // Refresh community record, membership & join request status
  const refreshAccessAndMeta = useCallback(async () => {
    setIsLoadingAccess(true);
    try {
      const fresh = await fetchCommunityById(community.id);
      if (fresh) {
        setCommunity(fresh);
        onCommunityUpdated(fresh);
      }

      if (firebaseUser) {
        const [mem, req, blockedList] = await Promise.all([
          fetchMyCommunityMembership(community.id, firebaseUser.uid),
          fetchMyJoinRequest(community.id, firebaseUser.uid),
          fetchBlockedUsers(firebaseUser.uid),
        ]);
        setMyMembership(mem);
        setMyJoinRequest(req);
        setBlockedUserIds(new Set(blockedList.map((b) => b.blockedId)));
      } else {
        setMyMembership(null);
        setMyJoinRequest(null);
        setBlockedUserIds(new Set());
      }
    } catch {
      // Fall back to existing community metadata cleanly
    } finally {
      setIsLoadingAccess(false);
    }
  }, [community.id, firebaseUser]);

  useEffect(() => {
    void refreshAccessAndMeta();
  }, [refreshAccessAndMeta]);

  const isOwner = Boolean(
    firebaseUser &&
      (firebaseUser.uid === community.ownerId ||
        myMembership?.role === 'owner')
  );
  const isModerator = Boolean(
    isOwner ||
      myMembership?.role === 'moderator' ||
      (firebaseUser && community.moderatorIds.includes(firebaseUser.uid))
  );
  const isMember = Boolean(myMembership);
  const canReadContent =
    community.status === 'active' &&
    (community.visibility === 'public' || isMember);
  const canReadArchivedAsMember =
    community.status === 'archived' && (isOwner || isMember);
  const isArchivedLockedForOutsiders =
    community.status === 'archived' && !canReadArchivedAsMember;

  // Subscribe to Community Posts ONLY when permitted
  useEffect(() => {
    if (isLoadingAccess) return;
    if (!canReadContent) {
      setPosts([]);
      setExtraPosts([]);
      setCursor(null);
      setHasMorePosts(false);
      setIsLoadingPosts(false);
      setPostsError(null);
      return;
    }

    setIsLoadingPosts(true);
    setPostsError(null);

    const unsubscribe = subscribeToCommunityPosts(
      PAGE_SIZE,
      (result) => {
        setPosts(result.posts);
        setCursor(result.lastCursor);
        setHasMorePosts(result.hasMore);
        setIsLoadingPosts(false);
      },
      (errMsg) => {
        setPostsError(errMsg);
        setIsLoadingPosts(false);
      },
      community.id
    );

    return () => {
      unsubscribe();
    };
  }, [community.id, canReadContent, isLoadingAccess]);

  // Load members when permitted
  const loadMembers = useCallback(async () => {
    if (!canReadContent && !canReadArchivedAsMember) return;
    setIsLoadingMembers(true);
    setMembersError(null);
    try {
      const list = await fetchCommunityMembers(community.id);
      setMembers(list);
    } catch (err) {
      setMembersError(
        err instanceof Error ? err.message : 'Unable to load community members.'
      );
    } finally {
      setIsLoadingMembers(false);
    }
  }, [community.id, canReadContent, canReadArchivedAsMember]);

  // Load pending requests when moderator/owner
  const loadPendingRequests = useCallback(async () => {
    if (!isModerator) {
      setPendingRequests([]);
      return;
    }
    setIsLoadingRequests(true);
    setRequestsError(null);
    try {
      const reqs = await fetchPendingJoinRequests(community.id);
      setPendingRequests(reqs);
    } catch (err) {
      setRequestsError(
        err instanceof Error
          ? err.message
          : 'Unable to load membership requests.'
      );
    } finally {
      setIsLoadingRequests(false);
    }
  }, [community.id, isModerator]);

  useEffect(() => {
    if (!isLoadingAccess && (canReadContent || canReadArchivedAsMember)) {
      void loadMembers();
    }
  }, [isLoadingAccess, canReadContent, canReadArchivedAsMember, loadMembers]);

  useEffect(() => {
    if (!isLoadingAccess && isModerator) {
      void loadPendingRequests();
    }
  }, [isLoadingAccess, isModerator, loadPendingRequests]);

  const mergedPosts = useMemo(() => {
    const seen = new Set<string>();
    const combined: AtaPost[] = [];
    for (const p of [...posts, ...extraPosts]) {
      if (!seen.has(p.id) && !blockedUserIds.has(p.authorId)) {
        seen.add(p.id);
        combined.push(p);
      }
    }
    return combined;
  }, [posts, extraPosts, blockedUserIds]);

  // Hydrate likes for displayed community posts
  useEffect(() => {
    if (!firebaseUser || mergedPosts.length === 0) return;
    const missing = mergedPosts
      .map((p) => p.id)
      .filter((id) => !(id in likedPostMap));
    if (missing.length === 0) return;

    let active = true;
    void getUserLikedPostMap(missing, firebaseUser.uid, community.id).then(
      (map) => {
        if (!active) return;
        setLikedPostMap((prev) => ({ ...prev, ...map }));
      }
    );

    return () => {
      active = false;
    };
  }, [firebaseUser, mergedPosts, likedPostMap, community.id]);

  const handleJoinPublic = async () => {
    setBannerError(null);
    if (!firebaseUser) {
      onOpenAuth?.('login');
      return;
    }
    if (!firebaseUser.emailVerified || !profile) {
      onNavigateProfile?.();
      return;
    }
    if (isMembershipBusy) return;

    setIsMembershipBusy(true);
    try {
      const res = await joinPublicCommunity(community.id, profile);
      setMyMembership(res.membership);
      const nextComm = { ...community, memberCount: res.memberCount };
      setCommunity(nextComm);
      onCommunityUpdated(nextComm);
      onMembershipChanged();
      void loadMembers();
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Unable to join community.'
      );
    } finally {
      setIsMembershipBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!firebaseUser || isMembershipBusy) return;
    setBannerError(null);
    setIsMembershipBusy(true);
    try {
      const nextCount = await leaveCommunity(community.id, firebaseUser.uid);
      setMyMembership(null);
      setConfirmLeave(false);
      const nextComm = {
        ...community,
        memberCount: nextCount,
        moderatorIds: community.moderatorIds.filter(
          (id) => id !== firebaseUser.uid
        ),
      };
      setCommunity(nextComm);
      onCommunityUpdated(nextComm);
      onMembershipChanged();
      if (community.visibility === 'public') {
        void loadMembers();
      } else {
        setMembers([]);
      }
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Unable to leave community.'
      );
    } finally {
      setIsMembershipBusy(false);
    }
  };

  const handleSubmitJoinRequest = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBannerError(null);
    if (!firebaseUser) {
      onOpenAuth?.('login');
      return;
    }
    if (!firebaseUser.emailVerified || !profile) {
      onNavigateProfile?.();
      return;
    }
    const err = validateJoinRequestMessage(requestNote);
    if (err) {
      setBannerError(err);
      return;
    }
    if (isMembershipBusy) return;

    setIsMembershipBusy(true);
    try {
      const saved = await requestPrivateMembership(
        community.id,
        profile,
        requestNote
      );
      setMyJoinRequest(saved);
      setShowRequestNoteBox(false);
      setRequestNote('');
      onMembershipChanged();
    } catch (reqErr) {
      setBannerError(
        reqErr instanceof Error
          ? reqErr.message
          : 'Unable to submit membership request.'
      );
    } finally {
      setIsMembershipBusy(false);
    }
  };

  const handleCancelJoinRequest = async () => {
    if (!firebaseUser || isMembershipBusy) return;
    setBannerError(null);
    setIsMembershipBusy(true);
    try {
      await cancelJoinRequest(community.id, firebaseUser.uid);
      setMyJoinRequest(null);
      onMembershipChanged();
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Unable to cancel request.'
      );
    } finally {
      setIsMembershipBusy(false);
    }
  };

  const handleLoadMorePosts = async () => {
    if (!cursor || isLoadingMorePosts) return;
    setIsLoadingMorePosts(true);
    try {
      const next = await fetchMoreCommunityPosts(
        cursor,
        PAGE_SIZE,
        community.id
      );
      setExtraPosts((prev) => [...prev, ...next.posts]);
      setCursor(next.lastCursor);
      setHasMorePosts(next.hasMore);
    } catch (err) {
      setPostsError(
        err instanceof Error ? err.message : 'Unable to load older discussions.'
      );
    } finally {
      setIsLoadingMorePosts(false);
    }
  };

  const handleToggleLike = async (post: AtaPost) => {
    if (!firebaseUser) return;
    const result = await togglePostLike(
      post.id,
      firebaseUser.uid,
      community.id
    );
    setLikedPostMap((prev) => ({ ...prev, [post.id]: result.liked }));
    const apply = (list: AtaPost[]) =>
      list.map((p) =>
        p.id === post.id ? { ...p, likeCount: result.likeCount } : p
      );
    setPosts(apply);
    setExtraPosts(apply);
  };

  const handlePostUpdated = (postId: string, updated: UpdatePostInput) => {
    const apply = (list: AtaPost[]) =>
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
    setPosts(apply);
    setExtraPosts(apply);
  };

  const handlePostDeleted = (postId: string) => {
    const remove = (list: AtaPost[]) => list.filter((p) => p.id !== postId);
    setPosts(remove);
    setExtraPosts(remove);
  };

  const handleCommentCountSync = (postId: string, totalCount: number) => {
    const apply = (list: AtaPost[]) =>
      list.map((p) =>
        p.id === postId ? { ...p, commentCount: totalCount } : p
      );
    setPosts(apply);
    setExtraPosts(apply);
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
  };

  const activeDetailPost = useMemo(() => {
    if (!detailPostId) return null;
    return mergedPosts.find((p) => p.id === detailPostId) || null;
  }, [detailPostId, mergedPosts]);

  const moderatorMembers = useMemo(
    () =>
      members.filter((m) => m.role === 'owner' || m.role === 'moderator'),
    [members]
  );

  return (
    <div className="space-y-6">
      {/* Top Back & Safety Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
          <span>All Communities</span>
        </button>

        {firebaseUser?.emailVerified && !isOwner && (
          <button
            type="button"
            onClick={() =>
              setReportTarget({
                targetType: 'community',
                targetId: community.id,
                postId: community.id,
                communityId: community.id,
                targetAuthorId: community.ownerId,
                targetAuthorUsername: community.name,
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8] bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] hover:text-[#EF3038] transition-colors"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Report Community</span>
          </button>
        )}
      </div>

      {/* Community Hero Banner & Metadata */}
      <section className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl overflow-hidden">
        <div className="relative h-36 sm:h-48 bg-[#090B14] border-b border-[#303342] overflow-hidden">
          {community.coverUrl && !coverError ? (
            <img
              src={community.coverUrl}
              alt={`${community.name} banner`}
              referrerPolicy="no-referrer"
              onError={() => setCoverError(true)}
              className="h-full w-full object-cover opacity-85"
            />
          ) : (
            <div
              aria-hidden="true"
              className="h-full w-full bg-[radial-gradient(circle_at_top_right,_rgba(239,48,56,0.32),_transparent_55%),linear-gradient(135deg,#090B14_0%,#171923_65%,#22121A_100%)]"
            />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#090B14]/85 via-[#090B14]/25 to-transparent"
          />
        </div>

        <div className="px-5 sm:px-6 pb-5 sm:pb-6">
          <div className="-mt-10 sm:-mt-12 relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="flex items-end gap-4 min-w-0">
              <CommunityAvatarBadge
                name={community.name}
                avatarUrl={community.avatarUrl}
                size="lg"
              />
              <div className="pt-10 sm:pt-12 min-w-0">
                <p className="font-accent-orbitron text-[10px] font-semibold tracking-[0.12em] text-[#B92335] dark:text-[#EF3038] uppercase">
                  {community.category} <span aria-hidden="true">·</span>{' '}
                  {community.visibility === 'private' ? 'Private Club' : 'Public Club'}
                  {community.status === 'archived' && (
                    <>
                      {' '}
                      <span aria-hidden="true">·</span> Archived
                    </>
                  )}
                </p>
                <h1 className="font-display-space font-bold text-2xl sm:text-3xl text-[#090B14] dark:text-white tracking-tight truncate">
                  {community.name}
                </h1>
              </div>
            </div>

            {/* Membership CTA Controls */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isLoadingAccess ? (
                <span className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                  Checking access...
                </span>
              ) : isOwner ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('manage')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Manage Club</span>
                </button>
              ) : isMember ? (
                <button
                  type="button"
                  disabled={isMembershipBusy}
                  onClick={() => setConfirmLeave((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] disabled:opacity-50 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                  <span>Joined · Leave</span>
                </button>
              ) : community.status === 'archived' ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8]">
                  <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Archived</span>
                </span>
              ) : community.visibility === 'public' ? (
                <button
                  type="button"
                  disabled={isMembershipBusy}
                  onClick={() => void handleJoinPublic()}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-50 transition-colors"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {isMembershipBusy ? 'Joining...' : 'Join Community'}
                  </span>
                </button>
              ) : myJoinRequest?.status === 'pending' ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl">
                    <Clock className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                    <span>Request Pending</span>
                  </span>
                  <button
                    type="button"
                    disabled={isMembershipBusy}
                    onClick={() => void handleCancelJoinRequest()}
                    className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038]"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Cancel</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isMembershipBusy}
                  onClick={() => {
                    if (!firebaseUser) {
                      onOpenAuth?.('login');
                      return;
                    }
                    if (!firebaseUser.emailVerified) {
                      onNavigateProfile?.();
                      return;
                    }
                    setShowRequestNoteBox((prev) => !prev);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-50 transition-colors"
                >
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  <span>Request Membership</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
              <span>@{community.slug}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#090B14] dark:text-white">
                <Users className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                <span>{community.memberCount.toLocaleString()}</span>{' '}
                <span>{community.memberCount === 1 ? 'Member' : 'Members'}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                {community.visibility === 'private' ? (
                  <>
                    <Lock className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                    <span>Approval required to view &amp; join</span>
                  </>
                ) : (
                  <>
                    <Globe className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                    <span>Open public discussions</span>
                  </>
                )}
              </span>
            </div>

            <p className="text-sm leading-relaxed text-[#090B14] dark:text-white/95">
              {community.description}
            </p>

            {community.animeTags.length > 0 && (
              <p className="text-xs font-medium text-[#52576B] dark:text-[#A7A9B8]">
                <span className="font-semibold text-[#B92335] dark:text-[#EF3038] mr-1.5">
                  Topics:
                </span>
                {community.animeTags.join(' · ')}
              </p>
            )}
          </div>

          {bannerError && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3 text-xs text-[#090B14] dark:text-white"
            >
              <AlertCircle
                className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{bannerError}</span>
            </div>
          )}

          {confirmLeave && (
            <div className="mt-4 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#EF3038] p-3.5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-medium text-[#090B14] dark:text-white">
                Leave {community.name}?
                {community.visibility === 'private' &&
                  ' You will need moderator approval to re-enter this private club.'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isMembershipBusy}
                  onClick={() => setConfirmLeave(false)}
                  className="px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] text-[#090B14] dark:text-white"
                >
                  Stay
                </button>
                <button
                  type="button"
                  disabled={isMembershipBusy}
                  onClick={() => void handleLeave()}
                  className="px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg bg-[#EF3038] text-white border border-[#B92335] hover:bg-[#B92335] disabled:opacity-50"
                >
                  {isMembershipBusy ? 'Leaving...' : 'Leave Club'}
                </button>
              </div>
            </div>
          )}

          {showRequestNoteBox && (
            <form
              onSubmit={handleSubmitJoinRequest}
              className="mt-4 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <label
                  htmlFor="ata-join-request-note"
                  className="text-xs font-semibold text-[#090B14] dark:text-white"
                >
                  Optional Note to Moderators
                </label>
                <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                  {requestNote.trim().length}/{JOIN_REQUEST_MESSAGE_MAX}
                </span>
              </div>
              <textarea
                id="ata-join-request-note"
                rows={2}
                maxLength={JOIN_REQUEST_MESSAGE_MAX}
                disabled={isMembershipBusy}
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder="Share what series or topics you're excited to discuss..."
                className="w-full resize-none rounded-xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] p-2.5 text-xs sm:text-sm text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isMembershipBusy}
                  onClick={() => setShowRequestNoteBox(false)}
                  className="px-3.5 py-2 min-h-[38px] text-xs font-semibold rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] text-[#090B14] dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMembershipBusy}
                  className="px-4 py-2 min-h-[38px] text-xs font-semibold rounded-xl bg-[#EF3038] text-white border border-[#B92335] hover:bg-[#B92335] disabled:opacity-50"
                >
                  {isMembershipBusy ? 'Sending...' : 'Send Membership Request'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Community sections"
        className="flex flex-wrap items-center gap-2 border-b border-[#D4D7E2] dark:border-[#303342] pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'discussions'}
          onClick={() => setActiveTab('discussions')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] text-xs font-semibold rounded-xl border transition-colors ${
            activeTab === 'discussions'
              ? 'bg-[#EF3038] text-white border-[#B92335]'
              : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]/60'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Discussions</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'rules'}
          onClick={() => setActiveTab('rules')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] text-xs font-semibold rounded-xl border transition-colors ${
            activeTab === 'rules'
              ? 'bg-[#EF3038] text-white border-[#B92335]'
              : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]/60'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Rules &amp; Moderators</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'members'}
          onClick={() => setActiveTab('members')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] text-xs font-semibold rounded-xl border transition-colors tabular-nums ${
            activeTab === 'members'
              ? 'bg-[#EF3038] text-white border-[#B92335]'
              : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]/60'
          }`}
        >
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Members ({community.memberCount})</span>
        </button>

        {isModerator && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'manage'}
            onClick={() => setActiveTab('manage')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] text-xs font-semibold rounded-xl border transition-colors tabular-nums ${
              activeTab === 'manage'
                ? 'bg-[#EF3038] text-white border-[#B92335]'
                : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]/60'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              Manage
              {pendingRequests.length > 0
                ? ` (${pendingRequests.length})`
                : ''}
            </span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'discussions' && (
        <div className="space-y-5">
          {isLoadingAccess ? (
            <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-10 flex flex-col items-center justify-center gap-3">
              <AtaLoadingSpinner size="md" label="Loading community access" />
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Verifying community access...
              </p>
            </div>
          ) : isArchivedLockedForOutsiders ? (
            <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-8 text-center space-y-2">
              <Archive
                className="h-7 w-7 text-[#EF3038] mx-auto"
                aria-hidden="true"
              />
              <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
                This Community Has Been Archived
              </h2>
              <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
                The club owner archived this community, so discussions are no
                longer open to non-members.
              </p>
            </div>
          ) : !canReadContent ? (
            <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-8 text-center space-y-3">
              <Lock
                className="h-7 w-7 text-[#EF3038] mx-auto"
                aria-hidden="true"
              />
              <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
                Private Community Discussions
              </h2>
              <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
                Posts, comments, and member discussions inside{' '}
                <strong>{community.name}</strong> are visible exclusively to
                approved members.
              </p>
              {myJoinRequest?.status === 'rejected' && (
                <p className="text-xs text-[#B92335] dark:text-[#EF3038]">
                  A previous membership request was declined. You can submit a
                  new request above if needed.
                </p>
              )}
            </div>
          ) : (
            <>
              <PostComposer
                communityId={community.id}
                communityName={community.name}
                canPostInCommunity={isMember}
                isCommunityArchived={community.status === 'archived'}
                onPostCreated={(newPost) => {
                  setPosts((prev) =>
                    prev.some((p) => p.id === newPost.id)
                      ? prev
                      : [newPost, ...prev]
                  );
                }}
                onOpenAuth={onOpenAuth}
                onNavigateProfile={onNavigateProfile}
              />

              {isLoadingPosts ? (
                <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-10 flex flex-col items-center justify-center gap-3">
                  <AtaLoadingSpinner size="md" label="Loading discussions" />
                  <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                    Loading community discussions...
                  </p>
                </div>
              ) : postsError ? (
                <div
                  role="alert"
                  className="bg-white dark:bg-[#171923] border border-[#EF3038] rounded-2xl p-5 flex items-start gap-2.5 text-xs sm:text-sm text-[#090B14] dark:text-white"
                >
                  <AlertCircle
                    className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{postsError}</span>
                </div>
              ) : !isOnline && mergedPosts.length === 0 ? (
                <div className="bg-white dark:bg-[#171923] border border-[#EF3038]/70 rounded-2xl p-8 text-center space-y-2.5">
                  <WifiOff
                    className="h-6 w-6 text-[#EF3038] mx-auto"
                    aria-hidden="true"
                  />
                  <p className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
                    Offline
                  </p>
                  <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8]">
                    Reconnect to load live discussions in {community.name}.
                  </p>
                </div>
              ) : mergedPosts.length === 0 ? (
                <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-8 text-center space-y-2">
                  <p className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
                    No Discussions Yet
                  </p>
                  <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
                    Start the first discussion thread in {community.name} using
                    the composer above.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mergedPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      communityId={community.id}
                      canModerate={isModerator}
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
                          communityId: community.id,
                          targetAuthorId: p.authorId,
                          targetAuthorUsername: p.authorUsername,
                        })
                      }
                      onBlockAuthor={handleBlockAuthor}
                      onOpenAuth={onOpenAuth}
                    />
                  ))}

                  {hasMorePosts && (
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        disabled={isLoadingMorePosts}
                        onClick={() => void handleLoadMorePosts()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] disabled:opacity-60"
                      >
                        <span>
                          {isLoadingMorePosts
                            ? 'Loading More...'
                            : 'Load More Discussions'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-5 space-y-3">
            <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white border-b border-[#D4D7E2] dark:border-[#303342] pb-2.5">
              Community Rules
            </h2>
            {community.rules.length === 0 ? (
              <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8]">
                No custom rules have been added yet. Standard ATA spoiler and
                respectful discussion guidelines apply.
              </p>
            ) : (
              <ol className="space-y-2.5">
                {community.rules.map((rule, idx) => (
                  <li
                    key={`${idx}-${rule}`}
                    className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3 text-xs sm:text-sm text-[#090B14] dark:text-white"
                  >
                    <span className="font-display-space font-bold text-[#EF3038] mr-2 tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-5 space-y-3">
            <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white border-b border-[#D4D7E2] dark:border-[#303342] pb-2.5">
              Moderators &amp; Stewardship
            </h2>
            {community.visibility === 'private' && !isMember ? (
              <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8]">
                Moderator details are visible once your membership request is
                approved.
              </p>
            ) : moderatorMembers.length === 0 ? (
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                {community.moderatorIds.length}{' '}
                {community.moderatorIds.length === 1
                  ? 'moderator'
                  : 'moderators'}{' '}
                stewarding this club.
              </p>
            ) : (
              <div className="space-y-2.5">
                {moderatorMembers.map((mod) => (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setProfileUserId(mod.userId)}
                    className="w-full text-left rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3 flex items-center justify-between gap-3 hover:border-[#EF3038] transition-colors"
                  >
                    <div>
                      <p className="font-display-space font-bold text-sm text-[#090B14] dark:text-white">
                        {mod.displayName}
                      </p>
                      <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                        @{mod.username}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#EF3038] uppercase tracking-wider">
                      {mod.role === 'owner' ? 'Owner' : 'Moderator'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {community.createdAt && (
              <p className="pt-2 text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Established{' '}
                {community.createdAt.toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
          </section>
        </div>
      )}

      {activeTab === 'members' && (
        <>
          {community.visibility === 'private' && !isMember ? (
            <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-8 text-center space-y-2">
              <Lock
                className="h-6 w-6 text-[#EF3038] mx-auto"
                aria-hidden="true"
              />
              <p className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
                Private Member Roster
              </p>
              <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8]">
                Only approved members of {community.name} can inspect the member
                roster.
              </p>
            </div>
          ) : (
            <CommunityMembersTab
              members={members}
              isLoading={isLoadingMembers}
              error={membersError}
              currentUserId={firebaseUser?.uid}
              isOwner={isOwner}
              isModerator={isModerator}
              onOpenProfile={(uid) => setProfileUserId(uid)}
              onChangeRole={async (member, nextRole) => {
                const updatedMods = await setMemberRole(
                  community.id,
                  member.userId,
                  nextRole
                );
                const nextComm = { ...community, moderatorIds: updatedMods };
                setCommunity(nextComm);
                onCommunityUpdated(nextComm);
                setMembers((prev) =>
                  prev.map((m) =>
                    m.userId === member.userId ? { ...m, role: nextRole } : m
                  )
                );
              }}
              onRemoveMember={async (member) => {
                const res = await removeCommunityMember(
                  community.id,
                  member.userId
                );
                const nextComm = {
                  ...community,
                  memberCount: res.memberCount,
                  moderatorIds: res.moderatorIds,
                };
                setCommunity(nextComm);
                onCommunityUpdated(nextComm);
                onMembershipChanged();
                setMembers((prev) =>
                  prev.filter((m) => m.userId !== member.userId)
                );
              }}
            />
          )}
        </>
      )}

      {activeTab === 'manage' && isModerator && (
        <CommunityManageTab
          community={community}
          isOwner={isOwner}
          pendingRequests={pendingRequests}
          isLoadingRequests={isLoadingRequests}
          requestsError={requestsError}
          onEditDetails={() => setShowEditModal(true)}
          onOpenProfile={(uid) => setProfileUserId(uid)}
          onApproveRequest={async (req) => {
            if (!firebaseUser) return;
            const nextCount = await approveJoinRequest(
              community.id,
              req,
              firebaseUser.uid
            );
            setPendingRequests((prev) =>
              prev.filter((r) => r.userId !== req.userId)
            );
            const nextComm = { ...community, memberCount: nextCount };
            setCommunity(nextComm);
            onCommunityUpdated(nextComm);
            void loadMembers();
          }}
          onRejectRequest={async (req) => {
            if (!firebaseUser) return;
            await rejectJoinRequest(community.id, req.userId, firebaseUser.uid);
            setPendingRequests((prev) =>
              prev.filter((r) => r.userId !== req.userId)
            );
          }}
          onUpdateOwnerSettings={async (settings) => {
            const updated = await updateCommunityOwnerSettings(
              community.id,
              settings
            );
            setCommunity(updated);
            onCommunityUpdated(updated);
            onMembershipChanged();
          }}
          onDeleteCommunity={async () => {
            await deleteCommunity(community);
            onCommunityDeleted(community.id);
          }}
        />
      )}

      {/* Community Scoped Post Detail Modal */}
      <PostDetailModal
        post={activeDetailPost}
        communityId={community.id}
        canModerate={isModerator}
        canComment={isMember && community.status === 'active'}
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
            communityId: community.id,
            targetAuthorId: p.authorId,
            targetAuthorUsername: p.authorUsername,
          })
        }
        onRequestReportComment={(c: AtaComment) =>
          setReportTarget({
            targetType: 'comment',
            targetId: c.id,
            postId: c.postId,
            communityId: community.id,
            targetAuthorId: c.authorId,
            targetAuthorUsername: c.authorUsername,
          })
        }
        onBlockAuthor={handleBlockAuthor}
        onCommentCountSync={handleCommentCountSync}
        onOpenAuth={onOpenAuth}
      />

      <PublicProfileModal
        targetUserId={profileUserId}
        onClose={() => setProfileUserId(null)}
        onBlockStateChanged={(uid, nowBlocked) => {
          setBlockedUserIds((prev) => {
            const next = new Set(prev);
            if (nowBlocked) next.add(uid);
            else next.delete(uid);
            return next;
          });
        }}
        onOpenAuth={onOpenAuth}
      />

      {reportTarget && firebaseUser && (
        <ReportModal
          isOpen
          targetType={reportTarget.targetType}
          targetId={reportTarget.targetId}
          postId={reportTarget.postId}
          communityId={reportTarget.communityId}
          targetAuthorId={reportTarget.targetAuthorId}
          targetAuthorUsername={reportTarget.targetAuthorUsername}
          reporterId={firebaseUser.uid}
          onClose={() => setReportTarget(null)}
        />
      )}

      <CommunityFormModal
        isOpen={showEditModal}
        mode="edit"
        creatorProfile={profile}
        existingCommunity={community}
        onClose={() => setShowEditModal(false)}
        onSaved={(updated) => {
          setCommunity(updated);
          onCommunityUpdated(updated);
        }}
      />
    </div>
  );
};
