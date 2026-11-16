import React from 'react';
import { ArrowDownRight, Compass } from 'lucide-react';
import { ATA_BRAND, WELCOME_BANNER_IMAGE } from '../assets/sampleData';
import { MangaImage } from './MangaImage';

interface WelcomeSectionProps {
  onExploreDiscussions: () => void;
  onExploreDiscovery: () => void;
}

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({
  onExploreDiscussions,
  onExploreDiscovery,
}) => {
  return (
    <section
      aria-labelledby="ata-welcome-heading"
      className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl overflow-hidden shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.45)]"
    >
      {/* Cosmic Hero Visual Frame */}
      <div className="relative border-b border-[#D4D7E2] dark:border-[#303342]">
        <MangaImage
          src={WELCOME_BANNER_IMAGE}
          alt="Futuristic cosmic anime illustration of a night skyline beneath a crimson planetary orbital ring and geometric portal."
          aspectClassName="aspect-[16/9] sm:aspect-[21/9]"
          fallbackTitle="ATA — One Universe. Infinite Opinions."
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#090B14]/95 via-[#090B14]/55 to-transparent"
          aria-hidden="true"
        />

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 text-white">
          <p className="font-accent-orbitron text-[11px] sm:text-xs font-semibold tracking-[0.12em] text-[#A7A9B8] uppercase">
            ATA — ALL THINGS ANIME <span aria-hidden="true">·</span>{' '}
            <span className="text-white">{ATA_BRAND.foundationLabel}</span>
          </p>
          <h1
            id="ata-welcome-heading"
            className="mt-1.5 font-display-space font-bold text-3xl sm:text-5xl tracking-tight leading-[1.06] text-white [text-wrap:balance]"
          >
            {ATA_BRAND.tagline}
          </h1>
        </div>
      </div>

      {/* Editorial Introduction & Action Row */}
      <div className="p-5 sm:p-6 cosmic-backdrop-grid">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm sm:text-base leading-relaxed text-[#090B14] dark:text-white/95">
              A modern, cosmic social home built for anime fans to debate
              episodes, unpack animation craft, discover new series, and connect
              through dedicated communities.
            </p>
            <p className="mt-2 text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Interface Preview <span aria-hidden="true">·</span> Feeds,
              discussions, and series entries below use original demonstration
              content while backend services remain unlinked.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onExploreDiscussions}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors duration-150 whitespace-nowrap"
            >
              <span>Sample Discussions</span>
              <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onExploreDiscovery}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] dark:hover:border-[#EF3038] transition-colors duration-150 whitespace-nowrap"
            >
              <Compass
                className="h-4 w-4 text-[#EF3038]"
                aria-hidden="true"
              />
              <span>Anime Discovery</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
