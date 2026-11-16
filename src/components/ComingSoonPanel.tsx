import React from 'react';
import { ArrowLeft, Layers } from 'lucide-react';
import type { ComingSoonFeatureSpec } from '../types';
import { AtaLogo } from './AtaLogo';

interface ComingSoonPanelProps {
  spec: ComingSoonFeatureSpec;
  onReturnHome: () => void;
}

export const ComingSoonPanel: React.FC<ComingSoonPanelProps> = ({
  spec,
  onReturnHome,
}) => {
  return (
    <section
      aria-labelledby={`coming-soon-${spec.id}`}
      className="space-y-6"
    >
      {/* Cosmic Feature Preview Card */}
      <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl overflow-hidden shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.45)]">
        <div className="relative bg-[#090B14] text-white p-6 sm:p-8 border-b border-[#303342] overflow-hidden">
          {/* Subtle Cosmic Orbital Arc */}
          <svg
            className="pointer-events-none absolute -right-14 -top-14 h-56 w-56 opacity-25"
            viewBox="0 0 200 200"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="100" cy="100" r="82" stroke="#303342" strokeWidth="1.5" />
            <ellipse
              cx="100"
              cy="100"
              rx="88"
              ry="38"
              transform="rotate(-24 100 100)"
              stroke="#EF3038"
              strokeWidth="2.5"
            />
          </svg>

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] text-[#EF3038] uppercase">
                Foundation Preview <span aria-hidden="true">·</span> Section Not
                Active Yet
              </p>
              <h1
                id={`coming-soon-${spec.id}`}
                className="mt-1.5 font-display-space font-bold text-3xl sm:text-4xl text-white [text-wrap:balance]"
              >
                {spec.title}
              </h1>
              <p className="mt-1.5 text-sm text-[#A7A9B8]">{spec.subtitle}</p>
            </div>
            <div className="shrink-0 self-start sm:self-center">
              <AtaLogo variant="compact" surface="dark" />
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <p className="text-sm sm:text-base leading-relaxed text-[#090B14] dark:text-white/90 max-w-2xl">
            {spec.overview}
          </p>

          {/* Planned Capabilities Grid */}
          <div>
            <div className="flex items-center gap-2 border-b border-[#D4D7E2] dark:border-[#303342] pb-2.5 mb-4">
              <Layers
                className="h-4 w-4 text-[#EF3038]"
                aria-hidden="true"
              />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#090B14] dark:text-white">
                Planned Capabilities for Future Builds
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {spec.plannedCapabilities.map((cap) => (
                <div
                  key={cap.index}
                  className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 flex flex-col justify-between"
                >
                  <div>
                    <span className="font-display-space font-bold text-2xl text-[#B92335] dark:text-[#EF3038] tabular-nums">
                      {cap.index}
                    </span>
                    <h3 className="mt-1.5 font-display-space text-sm font-bold text-[#090B14] dark:text-white">
                      {cap.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#52576B] dark:text-[#A7A9B8]">
                      {cap.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Honest Build 01.1 Status & Return Action */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-[#D4D7E2] dark:border-[#303342] pt-5">
            <p className="text-xs leading-relaxed text-[#52576B] dark:text-[#A7A9B8] max-w-xl">
              {spec.milestoneNote}
            </p>
            <button
              type="button"
              onClick={onReturnHome}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors duration-150 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Home / Feed</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
