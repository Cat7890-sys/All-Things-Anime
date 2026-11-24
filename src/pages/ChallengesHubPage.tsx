import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  CalendarClock,
  Info,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { AchievementsShelf } from '../components/challenges/AchievementsShelf';
import { ChallengeCard } from '../components/challenges/ChallengeCard';
import { ChallengeDetailModal } from '../components/challenges/ChallengeDetailModal';
import { ChallengeFormModal } from '../components/challenges/ChallengeFormModal';
import { LeaderboardPanel } from '../components/challenges/LeaderboardPanel';
import { WatchPartyCard } from '../components/watchParties/WatchPartyCard';
import { WatchPartyDetailModal } from '../components/watchParties/WatchPartyDetailModal';
import { WatchPartyFormModal } from '../components/watchParties/WatchPartyFormModal';
import { useAuth } from '../hooks/useAuth';
import {
  fetchChallengeById,
  fetchPublicAndJoinedChallenges,
  fetchUserChallengeParticipations,
} from '../services/challenges/challengeService';
import {
  fetchCommunityLeaderboard,
  fetchOverallLeaderboard,
  fetchUserAchievements,
  fetchUserLeaderboardProfile,
} from '../services/challenges/gamificationService';
import {
  fetchCommunityById,
  fetchUserMemberships,
} from '../services/communityService';
import { getUserAnimeList } from '../services/personalisation/animeTrackerService';
import { fetchBlockedUserIds } from '../services/userService';
import {
  CHALLENGE_CATEGORIES,
  CHALLENGE_DIFFICULTIES,
  CHALLENGE_DURATIONS,
  INDEPENDENT_WATCH_NOTICE,
} from '../services/validation';
import {
  fetchUserWatchPartyParticipations,
  fetchVisibleWatchParties,
  fetchWatchPartyById,
} from '../services/watchParties/watchPartyService';
import type {
  AnimeChallenge,
  AtaCommunity,
  AuthViewMode,
  ChallengeParticipation,
  CommunityLeaderboardEntry,
  CommunityMembership,
  LeaderboardProfile,
  UserAchievement,
  UserAnimeListItem,
  WatchParty,
  WatchPartyParticipant,
} from '../types';

interface ChallengesHubPageProps {
  onOpenAuth: (mode: AuthViewMode) => void;
  onOpenUserProfile?: (uid: string) => void;
  initialChallengeId?: string | null;
  initialWatchPartyId?: string | null;
  onClearDeepLink?: () => void;
}

type HubTab = 'challenges' | 'watch-parties' | 'leaderboards' | 'activity';
type PartyFilter = 'all' | 'upcoming' | 'today' | 'popular' | 'community' | 'mine';

export const ChallengesHubPage: React.FC<ChallengesHubPageProps> = ({
  onOpenAuth,
  onOpenUserProfile,
  initialChallengeId,
  initialWatchPartyId,
  onClearDeepLink,
}) => {
  const { firebaseUser, profile } = useAuth();
  const uid = firebaseUser?.uid || '';
  const isVerified = Boolean(firebaseUser && firebaseUser.emailVerified && profile);

  const [activeTab, setActiveTab] = useState<HubTab>(
    initialWatchPartyId ? 'watch-parties' : 'challenges'
  );
  const [challenges, setChallenges] = useState<AnimeChallenge[]>([]);
  const [watchParties, setWatchParties] = useState<WatchParty[]>([]);
  const [myChallengeParts, setMyChallengeParts] = useState<
    ChallengeParticipation[]
  >([]);
  const [myPartyParts, setMyPartyParts] = useState<WatchPartyParticipant[]>([]);
  const [overallLeaders, setOverallLeaders] = useState<LeaderboardProfile[]>([]);
  const [communityLeaders, setCommunityLeaders] = useState<
    CommunityLeaderboardEntry[]
  >([]);
  const [myLeaderboardStats, setMyLeaderboardStats] =
    useState<LeaderboardProfile | null>(null);
  const [myAchievements, setMyAchievements] = useState<UserAchievement[]>([]);
  const [trackerItems, setTrackerItems] = useState<UserAnimeListItem[]>([]);
  const [memberCommunities, setMemberCommunities] = useState<AtaCommunity[]>([]);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [challengeSearch, setChallengeSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [diffFilter, setDiffFilter] = useState('all');
  const [durFilter, setDurFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [partySearch, setPartySearch] = useState('');
  const [partyFilter, setPartyFilter] = useState<PartyFilter>('all');

  // Modals
  const [selectedChallenge, setSelectedChallenge] =
    useState<AnimeChallenge | null>(null);
  const [editingChallenge, setEditingChallenge] =
    useState<AnimeChallenge | null>(null);
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [selectedParty, setSelectedParty] = useState<WatchParty | null>(null);
  const [editingParty, setEditingParty] = useState<WatchParty | null>(null);
  const [showPartyForm, setShowPartyForm] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [chals, parties, overall, commLeaders] = await Promise.all([
        fetchPublicAndJoinedChallenges(uid || undefined),
        fetchVisibleWatchParties(uid || undefined),
        fetchOverallLeaderboard(30),
        fetchCommunityLeaderboard(),
      ]);
      setChallenges(chals);
      setWatchParties(parties);
      setOverallLeaders(overall);
      setCommunityLeaders(commLeaders);

      if (uid) {
        const [
          cParts,
          pParts,
          myStats,
          myAchs,
          tracker,
          memberships,
          blocked,
        ] = await Promise.all([
          fetchUserChallengeParticipations(uid),
          fetchUserWatchPartyParticipations(uid),
          fetchUserLeaderboardProfile(uid),
          fetchUserAchievements(uid),
          getUserAnimeList(uid).catch(() => []),
          fetchUserMemberships(uid).catch(() => []),
          fetchBlockedUserIds(uid).catch(() => [] as string[]),
        ]);
        setMyChallengeParts(cParts);
        setMyPartyParts(pParts);
        setMyLeaderboardStats(myStats);
        setMyAchievements(myAchs);
        setTrackerItems(tracker);
        setBlockedIds(new Set(blocked));

        const commDocs = await Promise.all(
          memberships.slice(0, 15).map((m: CommunityMembership) =>
            fetchCommunityById(m.communityId).catch(() => null)
          )
        );
        setMemberCommunities(
          commDocs.filter((c): c is AtaCommunity => c !== null && c.status === 'active')
        );
      } else {
        setMyChallengeParts([]);
        setMyPartyParts([]);
        setMyLeaderboardStats(null);
        setMyAchievements([]);
        setMemberCommunities([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle notification / calendar deep link
  useEffect(() => {
    if (initialChallengeId) {
      setActiveTab('challenges');
      const localMatch = challenges.find((c) => c.id === initialChallengeId);
      if (localMatch) {
        setSelectedChallenge(localMatch);
        onClearDeepLink?.();
      } else {
        fetchChallengeById(initialChallengeId)
          .then((found) => {
            if (found) setSelectedChallenge(found);
          })
          .finally(() => onClearDeepLink?.());
      }
    } else if (initialWatchPartyId) {
      setActiveTab('watch-parties');
      const localMatch = watchParties.find((p) => p.id === initialWatchPartyId);
      if (localMatch) {
        setSelectedParty(localMatch);
        onClearDeepLink?.();
      } else {
        fetchWatchPartyById(initialWatchPartyId)
          .then((found) => {
            if (found) setSelectedParty(found);
          })
          .finally(() => onClearDeepLink?.());
      }
    }
  }, [initialChallengeId, initialWatchPartyId, challenges, watchParties, onClearDeepLink]);

  const challengePartMap = useMemo(
    () => new Map(myChallengeParts.map((p) => [p.challengeId, p])),
    [myChallengeParts]
  );

  const partyPartMap = useMemo(
    () => new Map(myPartyParts.map((p) => [p.partyId, p])),
    [myPartyParts]
  );

  const moderatedCommunities = useMemo(
    () =>
      memberCommunities.filter(
        (c) => c.ownerId === uid || c.moderatorIds.includes(uid)
      ),
    [memberCommunities, uid]
  );

  const featuredChallenge = useMemo(
    () =>
      challenges.find((c) => c.isFeatured && c.status !== 'archived') ||
      challenges.find((c) => c.status === 'active') ||
      challenges[0] ||
      null,
    [challenges]
  );

  const filteredChallenges = useMemo(() => {
    const q = challengeSearch.trim().toLowerCase();
    return challenges.filter((c) => {
      if (catFilter !== 'all' && c.category !== catFilter) return false;
      if (diffFilter !== 'all' && c.difficulty !== diffFilter) return false;
      if (durFilter !== 'all' && c.durationType !== durFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (q) {
        const hay = `${c.title} ${c.description} ${c.communityName} ${c.animeTargets
          .map((t) => t.title)
          .join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [challenges, challengeSearch, catFilter, diffFilter, durFilter, statusFilter]);

  const filteredWatchParties = useMemo(() => {
    const q = partySearch.trim().toLowerCase();
    const todayStr = new Date().toISOString().slice(0, 10);
    const list = watchParties.filter((p) => {
      if (partyFilter === 'upcoming' && p.status !== 'scheduled' && p.status !== 'live') {
        return false;
      }
      if (partyFilter === 'today' && p.scheduledDate !== todayStr) return false;
      if (partyFilter === 'community' && p.visibility !== 'community') return false;
      if (
        partyFilter === 'mine' &&
        p.creatorId !== uid &&
        !partyPartMap.has(p.id)
      ) {
        return false;
      }
      if (q) {
        const hay = `${p.title} ${p.animeTitle} ${p.description} ${p.communityName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (partyFilter === 'popular') {
      return [...list].sort((a, b) => b.participantCount - a.participantCount);
    }
    return list;
  }, [watchParties, partySearch, partyFilter, uid, partyPartMap]);

  const requireVerifiedAction = (fn: () => void) => {
    if (!firebaseUser) {
      onOpenAuth('login');
      return;
    }
    if (!isVerified) return;
    fn();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#EF3038]">
              ATA Community Events
            </p>
            <h1 className="font-display-space font-bold text-2xl sm:text-3xl text-[#090B14] dark:text-white">
              Anime Challenges &amp; Watch Parties
            </h1>
            <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-2xl">
              Join seasonal watching challenges, coordinate independent group watch sessions, climb community leaderboards, and unlock ATA badges.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                requireVerifiedAction(() => {
                  setEditingChallenge(null);
                  setShowChallengeForm(true);
                })
              }
              className="min-h-[44px] px-4 rounded-xl bg-[#EF3038] hover:bg-[#B92335] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Challenge
            </button>
            <button
              type="button"
              onClick={() =>
                requireVerifiedAction(() => {
                  setEditingParty(null);
                  setShowPartyForm(true);
                })
              }
              className="min-h-[44px] px-4 rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] hover:border-[#EF3038] text-[#090B14] dark:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <CalendarClock className="h-4 w-4 text-[#EF3038]" />
              Host Watch Party
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-[#D4D7E2] dark:border-[#303342] pt-4">
          {(
            [
              { id: 'challenges', label: `Challenges (${challenges.length})`, icon: Trophy },
              {
                id: 'watch-parties',
                label: `Watch Parties (${watchParties.length})`,
                icon: CalendarClock,
              },
              { id: 'leaderboards', label: 'Leaderboards', icon: Award },
              { id: 'activity', label: 'My Activity & Badges', icon: Sparkles },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[42px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors ${
                  active
                    ? 'bg-[#EF3038] text-white'
                    : 'border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#090B14] dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {isLoading ? (
        <div className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-10 flex items-center justify-center gap-2 text-sm text-[#52576B] dark:text-[#A7A9B8]">
          <Loader2 className="h-5 w-5 animate-spin text-[#EF3038]" />
          Loading ATA Challenges &amp; Watch Parties...
        </div>
      ) : (
        <>
          {activeTab === 'challenges' && (
            <div className="space-y-5">
              {featuredChallenge && (
                <section className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-[#090B14] text-white overflow-hidden grid grid-cols-1 md:grid-cols-3">
                  <div className="relative h-44 md:h-auto bg-[#171923]">
                    {(featuredChallenge.coverImageUrl ||
                      featuredChallenge.animeTargets[0]?.coverImage) && (
                      <img
                        src={
                          featuredChallenge.coverImageUrl ||
                          featuredChallenge.animeTargets[0]?.coverImage
                        }
                        alt={featuredChallenge.title}
                        className="h-full w-full object-cover opacity-85"
                      />
                    )}
                  </div>
                  <div className="md:col-span-2 p-5 sm:p-6 flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#EF3038] text-white text-[11px] font-bold uppercase tracking-wider">
                        <Sparkles className="h-3 w-3" />
                        Spotlight Challenge
                      </span>
                      <h2 className="font-display-space font-bold text-xl">
                        {featuredChallenge.title}
                      </h2>
                      <p className="text-xs text-[#A7A9B8] line-clamp-2">
                        {featuredChallenge.description}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <span className="text-xs text-[#A7A9B8]">
                        {featuredChallenge.animeTargets.length} titles ·{' '}
                        {featuredChallenge.participantCount} participants ·{' '}
                        {featuredChallenge.startDate} → {featuredChallenge.endDate}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedChallenge(featuredChallenge)}
                        className="min-h-[40px] px-4 rounded-xl bg-[#EF3038] hover:bg-[#B92335] text-white text-xs font-semibold"
                      >
                        Open Spotlight
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Challenge Filters */}
              <div className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search className="h-4 w-4 text-[#52576B] dark:text-[#A7A9B8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={challengeSearch}
                    onChange={(e) => setChallengeSearch(e.target.value)}
                    placeholder="Search challenges or anime..."
                    className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] pl-9 pr-3 py-2 text-xs text-[#090B14] dark:text-white"
                  />
                </div>
                <select
                  aria-label="Filter by category"
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3 py-2 text-xs text-[#090B14] dark:text-white"
                >
                  <option value="all">All Categories</option>
                  {CHALLENGE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter by difficulty"
                  value={diffFilter}
                  onChange={(e) => setDiffFilter(e.target.value)}
                  className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3 py-2 text-xs text-[#090B14] dark:text-white"
                >
                  <option value="all">All Difficulties</option>
                  {CHALLENGE_DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter by duration"
                  value={durFilter}
                  onChange={(e) => setDurFilter(e.target.value)}
                  className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3 py-2 text-xs text-[#090B14] dark:text-white"
                >
                  <option value="all">All Durations</option>
                  {CHALLENGE_DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3 py-2 text-xs text-[#090B14] dark:text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {filteredChallenges.length === 0 ? (
                <div className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-8 text-center space-y-3">
                  <p className="text-sm font-semibold text-[#090B14] dark:text-white">
                    No matching challenges found.
                  </p>
                  <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                    Create the first seasonal or genre marathon challenge for ATA members!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredChallenges.map((c) => (
                    <ChallengeCard
                      key={c.id}
                      challenge={c}
                      participation={challengePartMap.get(c.id)}
                      onSelect={setSelectedChallenge}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'watch-parties' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-xs text-sky-900 dark:text-sky-200">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                <div>
                  <span className="font-semibold">Option A Independent Watching:</span>{' '}
                  {INDEPENDENT_WATCH_NOTICE}
                </div>
              </div>

              <div className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'All Parties' },
                      { id: 'upcoming', label: 'Upcoming' },
                      { id: 'today', label: 'Today' },
                      { id: 'popular', label: 'Popular' },
                      { id: 'community', label: 'Community Hosted' },
                      { id: 'mine', label: 'My Watch Parties' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPartyFilter(f.id)}
                      className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold transition-colors ${
                        partyFilter === f.id
                          ? 'bg-[#EF3038] text-white'
                          : 'border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="h-4 w-4 text-[#52576B] dark:text-[#A7A9B8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={partySearch}
                    onChange={(e) => setPartySearch(e.target.value)}
                    placeholder="Search watch parties..."
                    className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] pl-9 pr-3 py-2 text-xs text-[#090B14] dark:text-white"
                  />
                </div>
              </div>

              {filteredWatchParties.length === 0 ? (
                <div className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-8 text-center space-y-2">
                  <p className="text-sm font-semibold text-[#090B14] dark:text-white">
                    No watch parties match your filter.
                  </p>
                  <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                    Schedule a group watch session with your community or friends.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredWatchParties.map((party) => (
                    <WatchPartyCard
                      key={party.id}
                      party={party}
                      participation={partyPartMap.get(party.id)}
                      onSelect={setSelectedParty}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'leaderboards' && (
            <LeaderboardPanel
              overallLeaders={overallLeaders}
              communityLeaders={communityLeaders}
              challenges={challenges}
              currentUserId={uid || undefined}
              onSelectUser={onOpenUserProfile}
              onSelectChallenge={setSelectedChallenge}
            />
          )}

          {activeTab === 'activity' && (
            <div className="space-y-5">
              {!firebaseUser ? (
                <div className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-8 text-center space-y-3">
                  <p className="text-sm font-semibold text-[#090B14] dark:text-white">
                    Sign in to view your Challenge Progress &amp; Badges
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('login')}
                    className="min-h-[42px] px-5 rounded-xl bg-[#EF3038] text-white text-xs font-semibold"
                  >
                    Sign In to ATA
                  </button>
                </div>
              ) : (
                <>
                  <section className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-5 space-y-4">
                    <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
                      Your Achievements &amp; Event Stats
                    </h2>
                    <AchievementsShelf
                      achievements={myAchievements}
                      stats={myLeaderboardStats}
                    />
                  </section>

                  <section className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-5 space-y-3">
                    <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
                      Joined Challenges ({myChallengeParts.length})
                    </h2>
                    {myChallengeParts.length === 0 ? (
                      <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                        You haven&apos;t joined any challenges yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {myChallengeParts.map((part) => {
                          const chal = challenges.find(
                            (c) => c.id === part.challengeId
                          );
                          if (!chal) return null;
                          return (
                            <ChallengeCard
                              key={part.id}
                              challenge={chal}
                              participation={part}
                              onSelect={setSelectedChallenge}
                            />
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-5 space-y-3">
                    <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
                      My Watch Parties
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {watchParties
                        .filter(
                          (p) => p.creatorId === uid || partyPartMap.has(p.id)
                        )
                        .map((party) => (
                          <WatchPartyCard
                            key={party.id}
                            party={party}
                            participation={partyPartMap.get(party.id)}
                            onSelect={setSelectedParty}
                          />
                        ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          )}
        </>
      )}

      {profile && (
        <ChallengeFormModal
          isOpen={showChallengeForm}
          currentProfile={profile}
          existingChallenge={editingChallenge}
          moderatedCommunities={moderatedCommunities}
          onClose={() => {
            setShowChallengeForm(false);
            setEditingChallenge(null);
          }}
          onSaved={() => void loadData()}
        />
      )}

      {profile && (
        <WatchPartyFormModal
          isOpen={showPartyForm}
          currentProfile={profile}
          existingParty={editingParty}
          memberCommunities={memberCommunities}
          onClose={() => {
            setShowPartyForm(false);
            setEditingParty(null);
          }}
          onSaved={() => void loadData()}
        />
      )}

      <ChallengeDetailModal
        challenge={selectedChallenge}
        currentProfile={profile}
        participation={
          selectedChallenge
            ? challengePartMap.get(selectedChallenge.id)
            : undefined
        }
        trackerItems={trackerItems}
        canManage={
          selectedChallenge
            ? moderatedCommunities.some(
                (c) => c.id === selectedChallenge.communityId
              )
            : false
        }
        onClose={() => setSelectedChallenge(null)}
        onUpdated={() => void loadData()}
        onEditRequested={(c) => {
          setSelectedChallenge(null);
          setEditingChallenge(c);
          setShowChallengeForm(true);
        }}
        onOpenUserProfile={onOpenUserProfile}
      />

      <WatchPartyDetailModal
        party={selectedParty}
        currentProfile={profile}
        participation={
          selectedParty ? partyPartMap.get(selectedParty.id) : undefined
        }
        blockedUserIds={blockedIds}
        canManage={
          selectedParty
            ? moderatedCommunities.some((c) => c.id === selectedParty.communityId)
            : false
        }
        onClose={() => setSelectedParty(null)}
        onUpdated={() => void loadData()}
        onEditRequested={(p) => {
          setSelectedParty(null);
          setEditingParty(p);
          setShowPartyForm(true);
        }}
        onOpenUserProfile={onOpenUserProfile}
      />
    </div>
  );
};
