import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Clock,
  Compass,
  Flame,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { CommunityCard } from '../components/communities/CommunityCard';
import { CommunityDetailView } from '../components/communities/CommunityDetailView';
import { CommunityFormModal } from '../components/communities/CommunityFormModal';
import { AtaLoadingSpinner } from '../components/AtaLoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  fetchCommunityById,
  fetchOwnedCommunities,
  fetchPopularCommunities,
  fetchRecentCommunities,
  fetchUserMemberships,
  fetchUserPendingJoinRequestMap,
  joinPublicCommunity,
} from '../services/communityService';
import { COMMUNITY_CATEGORIES } from '../services/validation';
import type {
  AtaCommunity,
  AuthViewMode,
  CommunityCategory,
  CommunityJoinRequest,
  CommunityMembership,
} from '../types';

interface CommunitiesPageProps {
  onOpenAuth?: (mode: AuthViewMode) => void;
  onNavigateProfile?: () => void;
}

type DiscoveryTab = 'featured' | 'popular' | 'recent' | 'joined';

export const CommunitiesPage: React.FC<CommunitiesPageProps> = ({
  onOpenAuth,
  onNavigateProfile,
}) => {
  const { firebaseUser, profile } = useAuth();
  const { isOnline } = useOnlineStatus();

  const [activeTab, setActiveTab] = useState<DiscoveryTab>('featured');
  const [selectedCategory, setSelectedCategory] = useState<
    CommunityCategory | 'All'
  >('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [popularCommunities, setPopularCommunities] = useState<AtaCommunity[]>(
    []
  );
  const [recentCommunities, setRecentCommunities] = useState<AtaCommunity[]>(
    []
  );
  const [joinedCommunities, setJoinedCommunities] = useState<AtaCommunity[]>(
    []
  );
  const [membershipMap, setMembershipMap] = useState<
    Record<string, CommunityMembership>
  >({});
  const [pendingRequestMap, setPendingRequestMap] = useState<
    Record<string, CommunityJoinRequest>
  >({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCommunityId, setBusyCommunityId] = useState<string | null>(null);

  const [selectedCommunity, setSelectedCommunity] =
    useState<AtaCommunity | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadDiscovery = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [popular, recent] = await Promise.all([
        fetchPopularCommunities(40),
        fetchRecentCommunities(40),
      ]);
      setPopularCommunities(popular);
      setRecentCommunities(recent);

      if (firebaseUser) {
        const [memberships, owned, pendingReqs] = await Promise.all([
          fetchUserMemberships(firebaseUser.uid),
          fetchOwnedCommunities(firebaseUser.uid),
          fetchUserPendingJoinRequestMap(firebaseUser.uid),
        ]);

        const mMap: Record<string, CommunityMembership> = {};
        for (const m of memberships) {
          mMap[m.communityId] = m;
        }
        setMembershipMap(mMap);
        setPendingRequestMap(pendingReqs);

        const knownMap = new Map<string, AtaCommunity>();
        for (const c of [...popular, ...recent, ...owned]) {
          knownMap.set(c.id, c);
        }

        const missingIds = memberships
          .map((m) => m.communityId)
          .filter((cid) => !knownMap.has(cid));

        if (missingIds.length > 0) {
          const fetchedMissing = await Promise.all(
            missingIds.map((cid) => fetchCommunityById(cid).catch(() => null))
          );
          for (const comm of fetchedMissing) {
            if (comm) knownMap.set(comm.id, comm);
          }
        }

        const joinedList: AtaCommunity[] = [];
        const added = new Set<string>();
        for (const c of owned) {
          joinedList.push(c);
          added.add(c.id);
        }
        for (const m of memberships) {
          if (!added.has(m.communityId)) {
            const c = knownMap.get(m.communityId);
            if (c) {
              joinedList.push(c);
              added.add(c.id);
            }
          }
        }
        setJoinedCommunities(joinedList);
      } else {
        setMembershipMap({});
        setPendingRequestMap({});
        setJoinedCommunities([]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load anime communities right now.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    void loadDiscovery();
  }, [loadDiscovery]);

  const handleCommunityUpdated = (updated: AtaCommunity) => {
    const replaceIn = (list: AtaCommunity[]) => {
      const exists = list.some((c) => c.id === updated.id);
      if (!exists) return list;
      return list.map((c) => (c.id === updated.id ? updated : c));
    };

    if (updated.status === 'active') {
      setPopularCommunities((prev) =>
        prev.some((c) => c.id === updated.id)
          ? replaceIn(prev)
          : [updated, ...prev]
      );
      setRecentCommunities((prev) =>
        prev.some((c) => c.id === updated.id)
          ? replaceIn(prev)
          : [updated, ...prev]
      );
    } else {
      setPopularCommunities((prev) => prev.filter((c) => c.id !== updated.id));
      setRecentCommunities((prev) => prev.filter((c) => c.id !== updated.id));
    }

    setJoinedCommunities((prev) => replaceIn(prev));
    if (selectedCommunity?.id === updated.id) {
      setSelectedCommunity(updated);
    }
  };

  const handleCommunityDeleted = (communityId: string) => {
    setPopularCommunities((prev) => prev.filter((c) => c.id !== communityId));
    setRecentCommunities((prev) => prev.filter((c) => c.id !== communityId));
    setJoinedCommunities((prev) => prev.filter((c) => c.id !== communityId));
    setSelectedCommunity(null);
  };

  const handleCreateTrigger = () => {
    if (!firebaseUser) {
      onOpenAuth?.('register');
      return;
    }
    if (!firebaseUser.emailVerified || !profile) {
      onNavigateProfile?.();
      return;
    }
    setShowCreateModal(true);
  };

  const handleQuickJoin = async (community: AtaCommunity) => {
    if (community.visibility === 'private') {
      setSelectedCommunity(community);
      return;
    }
    if (!firebaseUser) {
      onOpenAuth?.('login');
      return;
    }
    if (!firebaseUser.emailVerified || !profile) {
      onNavigateProfile?.();
      return;
    }
    if (busyCommunityId) return;

    setBusyCommunityId(community.id);
    setError(null);
    try {
      const res = await joinPublicCommunity(community.id, profile);
      setMembershipMap((prev) => ({ ...prev, [community.id]: res.membership }));
      const updated = { ...community, memberCount: res.memberCount };
      handleCommunityUpdated(updated);
      setJoinedCommunities((prev) =>
        prev.some((c) => c.id === updated.id) ? prev : [updated, ...prev]
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to join community.'
      );
    } finally {
      setBusyCommunityId(null);
    }
  };

  // Featured highlights explicitly featured clubs first, then active high-engagement clubs
  const featuredCommunities = useMemo(() => {
    const flagged = popularCommunities.filter((c) => c.isFeatured);
    const remaining = popularCommunities.filter((c) => !c.isFeatured);
    return [...flagged, ...remaining];
  }, [popularCommunities]);

  const displayedCommunities = useMemo(() => {
    const base =
      activeTab === 'featured'
        ? featuredCommunities
        : activeTab === 'popular'
          ? popularCommunities
          : activeTab === 'recent'
            ? recentCommunities
            : joinedCommunities;

    const term = searchQuery.trim().toLowerCase();

    return base.filter((comm) => {
      if (selectedCategory !== 'All' && comm.category !== selectedCategory) {
        return false;
      }
      if (!term) return true;
      return (
        comm.nameLowercase.includes(term) ||
        comm.slug.includes(term) ||
        comm.description.toLowerCase().includes(term) ||
        comm.category.toLowerCase().includes(term) ||
        comm.animeTags.some((tag) => tag.toLowerCase().includes(term))
      );
    });
  }, [
    activeTab,
    featuredCommunities,
    popularCommunities,
    recentCommunities,
    joinedCommunities,
    selectedCategory,
    searchQuery,
  ]);

  if (selectedCommunity) {
    return (
      <CommunityDetailView
        community={selectedCommunity}
        onBack={() => setSelectedCommunity(null)}
        onCommunityUpdated={handleCommunityUpdated}
        onCommunityDeleted={handleCommunityDeleted}
        onMembershipChanged={() => void loadDiscovery()}
        onOpenAuth={onOpenAuth}
        onNavigateProfile={onNavigateProfile}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Discovery Hero Header */}
      <section className="bg-[#090B14] border border-[#303342] rounded-2xl p-6 sm:p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div className="max-w-2xl">
            <p className="font-accent-orbitron text-[11px] font-semibold tracking-[0.14em] text-[#EF3038] uppercase">
              ATA Universe <span aria-hidden="true">·</span> Live Anime Clubs
            </p>
            <h1 className="mt-2 font-display-space font-bold text-3xl sm:text-4xl tracking-tight">
              Anime Communities
            </h1>
            <p className="mt-2 text-sm sm:text-base text-[#A7A9B8] leading-relaxed">
              Join dedicated anime clubs, episode watch rooms, sakuga frame
              studies, and spoiler-protected discussion spaces moderated by fans.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreateTrigger}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] text-xs sm:text-sm font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Create Community</span>
          </button>
        </div>

        {/* Discovery View Tabs */}
        <div
          role="tablist"
          aria-label="Community discovery tabs"
          className="mt-6 flex flex-wrap items-center gap-2 border-t border-[#303342] pt-4"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'featured'}
            onClick={() => setActiveTab('featured')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold rounded-xl border transition-colors ${
              activeTab === 'featured'
                ? 'bg-[#EF3038] text-white border-[#B92335]'
                : 'bg-[#171923] text-[#A7A9B8] border-[#303342] hover:border-[#EF3038] hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Featured</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'popular'}
            onClick={() => setActiveTab('popular')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold rounded-xl border transition-colors ${
              activeTab === 'popular'
                ? 'bg-[#EF3038] text-white border-[#B92335]'
                : 'bg-[#171923] text-[#A7A9B8] border-[#303342] hover:border-[#EF3038] hover:text-white'
            }`}
          >
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Popular</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'recent'}
            onClick={() => setActiveTab('recent')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold rounded-xl border transition-colors ${
              activeTab === 'recent'
                ? 'bg-[#EF3038] text-white border-[#B92335]'
                : 'bg-[#171923] text-[#A7A9B8] border-[#303342] hover:border-[#EF3038] hover:text-white'
            }`}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Recently Created</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'joined'}
            onClick={() => setActiveTab('joined')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold rounded-xl border transition-colors tabular-nums ${
              activeTab === 'joined'
                ? 'bg-[#EF3038] text-white border-[#B92335]'
                : 'bg-[#171923] text-[#A7A9B8] border-[#303342] hover:border-[#EF3038] hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              Joined
              {firebaseUser ? ` (${joinedCommunities.length})` : ''}
            </span>
          </button>
        </div>
      </section>

      {/* Search & Category Filter Controls */}
      <section
        aria-label="Filter communities"
        className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-4 sm:p-5 space-y-3.5"
      >
        <div className="relative">
          <Search
            className="h-4 w-4 text-[#52576B] dark:text-[#A7A9B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="ata-community-search" className="sr-only">
            Search communities by name, tag, or series
          </label>
          <input
            id="ata-community-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search communities by name, @slug, series, or tag..."
            className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] pl-10 pr-9 py-2.5 min-h-[42px] text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 focus:border-[#EF3038] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear community search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['All', ...COMMUNITY_CATEGORIES] as const).map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 min-h-[34px] text-xs font-semibold rounded-lg border transition-colors ${
                  active
                    ? 'bg-[#EF3038] text-white border-[#B92335]'
                    : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#52576B] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] hover:text-[#090B14] dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Discovery Grid & States */}
      {activeTab === 'joined' && !firebaseUser ? (
        <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-8 text-center space-y-3">
          <Users className="h-6 w-6 text-[#EF3038] mx-auto" aria-hidden="true" />
          <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
            Sign In to View Your Communities
          </h2>
          <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
            Sign in with your ATA account to see every community you have joined
            or created.
          </p>
          <button
            type="button"
            onClick={() => onOpenAuth?.('login')}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335]"
          >
            <span>Sign In</span>
          </button>
        </div>
      ) : isLoading ? (
        <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-12 flex flex-col items-center justify-center gap-3">
          <AtaLoadingSpinner size="md" label="Loading anime communities" />
          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
            Loading live ATA communities...
          </p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="bg-white dark:bg-[#171923] border border-[#EF3038] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-xs sm:text-sm text-[#090B14] dark:text-white">
            <AlertCircle
              className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadDiscovery()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#EF3038] rounded-xl"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      ) : !isOnline && displayedCommunities.length === 0 ? (
        <div className="bg-white dark:bg-[#171923] border border-[#EF3038]/70 rounded-2xl p-8 text-center space-y-2.5">
          <WifiOff
            className="h-6 w-6 text-[#EF3038] mx-auto"
            aria-hidden="true"
          />
          <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
            You&apos;re Offline
          </h2>
          <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
            Browsing and joining live communities requires an active internet
            connection.
          </p>
        </div>
      ) : displayedCommunities.length === 0 ? (
        <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-10 text-center space-y-3">
          <Compass
            className="h-7 w-7 text-[#EF3038] mx-auto"
            aria-hidden="true"
          />
          <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
            {searchQuery || selectedCategory !== 'All'
              ? 'No Matching Communities Found'
              : activeTab === 'joined'
                ? 'You Haven’t Joined a Community Yet'
                : 'No Communities Created Yet'}
          </h2>
          <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
            {searchQuery || selectedCategory !== 'All'
              ? 'Try clearing your search or switching anime categories.'
              : 'Launch the next fan club on ATA — organize around a series, genre, or animation craft.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            {(searchQuery || selectedCategory !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="px-4 py-2 min-h-[40px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038]"
              >
                Reset Filters
              </button>
            )}
            <button
              type="button"
              onClick={handleCreateTrigger}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Create Community</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedCommunities.map((comm) => {
            const mem = membershipMap[comm.id];
            const isOwner = Boolean(
              firebaseUser &&
                (comm.ownerId === firebaseUser.uid || mem?.role === 'owner')
            );
            const isMod = Boolean(
              isOwner ||
                mem?.role === 'moderator' ||
                (firebaseUser && comm.moderatorIds.includes(firebaseUser.uid))
            );
            const hasPending = Boolean(pendingRequestMap[comm.id]);

            return (
              <CommunityCard
                key={comm.id}
                community={comm}
                isMember={Boolean(mem)}
                isOwner={isOwner}
                isModerator={isMod}
                hasPendingRequest={hasPending}
                isActionBusy={busyCommunityId === comm.id}
                onOpenCommunity={(c) => setSelectedCommunity(c)}
                onQuickJoin={handleQuickJoin}
              />
            );
          })}
        </div>
      )}

      {/* Create Community Modal */}
      <CommunityFormModal
        isOpen={showCreateModal}
        mode="create"
        creatorProfile={profile}
        onClose={() => setShowCreateModal(false)}
        onSaved={(created) => {
          setPopularCommunities((prev) => [created, ...prev]);
          setRecentCommunities((prev) => [created, ...prev]);
          setJoinedCommunities((prev) => [created, ...prev]);
          setSelectedCommunity(created);
          void loadDiscovery();
        }}
      />
    </div>
  );
};
