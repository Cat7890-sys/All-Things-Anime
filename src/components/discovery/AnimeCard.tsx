import React from 'react';
import { BookOpen, Calendar, Clock, Star } from 'lucide-react';
import {
  formatAnimeEpisodes,
  formatTimeUntilAiring,
} from '../../services/catalogue/anilistService';
import type { NormalizedAnime } from '../../services/catalogue/anilistTypes';
import type { CatalogueOverrideRecord } from '../../types';
import { MangaImage } from '../MangaImage';

interface AnimeCardProps {
  anime: NormalizedAnime;
  showTrendingRank?: boolean;
  editorialOverride?: CatalogueOverrideRecord;
  onSelect: (anime: NormalizedAnime) => void;
}

export const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  showTrendingRank = false,
  editorialOverride,
  onSelect,
}) => {
  const rank = showTrendingRank ? anime.trendingRank : null;
  const coverSrc = anime.coverImage.best || '';
  const episodeLabel = formatAnimeEpisodes(anime.episodes, anime.status);

  const secondarySubtitle =
    anime.nextAiringEpisode && anime.status === 'RELEASING'
      ? `Ep ${anime.nextAiringEpisode.episode} in ${formatTimeUntilAiring(
          anime.nextAiringEpisode.timeUntilAiring
        )}`
      : anime.status === 'NOT_YET_RELEASED' && anime.startDate.formatted
        ? `Starts ${anime.startDate.formatted}`
        : anime.seasonLabel || anime.startDate.formatted || anime.statusLabel;

  return (
    <article className="group bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl flex flex-col overflow-hidden transition-colors duration-150 hover:border-[#EF3038]/80">
      <button
        type="button"
        onClick={() => onSelect(anime)}
        aria-label={`View details for ${anime.title.display}`}
        className="relative w-full text-left border-b border-[#D4D7E2] dark:border-[#303342] focus-visible:outline-none"
      >
        <MangaImage
          src={coverSrc}
          alt={`${anime.title.display} cover artwork`}
          aspectClassName="aspect-[3/4]"
          fallbackTitle={anime.title.display}
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />

        {rank !== null && (
          <div
            className={`absolute top-2.5 left-2.5 px-2 py-1 rounded-lg border text-xs font-display-space font-bold tabular-nums shadow-sm ${
              rank <= 3
                ? 'bg-[#EF3038] text-white border-[#B92335]'
                : 'bg-[#090B14]/85 text-white border-[#303342]'
            }`}
          >
            #{String(rank).padStart(2, '0')}
          </div>
        )}

        {anime.averageScore !== null && (
          <div className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#090B14]/85 text-white border border-[#303342] text-xs font-display-space font-bold tabular-nums">
            <Star
              className="h-3 w-3 text-[#EF3038] fill-[#EF3038]"
              aria-hidden="true"
            />
            <span>{anime.averageScore}%</span>
          </div>
        )}
      </button>

      <div className="flex flex-1 flex-col justify-between p-3.5 sm:p-4">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-[#52576B] dark:text-[#A7A9B8] truncate">
            {anime.formatLabel} <span aria-hidden="true">·</span>{' '}
            <span className="font-display-space tabular-nums">
              {episodeLabel}
            </span>
          </p>

          <h3 className="font-display-space font-bold text-sm sm:text-base leading-snug text-[#090B14] dark:text-white line-clamp-2">
            <button
              type="button"
              onClick={() => onSelect(anime)}
              className="text-left hover:text-[#B92335] dark:hover:text-[#EF3038] transition-colors"
            >
              {anime.title.display}
            </button>
          </h3>

          <p className="inline-flex items-center gap-1.5 text-[11px] text-[#52576B] dark:text-[#A7A9B8] truncate max-w-full">
            {anime.nextAiringEpisode && anime.status === 'RELEASING' ? (
              <Clock
                className="h-3 w-3 text-[#EF3038] shrink-0"
                aria-hidden="true"
              />
            ) : (
              <Calendar
                className="h-3 w-3 text-[#52576B] dark:text-[#A7A9B8] shrink-0"
                aria-hidden="true"
              />
            )}
            <span className="truncate">{secondarySubtitle}</span>
          </p>

          {anime.genres.length > 0 && (
            <p className="text-[11px] font-medium text-[#52576B]/90 dark:text-[#A7A9B8]/90 truncate">
              {anime.genres.slice(0, 2).join(' · ')}
            </p>
          )}

          {editorialOverride &&
            (editorialOverride.isFeatured ||
              editorialOverride.isSeasonalHighlight ||
              editorialOverride.editorialNote) && (
              <p className="text-[11px] font-semibold text-[#B92335] dark:text-[#EF3038] truncate">
                {editorialOverride.isFeatured
                  ? 'ATA Featured'
                  : editorialOverride.isSeasonalHighlight
                    ? 'Seasonal Pick'
                    : editorialOverride.editorialNote}
              </p>
            )}
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#D4D7E2]/70 dark:border-[#303342] flex items-center justify-between gap-2">
          <span
            className={`text-[11px] font-semibold truncate ${
              anime.status === 'RELEASING'
                ? 'text-[#B92335] dark:text-[#EF3038]'
                : 'text-[#52576B] dark:text-[#A7A9B8]'
            }`}
          >
            {anime.statusLabel}
          </span>

          <button
            type="button"
            onClick={() => onSelect(anime)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-lg hover:bg-[#EF3038] hover:text-white hover:border-[#B92335] transition-colors duration-150 whitespace-nowrap"
          >
            <BookOpen className="h-3 w-3" aria-hidden="true" />
            <span>Details</span>
          </button>
        </div>
      </div>
    </article>
  );
};
