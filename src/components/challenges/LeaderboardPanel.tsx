import React, { useState } from 'react';
import { Award, Info, Trophy, Users } from 'lucide-react';
import { ATA_SCORING_RULES } from '../../services/challenges/gamificationRules';
import type {
  AnimeChallenge,
  CommunityLeaderboardEntry,
  LeaderboardProfile,
} from '../../types';

interface LeaderboardPanelProps {
  overallLeaders: LeaderboardProfile[];
  communityLeaders: CommunityLeaderboardEntry[];
  challenges: AnimeChallenge[];
  currentUserId?: string;
  onSelectUser?: (uid: string) => void;
  onSelectChallenge?: (challenge: AnimeChallenge) => void;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  overallLeaders,
  communityLeaders,
  challenges,
  currentUserId,
  onSelectUser,
  onSelectChallenge,
}) => {
  const [boardTab, setBoardTab] = useState<'overall' | 'communities' | 'challenges'>(
    'overall'
  );

  const rankedChallenges = [...challenges]
    .sort((a, b) => {
      const scoreA = a.completedCount * 40 + a.participantCount * 10;
      const scoreB = b.completedCount * 40 + b.participantCount * 10;
      return scoreB - scoreA;
    })
    .slice(0, 15);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
              ATA Participation Leaderboards
            </h2>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Verified rankings computed from completed challenge milestones and watch party attendance.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'overall', label: 'Overall Members' },
                { id: 'communities', label: 'Community Clubs' },
                { id: 'challenges', label: 'Top Challenges' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setBoardTab(tab.id)}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold transition-colors ${
                  boardTab === tab.id
                    ? 'bg-[#EF3038] text-white'
                    : 'border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-3 text-xs text-[#52576B] dark:text-[#A7A9B8] flex items-start gap-2.5">
          <Info className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[#090B14] dark:text-white">
              Transparent Scoring Rules:
            </span>{' '}
            Join challenge (+{ATA_SCORING_RULES.challengeJoinBase} pts) · Complete
            challenge anime (+{ATA_SCORING_RULES.challengeAnimeCompleted} pts each) ·
            Finish full challenge (+{ATA_SCORING_RULES.challengeFullCompletionBonus}{' '}
            bonus, scaled by 1.0x Casual / 1.25x Standard / 1.5x Hardcore) · Attend
            Watch Party (+{ATA_SCORING_RULES.watchPartyAttend} pts) · Mark Episode
            Watched (+{ATA_SCORING_RULES.watchPartyCompleted} pts) · Host completed
            party with {ATA_SCORING_RULES.watchPartyHostMinAttendees}+ attendees (+
            {ATA_SCORING_RULES.watchPartyHostCompletedBonus} pts). Duplicate completion
            farming is blocked server-side.
          </div>
        </div>
      </div>

      {boardTab === 'overall' && (
        <div className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] overflow-hidden">
          {overallLeaders.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#52576B] dark:text-[#A7A9B8]">
              No ranked members yet. Join a challenge or attend a watch party to earn verified points!
            </div>
          ) : (
            <div className="divide-y divide-[#D4D7E2] dark:divide-[#303342]">
              {overallLeaders.map((entry, idx) => {
                const isSelf = currentUserId === entry.userId;
                return (
                  <button
                    key={entry.userId}
                    type="button"
                    onClick={() => onSelectUser?.(entry.userId)}
                    className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#F4F5F8] dark:hover:bg-[#090B14] transition-colors ${
                      isSelf ? 'bg-[#EF3038]/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          idx === 0
                            ? 'bg-amber-500 text-white'
                            : idx === 1
                              ? 'bg-slate-400 text-white'
                              : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#52576B] dark:text-[#A7A9B8]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#090B14] dark:text-white truncate">
                          {entry.displayName}{' '}
                          <span className="text-xs font-normal text-[#52576B] dark:text-[#A7A9B8]">
                            @{entry.username}
                          </span>
                        </p>
                        <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                          {entry.challengesCompleted} challenges completed ·{' '}
                          {entry.watchPartiesAttended} watch parties
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#EF3038]">
                        {entry.totalPoints} pts
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {boardTab === 'communities' && (
        <div className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] overflow-hidden">
          {communityLeaders.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#52576B] dark:text-[#A7A9B8]">
              No community challenge rankings yet. Community owners and moderators can launch challenges inside any ATA community.
            </div>
          ) : (
            <div className="divide-y divide-[#D4D7E2] dark:divide-[#303342]">
              {communityLeaders.map((comm, idx) => (
                <div
                  key={comm.communityId}
                  className="px-4 py-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-7 w-7 rounded-lg bg-[#EF3038]/15 text-[#EF3038] flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#090B14] dark:text-white truncate">
                        {comm.communityName}
                      </p>
                      <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                        {comm.totalChallenges} challenges · {comm.totalParticipants}{' '}
                        participants · {comm.totalCompletions} completions
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[#EF3038] shrink-0">
                    {comm.totalScore} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {boardTab === 'challenges' && (
        <div className="rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] overflow-hidden">
          {rankedChallenges.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#52576B] dark:text-[#A7A9B8]">
              No active challenges available yet.
            </div>
          ) : (
            <div className="divide-y divide-[#D4D7E2] dark:divide-[#303342]">
              {rankedChallenges.map((chal, idx) => (
                <button
                  key={chal.id}
                  type="button"
                  onClick={() => onSelectChallenge?.(chal)}
                  className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F4F5F8] dark:hover:bg-[#090B14] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-7 w-7 rounded-lg bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#090B14] dark:text-white truncate">
                        {chal.title}
                      </p>
                      <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                        {chal.category} · {chal.difficulty}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#52576B] dark:text-[#A7A9B8] shrink-0">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-[#EF3038]" />
                      {chal.participantCount}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[#090B14] dark:text-white">
                      <Trophy className="h-3.5 w-3.5 text-emerald-500" />
                      {chal.completedCount}
                    </span>
                    <Award className="h-4 w-4 text-[#EF3038]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
