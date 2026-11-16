import React, { useState } from 'react';

interface UserAvatarProps {
  displayName: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-20 w-20 text-2xl',
} as const;

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  displayName,
  avatarUrl = '',
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);
  const showImage = Boolean(avatarUrl && avatarUrl.startsWith('https://') && !imageError);

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#EF3038] bg-[#090B14] text-white font-display-space font-bold select-none ${SIZE_CLASSES[size]} ${className}`}
      aria-label={`${displayName} avatar`}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt={displayName}
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <span
            className="pointer-events-none absolute inset-1 rounded-full border border-[#303342]"
            aria-hidden="true"
          />
          <span className="relative z-10">{getInitials(displayName)}</span>
        </>
      )}
    </div>
  );
};
