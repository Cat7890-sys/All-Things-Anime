import React from 'react';
import { Calendar, Clock, Globe, Lock, MessageSquare, Users } from 'lucide-react';
import { formatCountdownLabel } from '../../services/challenges/gamificationRules';
import type { WatchParty, WatchPartyParticipant } from '../../types';

interface WatchPartyCardProps {
  party: WatchParty;
  participation?: WatchPartyParticipant;
  onSelect: (party: WatchParty) => void;
}

const STATUS_BADGE: Record<WatchParty['status'], string> = {
  scheduled: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  live: 'bg-[#EF3038] text-white border-[#EF3038]',
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  cancelled: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
};

export const WatchPartyCard: React.FC<WatchPartyCardProps> = ({
  party,
  participation,
  onSelect,
}) => {
  const countdown = formatCountdownLabel(
    party.scheduledStartAtMs,
    party.estimatedDurationMinutes,
    party.status
  );

  const localTimeLabel = party.scheduledStartAtMs
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(party.scheduledStartAtMs))
    : `${party.scheduledDate} ${party.startTime}`;

  return (
    <article className="flex flex-col rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] overflow-hidden hover:border-[#EF3038]/70 transition-colors">
      <div className="p-4 flex gap-3.5">
        {party.animeCoverUrl ? (
          <img
            src={party.animeCoverUrl}
            alt={party.animeTitle}
            className="h-24 w-16 rounded-xl object-cover shrink-0 border border-[#D4D7E2] dark:border-[#303342]"
          />
        ) : (
          <div className="h-24 w-16 rounded-xl bg-[#090B14] shrink-0" />
        )}

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border ${
                STATUS_BADGE[party.status]
              }`}
            >
              {party.status === 'live' ? 'Watch Window Live' : party.status}
            </span>
            <span className="text-[11px] font-semibold text-[#EF3038]">
              {countdown}
            </span>
          </div>

          <h3 className="font-display-space font-bold text-base text-[#090B14] dark:text-white line-clamp-1">
            {party.title}
          </h3>

          <p className="text-xs font-medium text-[#52576B] dark:text-[#A7A9B8] truncate">
            {party.animeTitle}
            {party.episodeNumber ? ` · Episode ${party.episodeNumber}` : ''}
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-[#EF3038]" />
              {localTimeLabel} (Your time)
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-[#EF3038]" />
              {party.estimatedDurationMinutes}m
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3 mt-auto">
        <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] line-clamp-2">
          {party.description}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#52576B] dark:text-[#A7A9B8] pt-2 border-t border-[#D4D7E2] dark:border-[#303342]">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-[#EF3038]" />
            {party.participantCount}
            {party.participantLimit ? ` / ${party.participantLimit}` : ''} joined
          </span>
          <span className="inline-flex items-center gap-1">
            {party.visibility === 'private' ? (
              <Lock className="h-3.5 w-3.5 text-[#EF3038]" />
            ) : (
              <Globe className="h-3.5 w-3.5 text-[#EF3038]" />
            )}
            {party.visibility === 'community' && party.communityName
              ? party.communityName
              : party.visibility.charAt(0).toUpperCase() +
                party.visibility.slice(1)}
          </span>
          {party.discussionEnabled && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5 text-[#EF3038]" />
              Discussion
            </span>
          )}
        </div>

        <p className="text-[10px] text-[#52576B] dark:text-[#A7A9B8] bg-[#F4F5F8] dark:bg-[#090B14] rounded-lg px-2.5 py-1.5 border border-[#D4D7E2] dark:border-[#303342]">
          Independent Watching · Watch via your own source at the scheduled time.
        </p>

        <button
          type="button"
          onClick={() => onSelect(party)}
          className="w-full min-h-[44px] rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] hover:border-[#EF3038] hover:bg-[#EF3038] hover:text-white text-xs font-semibold text-[#090B14] dark:text-white transition-colors"
        >
          {participation
            ? `Joined (${participation.rsvpStatus}) · Open Room`
            : 'View Schedule & Join'}
        </button>
      </div>
    </article>
  );
};
