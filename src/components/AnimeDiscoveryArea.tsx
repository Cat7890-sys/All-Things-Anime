import React, { useState } from 'react';
import { AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { useAniListCategory } from '../hooks/useAniListDiscovery';
import { getCurrentAnimeSeason } from '../services/catalogue/anilistService';
import type { NormalizedAnime } from '../services/catalogue/anilistTypes';
import type { DiscoverySeriesItem } from '../types';
import { AnimeCard } from './discovery/AnimeCard';
import { AnimeDetailModal } from './discovery/AnimeDetailModal';

interface AnimeDiscoveryAreaProps {
  series?: DiscoverySeriesItem[];
  onOpenDiscoverPage: () => void;
}

export const AnimeDiscoveryArea: React.FC<AnimeDiscoveryAreaProps> = ({
  onOpenDiscoverPage,
}) => {
  const {
    items,
    seasonInfo,
    isLoading,
    isStale,
    warningMessage,
    errorMessage,
    retry,
  } = useAniListCategory('seasonal', { perPage: 6 });

  const [selectedAnime, setSelectedAnime] = useState<NormalizedAnime | null>(
    null
  );

  const activeSeason = seasonInfo ?? getCurrentAnimeSeason();

  return (
    <section
      id="anime-discovery-area"
      aria-labelledby="anime-discovery-heading"
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
        <div>
          <p className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] text-[#B92335] dark:text-[#EF3038] uppercase">
            Live AniList Catalogue <span aria-hidden="true">·</span>{' '}
            {activeSeason.label}
          </p>
          <h2
            id="anime-discovery-heading"
            className="font-display-space font-bold text-2xl sm:text-3xl text-[#090B14] dark:text-white mt-1"
          >
            Seasonal Anime Spotlight
          </h2>
        </div>

        <button
          type="button"
          onClick={onOpenDiscoverPage}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-lg hover:border-[#EF3038] transition-colors duration-150 whitespace-nowrap"
        >
          <span>Open Full Discover</span>
          <ArrowRight className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
        </button>
      </div>

      {isStale && warningMessage && (
        <p
          role="status"
          className="rounded-xl bg-[#F4F5F8] dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] px-3.5 py-2 text-xs text-[#52576B] dark:text-[#A7A9B8]"
        >
          {warningMessage}
        </p>
      )}

      {isLoading ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          aria-label="Loading seasonal anime spotlight"
        >
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] overflow-hidden animate-pulse"
            >
              <div className="aspect-[3/4] bg-[#EAECEF] dark:bg-[#090B14]" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-1/2 rounded bg-[#EAECEF] dark:bg-[#303342]" />
                <div className="h-4 w-3/4 rounded bg-[#EAECEF] dark:bg-[#303342]" />
              </div>
            </div>
          ))}
        </div>
      ) : errorMessage && items.length === 0 ? (
        <div
          role="alert"
          className="rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] p-6 text-center space-y-3"
        >
          <AlertCircle
            className="h-6 w-6 text-[#EF3038] mx-auto"
            aria-hidden="true"
          />
          <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8]">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={() => void retry()}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-xl text-xs font-semibold text-white bg-[#EF3038] hover:bg-[#B92335] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] p-6 text-center text-xs text-[#52576B] dark:text-[#A7A9B8]">
          No seasonal titles returned right now. Open Discover to browse other
          categories.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {items.slice(0, 3).map((anime) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              onSelect={setSelectedAnime}
            />
          ))}
        </div>
      )}

      <AnimeDetailModal
        anime={selectedAnime}
        onClose={() => setSelectedAnime(null)}
      />
    </section>
  );
};
