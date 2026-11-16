import React, { useState } from 'react';
import { ArrowRight, BookOpen, X } from 'lucide-react';
import type { DiscoverySeriesItem } from '../types';
import { MangaImage } from './MangaImage';

interface AnimeDiscoveryAreaProps {
  series: DiscoverySeriesItem[];
  onOpenDiscoverPage: () => void;
}

export const AnimeDiscoveryArea: React.FC<AnimeDiscoveryAreaProps> = ({
  series,
  onOpenDiscoverPage,
}) => {
  const [selectedSeries, setSelectedSeries] =
    useState<DiscoverySeriesItem | null>(null);

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
            Demonstration Catalogue <span aria-hidden="true">·</span> Original
            Sample Titles
          </p>
          <h2
            id="anime-discovery-heading"
            className="font-display-space font-bold text-2xl sm:text-3xl text-[#090B14] dark:text-white mt-1"
          >
            Anime Discovery Preview
          </h2>
        </div>

        <button
          type="button"
          onClick={onOpenDiscoverPage}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-lg hover:border-[#EF3038] transition-colors duration-150 whitespace-nowrap"
        >
          <span>Full Discover Roadmap</span>
          <ArrowRight className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
        </button>
      </div>

      {/* 3-Column Original Sample Series Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {series.map((item) => (
          <article
            key={item.id}
            className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl flex flex-col overflow-hidden transition-colors duration-150 hover:border-[#EF3038]/70"
          >
            <div className="border-b border-[#D4D7E2] dark:border-[#303342]">
              <MangaImage
                src={item.coverImageUrl}
                alt={item.coverAlt}
                aspectClassName="aspect-[3/4]"
                fallbackTitle={item.title}
              />
            </div>

            <div className="flex flex-1 flex-col justify-between p-4">
              <div>
                <p className="text-xs font-medium text-[#52576B] dark:text-[#A7A9B8]">
                  {item.genre} <span aria-hidden="true">·</span>{' '}
                  <span className="font-display-space tabular-nums">
                    {item.episodeCount} Eps
                  </span>
                </p>
                <h3 className="mt-1.5 font-display-space font-bold text-lg sm:text-xl leading-tight text-[#090B14] dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#52576B] dark:text-[#A7A9B8] line-clamp-3">
                  {item.synopsis}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#D4D7E2]/70 dark:border-[#303342] flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-[#52576B] dark:text-[#A7A9B8]">
                  {item.originalTitleNote}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSeries(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-lg hover:bg-[#EF3038] hover:text-white hover:border-[#B92335] transition-colors duration-150 whitespace-nowrap"
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Details</span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Series Sample Detail Modal */}
      {selectedSeries && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="series-detail-modal-title"
          onClick={() => setSelectedSeries(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-1 sm:grid-cols-5">
              <div className="sm:col-span-2 border-b sm:border-b-0 sm:border-r border-[#D4D7E2] dark:border-[#303342]">
                <MangaImage
                  src={selectedSeries.coverImageUrl}
                  alt={selectedSeries.coverAlt}
                  aspectClassName="aspect-[3/4] sm:h-full"
                  fallbackTitle={selectedSeries.title}
                />
              </div>

              <div className="sm:col-span-3 p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-accent-orbitron text-[11px] font-semibold tracking-wider text-[#B92335] dark:text-[#EF3038] uppercase">
                        {selectedSeries.originalTitleNote}
                      </p>
                      <h3
                        id="series-detail-modal-title"
                        className="mt-1 font-display-space font-bold text-2xl text-[#090B14] dark:text-white"
                      >
                        {selectedSeries.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSeries(null)}
                      aria-label="Close series preview"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white hover:border-[#EF3038] transition-colors"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <dl className="mt-3.5 grid grid-cols-2 gap-2.5 border-y border-[#D4D7E2] dark:border-[#303342] py-3 text-xs">
                    <div>
                      <dt className="text-[#52576B] dark:text-[#A7A9B8]">Genre</dt>
                      <dd className="font-semibold text-[#090B14] dark:text-white mt-0.5">
                        {selectedSeries.genre}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#52576B] dark:text-[#A7A9B8]">
                        Episodes
                      </dt>
                      <dd className="font-display-space font-semibold text-[#090B14] dark:text-white tabular-nums mt-0.5">
                        {selectedSeries.episodeCount} Episodes
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#52576B] dark:text-[#A7A9B8]">
                        Studio Placeholder
                      </dt>
                      <dd className="font-semibold text-[#090B14] dark:text-white mt-0.5">
                        {selectedSeries.studioLabel}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#52576B] dark:text-[#A7A9B8]">
                        Release
                      </dt>
                      <dd className="font-semibold text-[#090B14] dark:text-white mt-0.5">
                        {selectedSeries.releaseSeason}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-3.5 text-sm leading-relaxed text-[#090B14] dark:text-white/90">
                    {selectedSeries.synopsis}
                  </p>
                </div>

                <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3">
                  Demonstration Entry — Watchlist tracking and member ratings
                  will activate in future milestones.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
