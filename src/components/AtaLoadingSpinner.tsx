import React from 'react';

interface AtaLoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

const SIZE_MAP = {
  sm: 24,
  md: 40,
  lg: 56,
} as const;

export const AtaLoadingSpinner: React.FC<AtaLoadingSpinnerProps> = ({
  size = 'md',
  label = 'Loading cosmic portal',
  className = '',
}) => {
  const px = SIZE_MAP[size];

  return (
    <div
      role="status"
      aria-label={label}
      className={`inline-flex flex-col items-center justify-center gap-2 ${className}`}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Subtle Portal Track */}
        <circle
          cx="24"
          cy="24"
          r="18"
          className="stroke-[#D4D7E2] dark:stroke-[#303342]"
          strokeWidth="2"
        />

        {/* Orbiting Planetary Arc */}
        <g className="origin-center ata-orbit-spin">
          <path
            d="M24 6 A18 18 0 0 1 42 24"
            stroke="#EF3038"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <circle cx="42" cy="24" r="2.8" fill="#EF3038" />
        </g>

        {/* Inner Cosmic Core */}
        <circle
          cx="24"
          cy="24"
          r="7"
          className="fill-[#090B14] dark:fill-[#171923] stroke-[#090B14] dark:stroke-white"
          strokeWidth="1.5"
        />
        <path
          d="M24 19.5L25.2 22.8L28.5 24L25.2 25.2L24 28.5L22.8 25.2L19.5 24L22.8 22.8L24 19.5Z"
          className="fill-white"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
};
