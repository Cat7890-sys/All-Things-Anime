import React, { useState } from 'react';
import {
  Archive,
  ArrowRight,
  Clock,
  Globe,
  Lock,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { AtaCommunity } from '../../types';

interface CommunityCardProps {
  community: AtaCommunity;
  isMember: boolean;
  isOwner: boolean;
  isModerator: boolean;
  hasPendingRequest: boolean;
  isActionBusy?: boolean;
  onOpenCommunity: (community: AtaCommunity) => void;
  onQuickJoin?: (community: AtaCommunity) => void;
}

export const CommunityAvatarBadge: React.FC<{
  name: string;
  avatarUrl: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ name, avatarUrl, size = 'md' }) => {
  const [imgError, setImgError] = useState(false);
  const initial = (name.trim().charAt(0) || 'A').toUpperCase();

  const sizeClass =
    size === 'sm'
      ? 'h-10 w-10 text-base rounded-xl'
      : size === 'lg'
        ? 'h-20 w-20 sm:h-24 sm:w-24 text-2xl sm:text-3xl rounded-2xl'
        : 'h-14 w-14 text-xl rounded-xl';

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={`${name} emblem`}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeClass} object-cover border-2 border-[#090B14] dark:border-[#171923] ring-1 ring-[#D4D7E2] dark:ring-[#303342] bg-[#090B14] shrink-0`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${sizeClass} flex items-center justify-center font-display-space font-bold text-white bg-gradient-to-br from-[#EF3038] via-[#B92335] to-[#090B14] border-2 border-[#090B14] dark:border-[#171923] ring-1 ring-[#303342] shrink-0 select-none`}
    >
      {initial}
    </div>
  );
};

export const CommunityCard: React.FC<CommunityCardProps> = ({
  community,
  isMember,
  isOwner,
  isModerator,
  hasPendingRequest,
  isActionBusy = false,
  onOpenCommunity,
  onQuickJoin,
}) => {
  const [coverError, setCoverError] = useState(false);

  return (
    <article className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl overflow-hidden flex flex-col transition-colors duration-150 hover:border-[#EF3038]/60">
      {/* Cover Strip */}
      <div className="relative h-24 sm:h-28 bg-[#090B14] border-b border-[#303342] overflow-hidden">
        {community.coverUrl && !coverError ? (
          <img
            src={community.coverUrl}
            alt={`${community.name} cover`}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setCoverError(true)}
            className="h-full w-full object-cover opacity-85"
          />
        ) : (
          <div
            aria-hidden="true"
            className="h-full w-full bg-[radial-gradient(circle_at_top_right,_rgba(239,48,56,0.28),_transparent_55%),linear-gradient(135deg,#090B14_0%,#171923_65%,#22121A_100%)]"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#090B14]/85 via-[#090B14]/25 to-transparent"
        />

        {/* Top-Right Status Text (Zero Pill) */}
        <div className="absolute top-2.5 right-3 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-white/95">
          {community.isFeatured && (
            <span className="font-accent-orbitron text-[10px] uppercase text-[#EF3038]">
              Featured
            </span>
          )}
          {community.status === 'archived' && (
            <span className="inline-flex items-center gap-1 text-[#A7A9B8]">
              <Archive className="h-3 w-3" aria-hidden="true" />
              <span>Archived</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            {community.visibility === 'private' ? (
              <>
                <Lock className="h-3 w-3 text-[#EF3038]" aria-hidden="true" />
                <span>Private</span>
              </>
            ) : (
              <>
                <Globe className="h-3 w-3 text-[#A7A9B8]" aria-hidden="true" />
                <span>Public</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex-1 flex flex-col">
        <div className="-mt-7 relative z-10 flex items-end justify-between gap-3">
          <button
            type="button"
            onClick={() => onOpenCommunity(community)}
            className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EF3038] rounded-xl"
            aria-label={`Open ${community.name}`}
          >
            <CommunityAvatarBadge
              name={community.name}
              avatarUrl={community.avatarUrl}
              size="md"
            />
          </button>

          <div className="pt-8 text-right text-xs text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
            <span className="inline-flex items-center gap-1 font-semibold text-[#090B14] dark:text-white">
              <Users className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
              <span>{community.memberCount.toLocaleString()}</span>
            </span>{' '}
            <span>{community.memberCount === 1 ? 'member' : 'members'}</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <button
              type="button"
              onClick={() => onOpenCommunity(community)}
              className="text-left font-display-space font-bold text-lg text-[#090B14] dark:text-white hover:text-[#EF3038] transition-colors line-clamp-1"
            >
              {community.name}
            </button>
          </div>

          <p className="mt-0.5 text-xs text-[#52576B] dark:text-[#A7A9B8]">
            <span>@{community.slug}</span>
            <span aria-hidden="true"> · </span>
            <span className="font-semibold text-[#B92335] dark:text-[#EF3038]">
              {community.category}
            </span>
          </p>

          <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[#52576B] dark:text-[#A7A9B8] line-clamp-2">
            {community.description}
          </p>

          {community.animeTags.length > 0 && (
            <p className="mt-2.5 text-[11px] font-medium text-[#52576B] dark:text-[#A7A9B8] line-clamp-1">
              {community.animeTags.join(' · ')}
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-auto pt-4 flex items-center justify-between gap-2.5 border-t border-[#D4D7E2]/70 dark:border-[#303342]/80">
          <button
            type="button"
            onClick={() => onOpenCommunity(community)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] transition-colors"
          >
            <span>Open Club</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
          </button>

          {isOwner ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B92335] dark:text-[#EF3038]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Owner</span>
            </span>
          ) : isModerator ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B92335] dark:text-[#EF3038]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Moderator</span>
            </span>
          ) : isMember ? (
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Joined
            </span>
          ) : hasPendingRequest ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8]">
              <Clock className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
              <span>Pending</span>
            </span>
          ) : community.status === 'active' && onQuickJoin ? (
            <button
              type="button"
              disabled={isActionBusy}
              onClick={() => onQuickJoin(community)}
              className="inline-flex items-center justify-center px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {community.visibility === 'private' ? 'Request Access' : 'Join'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
};
