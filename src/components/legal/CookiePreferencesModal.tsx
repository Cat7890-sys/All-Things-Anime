import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cookie, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  ATA_STORAGE_INVENTORY,
  ATA_TRACKING_AUDIT_DISCLOSURE,
} from '../../services/legal/legalConfig';
import { clearNonEssentialLocalCaches } from '../../services/legal/legalService';

interface CookiePreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCookiePolicy: () => void;
}

export const CookiePreferencesModal: React.FC<CookiePreferencesModalProps> = ({
  isOpen,
  onClose,
  onOpenCookiePolicy,
}) => {
  const [clearedResult, setClearedResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setClearedResult(null);
      return;
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClearCaches = () => {
    const count = clearNonEssentialLocalCaches();
    setClearedResult(
      count > 0
        ? `Cleared ${count} non-essential local preference/cache entries. Your Firebase Authentication sign-in state was preserved.`
        : 'No optional local caches were present to clear.'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ata-storage-prefs-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
          <div className="flex items-center gap-2.5">
            <Cookie className="h-5 w-5 text-[#EF3038] shrink-0" aria-hidden="true" />
            <div>
              <h2
                id="ata-storage-prefs-title"
                className="font-display-space font-bold text-lg text-[#090B14] dark:text-white"
              >
                Browser Storage & Cookie Preferences
              </h2>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Transparent privacy controls — zero advertising trackers
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close browser storage preferences"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white hover:border-[#EF3038] transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#090B14] dark:text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <span>Honest Tracking Audit</span>
          </div>
          <p className="text-xs leading-relaxed text-[#52576B] dark:text-[#D4D7E2]">
            {ATA_TRACKING_AUDIT_DISCLOSURE.summary}
          </p>
        </div>

        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8]">
            Active Storage Categories ({ATA_STORAGE_INVENTORY.length} items)
          </h3>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {ATA_STORAGE_INVENTORY.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#090B14] dark:text-white">
                    {entry.keyOrDatabase}
                  </span>
                  <span className="text-[11px] font-medium text-[#52576B] dark:text-[#A7A9B8]">
                    {entry.category === 'strictly_necessary'
                      ? 'Strictly Necessary'
                      : 'Functional Cache'}
                  </span>
                </div>
                <p className="text-[#52576B] dark:text-[#A7A9B8] leading-relaxed">
                  {entry.purpose}
                </p>
              </div>
            ))}
          </div>
        </div>

        {clearedResult && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 p-3 text-xs text-emerald-800 dark:text-emerald-200"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{clearedResult}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#D4D7E2] dark:border-[#303342]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCookiePolicy();
            }}
            className="text-xs font-semibold text-[#B92335] dark:text-[#EF3038] hover:underline min-h-[44px] px-2"
          >
            Read Full Cookie & Storage Policy
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleClearCaches}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
              <span>Clear Non-Essential Caches</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] hover:bg-[#B92335] transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
