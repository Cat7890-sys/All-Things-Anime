import React from 'react';
import type { AtaLogoSurface, AtaLogoVariant } from '../assets/brandAssets';

interface AtaLogoProps {
  variant?: AtaLogoVariant;
  surface?: AtaLogoSurface;
  showFullTitle?: boolean;
  className?: string;
}

export const AtaLogo: React.FC<AtaLogoProps> = ({
  variant = 'primary',
  surface = 'auto',
  showFullTitle = false,
  className = '',
}) => {
  const isCompact = variant === 'compact';
  const isIconOnly = variant === 'icon-only';
  const isMonochrome =
    variant === 'monochrome' ||
    surface === 'monochrome-dark' ||
    surface === 'monochrome-light';

  const symbolSize = isCompact ? 32 : isIconOnly ? 44 : 40;

  // Color tokens mapped for auto (dark-first), dark, light, and monochrome surfaces
  const containerFillClass =
    surface === 'dark' || surface === 'monochrome-dark'
      ? 'fill-[#090B14]'
      : surface === 'light' || surface === 'monochrome-light'
      ? 'fill-white'
      : 'fill-white dark:fill-[#090B14]';

  const containerStrokeClass =
    surface === 'dark' || surface === 'monochrome-dark'
      ? 'stroke-[#303342]'
      : surface === 'light' || surface === 'monochrome-light'
      ? 'stroke-[#D4D7E2]'
      : 'stroke-[#D4D7E2] dark:stroke-[#303342]';

  const portalCoreStrokeClass =
    surface === 'dark' || surface === 'monochrome-dark'
      ? 'stroke-white'
      : surface === 'light' || surface === 'monochrome-light'
      ? 'stroke-[#090B14]'
      : 'stroke-[#090B14] dark:stroke-white';

  const portalCoreFillClass =
    surface === 'dark' || surface === 'monochrome-dark'
      ? 'fill-[#171923]'
      : surface === 'light' || surface === 'monochrome-light'
      ? 'fill-[#F4F5F8]'
      : 'fill-[#F4F5F8] dark:fill-[#171923]';

  const starFillClass =
    surface === 'dark' || surface === 'monochrome-dark'
      ? 'fill-white'
      : surface === 'light' || surface === 'monochrome-light'
      ? 'fill-[#090B14]'
      : 'fill-[#090B14] dark:fill-white';

  const wordmarkTextClass =
    surface === 'dark' || surface === 'monochrome-dark'
      ? 'text-white'
      : surface === 'light' || surface === 'monochrome-light'
      ? 'text-[#090B14]'
      : 'text-[#090B14] dark:text-white';

  const subtitleTextClass =
    surface === 'dark' || surface === 'monochrome-dark'
      ? 'text-[#A7A9B8]'
      : surface === 'light' || surface === 'monochrome-light'
      ? 'text-[#52576B]'
      : 'text-[#52576B] dark:text-[#A7A9B8]';

  const orbitalColorClass = isMonochrome
    ? surface === 'monochrome-dark' || surface === 'dark'
      ? 'stroke-white'
      : surface === 'monochrome-light' || surface === 'light'
      ? 'stroke-[#090B14]'
      : 'stroke-[#090B14] dark:stroke-white'
    : 'stroke-[#EF3038]';

  const planetFillClass = isMonochrome
    ? surface === 'monochrome-dark' || surface === 'dark'
      ? 'fill-white'
      : surface === 'monochrome-light' || surface === 'light'
      ? 'fill-[#090B14]'
      : 'fill-[#090B14] dark:fill-white'
    : 'fill-[#EF3038]';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg
        width={symbolSize}
        height={symbolSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Cosmic Rounded App Tile */}
        <rect
          x="2"
          y="2"
          width="44"
          height="44"
          rx="12"
          className={`${containerFillClass} ${containerStrokeClass}`}
          strokeWidth="1.75"
        />

        {/* Subtle Cosmic Guide Ring */}
        <circle
          cx="24"
          cy="24"
          r="15.5"
          className={containerStrokeClass}
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Red Planetary Orbital Ring */}
        <ellipse
          cx="24"
          cy="24"
          rx="17"
          ry="8.2"
          transform="rotate(-26 24 24)"
          className={orbitalColorClass}
          strokeWidth="2.6"
        />

        {/* Abstract Cosmic Portal Core */}
        <circle
          cx="24"
          cy="24"
          r="7.8"
          className={`${portalCoreFillClass} ${portalCoreStrokeClass}`}
          strokeWidth="2"
        />

        {/* 4-Point Cosmic Portal Spark */}
        <path
          d="M24 18.2L25.6 22.4L29.8 24L25.6 25.6L24 29.8L22.4 25.6L18.2 24L22.4 22.4L24 18.2Z"
          className={starFillClass}
        />

        {/* Orbiting Planetary Node */}
        <circle cx="37.5" cy="16.5" r="2.3" className={planetFillClass} />
      </svg>

      {!isIconOnly && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-accent-orbitron font-bold tracking-[0.08em] whitespace-nowrap ${
                isCompact ? 'text-xl' : 'text-2xl'
              } ${wordmarkTextClass}`}
            >
              ATA
            </span>
            {!isMonochrome && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#EF3038] shrink-0"
                aria-hidden="true"
              />
            )}
          </div>
          {showFullTitle && (
            <span
              className={`mt-1 text-[10px] font-semibold tracking-[0.14em] uppercase whitespace-nowrap ${subtitleTextClass}`}
            >
              ALL THINGS ANIME
            </span>
          )}
        </div>
      )}
    </div>
  );
};
