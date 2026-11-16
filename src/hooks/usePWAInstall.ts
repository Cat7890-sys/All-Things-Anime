import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_STORAGE_KEY = 'ata-pwa-install-dismissed-at';
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function detectIOSSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIOSDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === 'MacIntel' &&
      window.navigator.maxTouchPoints > 1);
  if (!isIOSDevice) return false;

  // Exclude Chrome/Firefox/Edge wrappers on iOS that do not expose Add to Home Screen cleanly,
  // while matching Safari itself.
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isSafari;
}

function wasRecentlyDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp)) return false;
    return Date.now() - timestamp < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(detectStandalone);
  const [isIOSSafari, setIsIOSSafari] = useState<boolean>(detectIOSSafari);
  const [isPromptDismissed, setIsPromptDismissed] =
    useState<boolean>(wasRecentlyDismissed);

  useEffect(() => {
    setIsInstalled(detectStandalone());
    setIsIOSSafari(detectIOSSafari());
    setIsPromptDismissed(wasRecentlyDismissed());

    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      try {
        window.localStorage.removeItem(DISMISS_STORAGE_KEY);
      } catch {
        // Ignore storage error
      }
    };

    displayModeQuery.addEventListener?.('change', handleDisplayChange);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      displayModeQuery.removeEventListener?.('change', handleDisplayChange);
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const dismissPrompt = useCallback(() => {
    setIsPromptDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // Ignore storage error
    }
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      setIsInstalled(true);
      return true;
    }
    dismissPrompt();
    return false;
  }, [deferredPrompt, dismissPrompt]);

  // Only expose install capabilities when running on supported browsers and not already installed
  const canPromptChromium = !isInstalled && Boolean(deferredPrompt);
  const canShowIOSInstructions = !isInstalled && !deferredPrompt && isIOSSafari;
  const isInstallSupported = canPromptChromium || canShowIOSInstructions;

  return {
    isInstalled,
    isInstallSupported,
    canPromptChromium,
    canShowIOSInstructions,
    isPromptDismissed,
    promptInstall,
    dismissPrompt,
  };
}
