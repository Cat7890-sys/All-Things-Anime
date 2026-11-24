import React, { useEffect, useState } from 'react';
import { AtaLoadingSpinner } from './AtaLoadingSpinner';

interface MangaImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectClassName?: string;
  fallbackTitle?: string;
}

export const MangaImage: React.FC<MangaImageProps> = ({
  src,
  alt,
  className = '',
  aspectClassName = 'aspect-video',
  fallbackTitle = 'ATA Visual Preview',
}) => {
  const hasValidSrc = Boolean(src && src.trim().length > 0);
  const [hasError, setHasError] = useState(!hasValidSrc);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const valid = Boolean(src && src.trim().length > 0);
    setHasError(!valid);
    setIsLoaded(false);
  }, [src]);

  return (
    <div
      className={`relative w-full max-w-full min-w-0 overflow-hidden bg-[#EAECEF] dark:bg-[#090B14] ${aspectClassName} ${className}`}
    >
      {!hasError && hasValidSrc ? (
        <>
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#EAECEF] dark:bg-[#090B14]">
              <AtaLoadingSpinner size="md" label={`Loading ${fallbackTitle}`} />
            </div>
          )}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={`block h-full w-full max-w-full max-h-full object-cover transition-opacity duration-200 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 p-4 text-center cosmic-backdrop-grid bg-[#F4F5F8] dark:bg-[#090B14]">
          <svg
            width="40"
            height="40"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
          >
            <ellipse
              cx="24"
              cy="24"
              rx="18"
              ry="8.5"
              transform="rotate(-26 24 24)"
              stroke="#EF3038"
              strokeWidth="2.5"
            />
            <circle
              cx="24"
              cy="24"
              r="7"
              className="fill-[#090B14] dark:fill-[#171923] stroke-[#090B14] dark:stroke-white"
              strokeWidth="1.8"
            />
          </svg>
          <span className="font-display-space text-xs font-semibold text-[#090B14] dark:text-[#A7A9B8]">
            {fallbackTitle}
          </span>
        </div>
      )}
    </div>
  );
};
