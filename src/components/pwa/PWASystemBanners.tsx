import React from 'react';
import { RefreshCw, Sparkles, Wifi, WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { usePWAUpdate } from '../../hooks/usePWAUpdate';

export const PWASystemBanners: React.FC = () => {
  const { isOnline, justReconnected } = useOnlineStatus();
  const { updateAvailable, isUpdating, applyUpdate, dismissUpdateBanner } =
    usePWAUpdate();

  if (isOnline && !justReconnected && !updateAvailable) {
    return null;
  }

  return (
    <div className="space-y-2.5" aria-live="polite">
      {/* Update Available Prompt (non-disruptive, user-confirmed refresh) */}
      {updateAvailable && (
        <div
          role="status"
          className="rounded-2xl bg-[#171923] text-white border border-[#EF3038] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles
              className="h-4 w-4 text-[#EF3038] shrink-0"
              aria-hidden="true"
            />
            <p className="text-xs sm:text-sm font-medium">
              A new version of <strong className="font-display-space">ATA</strong>{' '}
              is available.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => void applyUpdate()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[38px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-60 transition-colors"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isUpdating ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isUpdating ? 'Updating...' : 'Update Now'}</span>
            </button>

            <button
              type="button"
              onClick={dismissUpdateBanner}
              aria-label="Dismiss update notification"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#303342] bg-[#090B14] text-[#A7A9B8] hover:text-white hover:border-[#EF3038]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Offline Status Banner */}
      {!isOnline && (
        <div
          role="status"
          className="rounded-2xl bg-white dark:bg-[#171923] border border-[#EF3038] px-4 py-3 flex items-start gap-2.5 text-xs sm:text-sm text-[#090B14] dark:text-white"
        >
          <WifiOff
            className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">
              You are offline · App shell active
            </p>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] mt-0.5">
              Live community feeds, posting, reactions, comments, following, and
              account sign-in require an active internet connection and will not
              sync offline.
            </p>
          </div>
        </div>
      )}

      {/* Reconnection Confirmation */}
      {isOnline && justReconnected && (
        <div
          role="status"
          className="rounded-2xl bg-emerald-500/10 border border-emerald-500/50 px-4 py-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300"
        >
          <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Connection restored · Live ATA features are back online.</span>
        </div>
      )}
    </div>
  );
};
