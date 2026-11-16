import React, { useState } from 'react';
import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface IOSInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IOSInstallGuideModal: React.FC<IOSInstallGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ata-ios-install-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl p-5 sm:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
          <div className="flex items-center gap-2.5">
            <Smartphone
              className="h-5 w-5 text-[#EF3038] shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="font-accent-orbitron text-[10px] font-semibold tracking-wider text-[#B92335] dark:text-[#EF3038] uppercase">
                iPhone &amp; iPad Safari
              </p>
              <h2
                id="ata-ios-install-title"
                className="font-display-space font-bold text-lg text-[#090B14] dark:text-white"
              >
                Install ATA App
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close iOS installation guide"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white hover:border-[#EF3038] transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <ol className="space-y-3 text-xs sm:text-sm text-[#090B14] dark:text-white/90">
          <li className="flex items-start gap-3 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EF3038] text-xs font-bold text-white">
              1
            </span>
            <div className="space-y-1">
              <p className="font-semibold">Tap the Share button in Safari</p>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] flex items-center gap-1.5">
                <Share className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                <span>Located in Safari&apos;s bottom or top toolbar.</span>
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EF3038] text-xs font-bold text-white">
              2
            </span>
            <div className="space-y-1">
              <p className="font-semibold">
                Scroll down and tap &ldquo;Add to Home Screen&rdquo;
              </p>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] flex items-center gap-1.5">
                <PlusSquare
                  className="h-3.5 w-3.5 text-[#EF3038]"
                  aria-hidden="true"
                />
                <span>Look for the square plus icon in the share sheet.</span>
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EF3038] text-xs font-bold text-white">
              3
            </span>
            <div>
              <p className="font-semibold">Tap &ldquo;Add&rdquo; to launch ATA</p>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                ATA opens full-screen from your Home Screen like a native app.
              </p>
            </div>
          </li>
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors"
        >
          Got It
        </button>
      </div>
    </div>
  );
};

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
}) => {
  const {
    isInstalled,
    isInstallSupported,
    canPromptChromium,
    canShowIOSInstructions,
    promptInstall,
  } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled || !isInstallSupported) {
    return null;
  }

  const handleClick = () => {
    if (canPromptChromium) {
      void promptInstall();
    } else if (canShowIOSInstructions) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Install ATA application"
        className={
          compact
            ? 'min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-2.5 rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-xs font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038] transition-colors'
            : 'group w-full flex items-center justify-between gap-2 px-3 py-2 min-h-[40px] rounded-xl bg-[#090B14] border border-[#EF3038]/70 text-xs font-semibold text-white hover:bg-[#EF3038] hover:border-[#B92335] transition-colors duration-150'
        }
      >
        <span className="flex items-center gap-2">
          <Download className="h-3.5 w-3.5 text-[#EF3038] group-hover:text-white" aria-hidden="true" />
          <span>{compact ? 'Install' : 'Install ATA'}</span>
        </span>
        {!compact && (
          <span className="text-[10px] font-medium text-[#A7A9B8]">
            App
          </span>
        )}
      </button>

      <IOSInstallGuideModal
        isOpen={showIOSGuide}
        onClose={() => setShowIOSGuide(false)}
      />
    </>
  );
};

export const PWAInstallBanner: React.FC = () => {
  const {
    isInstalled,
    isInstallSupported,
    canPromptChromium,
    canShowIOSInstructions,
    isPromptDismissed,
    promptInstall,
    dismissPrompt,
  } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled || !isInstallSupported || isPromptDismissed) {
    return null;
  }

  const handleInstallAction = () => {
    if (canPromptChromium) {
      void promptInstall();
    } else if (canShowIOSInstructions) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <aside
        aria-label="Install ATA application prompt"
        className="rounded-2xl bg-white dark:bg-[#171923] border border-[#EF3038]/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 shadow-sm"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-[#090B14] border border-[#303342] flex items-center justify-center">
            <Download className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-display-space font-bold text-sm sm:text-base text-[#090B14] dark:text-white">
              Install All Things Anime
            </p>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] mt-0.5 leading-relaxed">
              {canShowIOSInstructions
                ? 'Add ATA to your iPhone Home Screen via Safari for a full-screen cosmic experience.'
                : 'Launch ATA directly from your Home Screen or desktop dock with standalone navigation.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={dismissPrompt}
            className="px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8] bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:text-[#090B14] dark:hover:text-white transition-colors"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleInstallAction}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{canShowIOSInstructions ? 'How to Install' : 'Install ATA'}</span>
          </button>
        </div>
      </aside>

      <IOSInstallGuideModal
        isOpen={showIOSGuide}
        onClose={() => setShowIOSGuide(false)}
      />
    </>
  );
};
