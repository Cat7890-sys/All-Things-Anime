import React, { useEffect, useState, useRef } from 'react';
import type { AtaNotification, NavDestinationId } from '../../types';
import { subscribeToUserNotifications, markNotificationRead } from '../../services/notifications/notificationService';
import { subscribeToNotificationSettings } from '../../services/notifications/notificationSettingsService';
import { isQuietHoursActive } from '../../services/notifications/notificationPreferenceService';
import { getNotificationRouteInfo } from '../../services/notifications/notificationRoutingService';
import { NotificationToast } from './NotificationToast';

interface NotificationToastContainerProps {
  currentUserId?: string;
  onNavigateDestination: (destination: NavDestinationId) => void;
  onSelectRouteTarget?: (routeInfo: { destination: NavDestinationId; params?: Record<string, string> }) => void;
}

export const NotificationToastContainer: React.FC<NotificationToastContainerProps> = ({
  currentUserId,
  onNavigateDestination,
  onSelectRouteTarget,
}) => {
  const [toasts, setToasts] = useState<AtaNotification[]>([]);
  const [popupEnabled, setPopupEnabled] = useState(true);
  const [quietHoursActive, setQuietHoursActive] = useState(false);
  const lastSeenIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (!currentUserId) {
      setToasts([]);
      return;
    }

    const unsubSettings = subscribeToNotificationSettings(
      currentUserId,
      (settings) => {
        setPopupEnabled(settings.popupEnabled);
        setQuietHoursActive(isQuietHoursActive(settings));
      },
      () => {}
    );

    const unsubNotifs = subscribeToUserNotifications(
      currentUserId,
      10,
      (result) => {
        const latest = result.notifications[0];
        if (!latest) {
          isInitialLoadRef.current = false;
          return;
        }

        if (isInitialLoadRef.current) {
          lastSeenIdRef.current = latest.id;
          isInitialLoadRef.current = false;
          return;
        }

        // If a truly new notification arrived
        if (latest.id !== lastSeenIdRef.current) {
          lastSeenIdRef.current = latest.id;

          // Check if unread and not quiet hours / popup enabled
          if (!latest.isRead && popupEnabled && !quietHoursActive) {
            setToasts((prev) => {
              // Avoid duplicates
              if (prev.some((t) => t.id === latest.id)) return prev;
              return [latest, ...prev].slice(0, 4);
            });
          }
        }
      },
      () => {}
    );

    return () => {
      unsubSettings();
      unsubNotifs();
    };
  }, [currentUserId, popupEnabled, quietHoursActive]);

  const handleCloseToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToastClick = async (notif: AtaNotification) => {
    handleCloseToast(notif.id);
    if (!notif.isRead) {
      await markNotificationRead(notif.id);
    }
    const routeInfo = getNotificationRouteInfo(notif);
    if (onSelectRouteTarget) {
      onSelectRouteTarget(routeInfo);
    } else {
      onNavigateDestination(routeInfo.destination);
    }
  };

  if (!popupEnabled || quietHoursActive || toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full px-4 sm:px-0"
    >
      {toasts.map((toast) => (
        <NotificationToast
          key={toast.id}
          notification={toast}
          onClose={handleCloseToast}
          onClick={handleToastClick}
        />
      ))}
    </div>
  );
};
