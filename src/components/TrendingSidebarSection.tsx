import React from 'react';
import { ArrowRight, Sparkles, TrendingUp, Users } from 'lucide-react';
import type { CommunityHighlight, TrendingAnimeItem } from '../types';

interface TrendingSidebarSectionProps {
  trending: TrendingAnimeItem[];
  communities: CommunityHighlight[];
  onNavigateCommunities: () => void;
  onNavigateDiscover: () => void;
}

export const TrendingSidebarSection: React.FC<TrendingSidebarSectionProps> = ({
  trending,
  communities,
  onNavigateCommunities,
  onNavigateDiscover,
}) => {
  return (
    <div className="space-y-6">
      {/* Trending Anime Card */}
      <section
        aria-labelledby="trending-anime-heading"
        className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-5"
      >
        <div className="flex items-start justify-between gap-2 border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
          <div>
            <p className="font-accent-orbitron text-[10px] font-semibold tracking-[0.12em] text-[#B92335] dark:text-[#EF3038] uppercase">
              Sample Ranking <span aria-hidden="true">·</span> Demo Data
            </p>
            <h2
              id="trending-anime-heading"
              className="font-display-space font-bold text-xl text-[#090B14] dark:text-white mt-1"
            >
              Trending Anime
            </h2>
          </div>
          <TrendingUp
            className="h-5 w-5 text-[#EF3038] shrink-0 mt-1"
            aria-hidden="true"
          />
        </div>

        <ol className="mt-3 divide-y divide-[#D4D7E2]/70 dark:divide-[#303342]">
          {trending.map((item) => (
            <li key={item.id} className="py-3 first:pt-1.5 last:pb-1.5">
              <div className="flex items-baseline gap-3">
                <span
                  className={`font-display-space font-bold text-lg w-6 shrink-0 tabular-nums ${
                    item.rank <= 2
                      ? 'text-[#B92335] dark:text-[#EF3038]'
                      : 'text-[#52576B] dark:text-[#A7A9B8]'
                  }`}
                >
                  {String(item.rank).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#090B14] dark:text-white truncate">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[#52576B] dark:text-[#A7A9B8]">
                    {item.genre} <span aria-hidden="true">·</span> {item.format}{' '}
                    <span aria-hidden="true">·</span>{' '}
                    <span className="tabular-nums">
                      {item.discussionVolumeLabel}
                    </span>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onNavigateDiscover}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[40px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] transition-colors duration-150"
        >
          <span>Preview Discover Index</span>
          <ArrowRight className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
        </button>
      </section>

      {/* Community Highlights Card */}
      <section
        aria-labelledby="community-highlights-heading"
        className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-5"
      >
        <div className="flex items-start justify-between gap-2 border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
          <div>
            <p className="font-accent-orbitron text-[10px] font-semibold tracking-[0.12em] text-[#B92335] dark:text-[#EF3038] uppercase">
              Sample Clubs <span aria-hidden="true">·</span> Preview
            </p>
            <h2
              id="community-highlights-heading"
              className="font-display-space font-bold text-xl text-[#090B14] dark:text-white mt-1"
            >
              Community Highlights
            </h2>
          </div>
          <Users
            className="h-5 w-5 text-[#52576B] dark:text-[#A7A9B8] shrink-0 mt-1"
            aria-hidden="true"
          />
        </div>

        <div className="mt-3.5 space-y-3">
          {communities.map((club) => (
            <div
              key={club.id}
              className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display-space text-sm font-bold text-[#090B14] dark:text-white">
                  {club.name}
                </h3>
                <span className="text-[11px] font-semibold text-[#B92335] dark:text-[#EF3038] shrink-0">
                  {club.focus}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#52576B] dark:text-[#A7A9B8]">
                {club.summary}
              </p>
              <p className="mt-2 text-[11px] font-medium text-[#52576B]/90 dark:text-[#A7A9B8]/80">
                {club.sampleMemberCount}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onNavigateCommunities}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[40px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors duration-150"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Explore Communities</span>
        </button>
      </section>
    </div>
  );
};
