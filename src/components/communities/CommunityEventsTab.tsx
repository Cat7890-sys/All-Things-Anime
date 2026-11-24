import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Loader2, Lock, Plus, Trophy } from 'lucide-react';
import {
  fetchPublicAndJoinedChallenges,
  fetchUserChallengeParticipations,
} from '../../services/challenges/challengeService';
import { getUserAnimeList } from '../../services/personalisation/animeTrackerService';
import {
  fetchUserWatchPartyParticipations,
  fetchVisibleWatchParties,
} from '../../services/watchParties/watchPartyService';
import type {
  AnimeChallenge,
  AtaCommunity,
  AtaPublicProfile,
  AtaUserAccount,
  ChallengeParticipation,
  UserAnimeListItem,
  WatchParty,
  WatchPartyParticipant,
} from '../../types';
import { ChallengeCard } from '../challenges/ChallengeCard';
import { ChallengeDetailModal } from '../challenges/ChallengeDetailModal';
import { ChallengeFormModal } from '../challenges/ChallengeFormModal';
import { WatchPartyCard } from '../watchParties/WatchPartyCard';
import { WatchPartyDetailModal } from '../watchParties/WatchPartyDetailModal';
import { WatchPartyFormModal } from '../watchParties/WatchPartyFormModal';

interface CommunityEventsTabProps {
  community: AtaCommunity;
  currentProfile: AtaPublicProfile | AtaUserAccount | null;
  isMember: boolean;
  isModerator: boolean;
  canReadContent: boolean;
  blockedUserIds: Set<string>;
  onOpenUserProfile?: (uid: string) => void;
}

export const CommunityEventsTab: React.FC<CommunityEventsTabProps> = ({
  community,
  currentProfile,
  isMember,
  isModerator,
  canReadContent,
  blockedUserIds,
  onOpenUserProfile,
}) => {
  const uid = currentProfile?.uid || '';
  const [challenges, setChallenges] = useState<AnimeChallenge[]>([]);
  const [watchParties, setWatchParties] = useState<WatchParty[]>([]);
  const [myChallengeParts, setMyChallengeParts] = useState<
    Record<string, ChallengeParticipation>
  >({});
  const [myPartyParts, setMyPartyParts] = useState<
    Record<string, WatchPartyParticipant>
  >({});
  const [trackerItems, setTrackerItems] = useState<UserAnimeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedChallenge, setSelectedChallenge] =
    useState<AnimeChallenge | null>(null);
  const [editingChallenge, setEditingChallenge] =
    useState<AnimeChallenge | null>(null);
  const [showChallengeForm, setShowChallengeForm] = useState(false);

  const [selectedParty, setSelectedParty] = useState<WatchParty | null>(null);
  const [editingParty, setEditingParty] = useState<WatchParty | null>(null);
  const [showPartyForm, setShowPartyForm] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!canReadContent) {
      setChallenges([]);
      setWatchParties([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [chals, parties] = await Promise.all([
        fetchPublicAndJoinedChallenges(uid || undefined, community.id),
        fetchVisibleWatchParties(uid || undefined, community.id),
      ]);
      setChallenges(chals);
      setWatchParties(parties);

      if (uid) {
        const [cParts, pParts, tracker] = await Promise.all([
          fetchUserChallengeParticipations(uid),
          fetchUserWatchPartyParticipations(uid),
          getUserAnimeList(uid).catch(() => []),
        ]);
        const cMap: Record<string, ChallengeParticipation> = {};
        cParts.forEach((p) => {
          cMap[p.challengeId] = p;
        });
        const pMap: Record<string, WatchPartyParticipant> = {};
        pParts.forEach((p) => {
          pMap[p.partyId] = p;
        });
        setMyChallengeParts(cMap);
        setMyPartyParts(pMap);
        setTrackerItems(tracker);
      }
    } finally {
      setIsLoading(false);
    }
  }, [canReadContent, community.id, uid]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  if (!canReadContent) {
    return (
      <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-8 text-center space-y-2">
        <Lock className="h-7 w-7 text-[#EF3038] mx-auto" />
        <h3 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
          Private Community Challenges &amp; Watch Parties
        </h3>
        <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
          Join {community.name} to access community-only challenges and scheduled watch parties.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
            {community.name} Challenges &amp; Watch Parties
          </h2>
          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
            Community challenges, member progress, and independent watch schedules hosted inside this club.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isModerator && currentProfile && community.status === 'active' && (
            <button
              type="button"
              onClick={() => {
                setEditingChallenge(null);
                setShowChallengeForm(true);
              }}
              className="min-h-[40px] px-3.5 rounded-xl bg-[#EF3038] hover:bg-[#B92335] text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New Community Challenge
            </button>
          )}
          {isMember && currentProfile && community.status === 'active' && (
            <button
              type="button"
              onClick={() => {
                setEditingParty(null);
                setShowPartyForm(true);
              }}
              className="min-h-[40px] px-3.5 rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] hover:border-[#EF3038] text-xs font-semibold text-[#090B14] dark:text-white inline-flex items-center gap-1.5"
            >
              <CalendarClock className="h-3.5 w-3.5 text-[#EF3038]" />
              Schedule Watch Party
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-8 flex items-center justify-center gap-2 text-xs text-[#52576B] dark:text-[#A7A9B8]">
          <Loader2 className="h-4 w-4 animate-spin text-[#EF3038]" />
          Loading community events...
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8] inline-flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-[#EF3038]" />
              Community Challenges ({challenges.length})
            </h3>
            {challenges.length === 0 ? (
              <div className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-6 text-xs text-[#52576B] dark:text-[#A7A9B8]">
                No challenges launched in this community yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {challenges.map((chal) => (
                  <ChallengeCard
                    key={chal.id}
                    challenge={chal}
                    participation={myChallengeParts[chal.id]}
                    onSelect={setSelectedChallenge}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8] inline-flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-[#EF3038]" />
              Community Watch Parties ({watchParties.length})
            </h3>
            {watchParties.length === 0 ? (
              <div className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-6 text-xs text-[#52576B] dark:text-[#A7A9B8]">
                No watch parties scheduled for {community.name} yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {watchParties.map((party) => (
                  <WatchPartyCard
                    key={party.id}
                    party={party}
                    participation={myPartyParts[party.id]}
                    onSelect={setSelectedParty}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {currentProfile && (
        <ChallengeFormModal
          isOpen={showChallengeForm}
          currentProfile={currentProfile}
          existingChallenge={editingChallenge}
          lockedCommunity={community}
          onClose={() => {
            setShowChallengeForm(false);
            setEditingChallenge(null);
          }}
          onSaved={() => void loadEvents()}
        />
      )}

      {currentProfile && (
        <WatchPartyFormModal
          isOpen={showPartyForm}
          currentProfile={currentProfile}
          existingParty={editingParty}
          lockedCommunity={community}
          onClose={() => {
            setShowPartyForm(false);
            setEditingParty(null);
          }}
          onSaved={() => void loadEvents()}
        />
      )}

      <ChallengeDetailModal
        challenge={selectedChallenge}
        currentProfile={currentProfile}
        participation={
          selectedChallenge
            ? myChallengeParts[selectedChallenge.id]
            : undefined
        }
        trackerItems={trackerItems}
        canManage={isModerator}
        onClose={() => setSelectedChallenge(null)}
        onUpdated={() => void loadEvents()}
        onEditRequested={(c) => {
          setSelectedChallenge(null);
          setEditingChallenge(c);
          setShowChallengeForm(true);
        }}
        onOpenUserProfile={onOpenUserProfile}
      />

      <WatchPartyDetailModal
        party={selectedParty}
        currentProfile={currentProfile}
        participation={
          selectedParty ? myPartyParts[selectedParty.id] : undefined
        }
        blockedUserIds={blockedUserIds}
        canManage={isModerator}
        onClose={() => setSelectedParty(null)}
        onUpdated={() => void loadEvents()}
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
