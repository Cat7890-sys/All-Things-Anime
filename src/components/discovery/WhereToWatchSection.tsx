import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import {
  WHERE_TO_WATCH_PENDING_NOTE,
  getExternalWatchProviders,
} from '../../services/discovery/whereToWatchProviders';

export const WhereToWatchSection: React.FC = () => {
  const providers = getExternalWatchProviders();

  return (
    <section
      aria-labelledby="anime-detail-where-to-watch-heading"
      className="space-y-3 pt-3 border-t border-[#D4D7E2] dark:border-[#303342]"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
          <h3
            id="anime-detail-where-to-watch-heading"
            className="font-accent-orbitron text-[10px] font-semibold tracking-wider text-[#52576B] dark:text-[#A7A9B8] uppercase"
          >
            Where to Watch
          </h3>
        </div>
        <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
          {WHERE_TO_WATCH_PENDING_NOTE}
        </p>
      </div>

      <div className="space-y-2">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="p-3 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                aria-hidden="true"
                className="h-9 w-9 shrink-0 rounded-lg bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] flex items-center justify-center font-display-space text-xs font-bold text-[#090B14] dark:text-white tracking-tight"
              >
                {provider.shortCode}
              </span>
              <div className="min-w-0">
                <p className="font-display-space text-sm font-bold text-[#090B14] dark:text-white truncate">
                  {provider.name}
                </p>
                <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] truncate">
                  {provider.domainLabel}
                </p>
              </div>
            </div>

            <a
              href={provider.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit Website for ${provider.name} (opens in a new tab)`}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white hover:bg-[#EF3038] hover:text-white hover:border-[#B92335] dark:hover:bg-[#EF3038] dark:hover:border-[#B92335] transition-colors whitespace-nowrap shrink-0"
            >
              <span>Visit Website</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
};
