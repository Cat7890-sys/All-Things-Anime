import React from 'react';
import { Calendar, CheckCircle2, Sparkles, Trophy, Users } from 'lucide-react';
import type { AnimeChallenge, ChallengeParticipation } from '../../types';

interface ChallengeCardProps {
  challenge: AnimeChallenge;
  participation?: ChallengeParticipation;
  onSelect: (challenge: AnimeChallenge) => void;
}

const STATUS_STYLES: Record<AnimeChallenge['status'], string> = {
  upcoming: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  completed: 'bg-[#52576B]/15 text-[#52576B] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342]',
  archived: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
};

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  participation,
  onSelect,
}) => {
  const coverImage =
    challenge.coverImageUrl || challenge.animeTargets[0]?.coverImage || '';

  return (
    <article className="group flex flex-col rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] overflow-hidden hover:border-[#EF3038]/70 transition-colors">
      <div className="relative h-36 bg-[#171923] overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={challenge.title}
            className="h-full w-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-[#090B14] text-[#A7A9B8]">
            <Trophy className="h-8 w-8 text-[#EF3038]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090B14] via-[#090B14]/35 to-transparent" />
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <span
            className={`px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-md border backdrop-blur-sm ${
              STATUS_STYLES[challenge.status]
            }`}
          >
            {challenge.status}
          </span>
          {challenge.isFeatured && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#EF3038] text-white">
              <Sparkles className="h-3 w-3" />
              Featured
            </span>
          )}
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/80">
            {challenge.category} · {challenge.difficulty}
          </p>
          <h3 className="font-display-space font-bold text-base text-white line-clamp-1">
            {challenge.title}
          </h3>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-3">
        <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] line-clamp-2">
          {challenge.description}
        </p>

        {challenge.visibility === 'community' && challenge.communityName && (
          <p className="text-[11px] font-semibold text-[#EF3038] truncate">
            Community Challenge · {challenge.communityName}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#52576B] dark:text-[#A7A9B8]">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-[#EF3038]" />
            {challenge.participantCount}
            {challenge.participantLimit ? ` / ${challenge.participantLimit}` : ''} joined
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-[#EF3038]" />
            {challenge.startDate} → {challenge.endDate}
          </span>
        </div>

        <div className="text-xs text-[#090B14] dark:text-white font-medium">
          {challenge.animeTargets.length}{' '}
          {challenge.animeTargets.length === 1 ? 'Anime Title' : 'Anime Titles'} ·{' '}
          {challenge.completedCount} completed
        </div>

        {participation && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#090B14] dark:text-white inline-flex items-center gap-1">
                {participation.status === 'completed' && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                )}
                Your Progress
              </span>
              <span className="font-semibold text-[#EF3038]">
                {participation.progressPercent}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#F4F5F8] dark:bg-[#090B14] overflow-hidden border border-[#D4D7E2] dark:border-[#303342]">
              <div
                className="h-full bg-[#EF3038] transition-all duration-300"
                style={{ width: `${participation.progressPercent}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-auto pt-2">
          <button
            type="button"
            onClick={() => onSelect(challenge)}
            className="w-full min-h-[44px] rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] hover:border-[#EF3038] hover:bg-[#EF3038] hover:text-white text-xs font-semibold text-[#090B14] dark:text-white transition-colors"
          >
            {participation ? 'View & Track Progress' : 'Inspect & Join Challenge'}
          </button>
        </div>
      </div>
    </article>
  );
};
