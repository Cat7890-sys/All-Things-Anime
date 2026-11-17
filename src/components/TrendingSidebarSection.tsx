import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAniListCategory } from '../hooks/useAniListDiscovery';
import { formatAnimeEpisodes } from '../services/catalogue/anilistService';
import type { NormalizedAnime } from '../services/catalogue/anilistTypes';
import type { CommunityHighlight, TrendingAnimeItem } from '../types';
import { AnimeDetailModal } from './discovery/AnimeDetailModal';

interface TrendingSidebarSectionProps {
  trending?: TrendingAnimeItem[];
  communities: CommunityHighlight[];
  onNavigateCommunities: () => void;
  onNavigateDiscover: () => void;
}

export const TrendingSidebarSection: React.FC<TrendingSidebarSectionProps> = ({
  communities,
  onNavigateCommunities,
  onNavigateDiscover,
}) => {
  const {
    items,
    isLoading,
    isStale,
    errorMessage,
    retry,
  } = useAniListCategory('trending', { perPage: 5 });

  const [selectedAnime, setSelectedAnime] = useState<NormalizedAnime | null>(
    null
  );

  return (
    <div className="space-y-6">
      {/* Live Trending Anime Card */}
      <section
        aria-labelledby="trending-anime-heading"
        className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-5"
      >
        <div className="flex items-start justify-between gap-2 border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
          <div>
            <p className="font-accent-orbitron text-[10px] font-semibold tracking-[0.12em] text-[#B92335] dark:text-[#EF3038] uppercase">
              {isStale ? 'Cached Snapshot · AniList' : 'Live Rankings · AniList'}
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

        {isLoading ? (
          <div className="mt-3 space-y-3" aria-label="Loading trending anime">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3 py-1.5 animate-pulse">
                <div className="h-5 w-6 rounded bg-[#EAECEF] dark:bg-[#303342]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 rounded bg-[#EAECEF] dark:bg-[#303342]" />
                  <div className="h-3 w-1/2 rounded bg-[#EAECEF] dark:bg-[#303342]" />
                </div>
              </div>
            ))}
          </div>
        ) : errorMessage && items.length === 0 ? (
          <div className="mt-4 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 text-center space-y-2.5">
            <AlertCircle
              className="h-5 w-5 text-[#EF3038] mx-auto"
              aria-hidden="true"
            />
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => void retry()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-semibold text-white bg-[#EF3038] hover:bg-[#B92335] transition-colors"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="mt-4 text-xs text-[#52576B] dark:text-[#A7A9B8]">
            No trending titles available right now.
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-[#D4D7E2]/70 dark:divide-[#303342]">
            {items.slice(0, 5).map((item, idx) => {
              const rank = item.trendingRank ?? idx + 1;
              const primaryGenre = item.genres[0] || item.formatLabel;
              const episodesLabel = formatAnimeEpisodes(
                item.episodes,
                item.status
              );

              return (
                <li key={item.id} className="py-2.5 first:pt-1 last:pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedAnime(item)}
                    className="w-full text-left flex items-baseline gap-3 rounded-lg p-1 -mx-1 hover:bg-[#F4F5F8] dark:hover:bg-[#090B14] transition-colors"
                  >
                    <span
                      className={`font-display-space font-bold text-lg w-6 shrink-0 tabular-nums ${
                        rank <= 2
                          ? 'text-[#B92335] dark:text-[#EF3038]'
                          : 'text-[#52576B] dark:text-[#A7A9B8]'
                      }`}
                    >
                      {String(rank).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#090B14] dark:text-white truncate">
                        {item.title.display}
                      </p>
                      <p className="mt-0.5 text-xs text-[#52576B] dark:text-[#A7A9B8] flex items-center gap-1.5 truncate">
                        <span className="truncate">{primaryGenre}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums shrink-0">
                          {episodesLabel}
                        </span>
                        {item.averageScore !== null && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-0.5 tabular-nums shrink-0 text-[#090B14] dark:text-white font-medium">
                              <Star
                                className="h-3 w-3 text-[#EF3038] fill-[#EF3038]"
                                aria-hidden="true"
                              />
                              {item.averageScore}%
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        <button
          type="button"
          onClick={onNavigateDiscover}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[40px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] transition-colors duration-150"
        >
          <span>Open Full Discover</span>
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

      <AnimeDetailModal
        anime={selectedAnime}
        onClose={() => setSelectedAnime(null)}
      />
    </div>
  );
};
