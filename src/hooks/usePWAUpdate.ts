import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export function usePWAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissedForSession, setDismissedForSession] = useState(false);
  const updateFnRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(
    null
  );

  useEffect(() => {
    // Production-only service worker registration
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
      return;
    }

    let intervalId: number | undefined;

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setUpdateAvailable(true);
        setDismissedForSession(false);
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        // Periodically check for updated service worker in the background
        intervalId = window.setInterval(() => {
          if (navigator.onLine) {
            void registration.update();
          }
        }, 60 * 60 * 1000);
      },
      onRegisterError(error) {
        console.error('ATA service worker registration error:', error);
      },
    });

    updateFnRef.current = updateSW;

    return () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    if (!updateFnRef.current || isUpdating) return;
    setIsUpdating(true);
    try {
      await updateFnRef.current(true);
    } catch {
      setIsUpdating(false);
    }
  }, [isUpdating]);

  const dismissUpdateBanner = useCallback(() => {
    setDismissedForSession(true);
  }, []);

  return {
    updateAvailable: updateAvailable && !dismissedForSession,
    isUpdating,
    applyUpdate,
    dismissUpdateBanner,
  };
}
