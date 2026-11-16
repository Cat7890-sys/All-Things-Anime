import React, { useState } from 'react';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';

interface SpoilerGateProps {
  hasSpoiler: boolean;
  spoilerLabel?: string;
  children: React.ReactNode;
  compact?: boolean;
}

export const SpoilerGate: React.FC<SpoilerGateProps> = ({
  hasSpoiler,
  spoilerLabel,
  children,
  compact = false,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);

  if (!hasSpoiler) {
    return <>{children}</>;
  }

  if (!isRevealed) {
    return (
      <div
        className={`rounded-xl border border-[#EF3038]/55 bg-[#F4F5F8] dark:bg-[#090B14] ${
          compact ? 'p-3' : 'p-4'
        } space-y-2.5`}
      >
        <div className="flex items-start gap-2.5">
          <ShieldAlert
            className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-accent-orbitron text-[11px] font-semibold tracking-wider text-[#B92335] dark:text-[#EF3038] uppercase">
              Spoiler Warning
              {spoilerLabel ? ` · ${spoilerLabel}` : ''}
            </p>
            <p className="mt-1 text-xs text-[#52576B] dark:text-[#A7A9B8]">
              This {compact ? 'comment' : 'post'} contains plot details marked
              as a spoiler by the author.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsRevealed(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-lg hover:bg-[#B92335] transition-colors duration-150"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Reveal Spoiler</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-[#EF3038] pl-3">
        <span className="font-accent-orbitron text-[10px] font-semibold tracking-wider text-[#B92335] dark:text-[#EF3038] uppercase">
          Spoiler Revealed{spoilerLabel ? ` · ${spoilerLabel}` : ''}
        </span>
        <button
          type="button"
          onClick={() => setIsRevealed(false)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white transition-colors"
        >
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Hide Spoiler</span>
        </button>
      </div>
      {children}
    </div>
  );
};
