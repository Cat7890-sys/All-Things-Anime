import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, ExternalLink, Inbox, Settings } from 'lucide-react';
import type { AtaNotification, NavDestinationId } from '../../types';
import { formatRelativeTimestamp } from '../../utils/time';
import { UserAvatar } from '../UserAvatar';
import {
  markNotificationRead,
  subscribeToUserNotifications,
} from '../../services/notifications/notificationService';
import {
  getNotificationRouteInfo,
  type NotificationRouteTarget,
} from '../../services/notifications/notificationRoutingService';

interface NotificationBellProps {
  currentUserId?: string;
  onNavigateDestination: (destination: NavDestinationId) => void;
  onSelectRouteTarget?: (routeInfo: NotificationRouteTarget) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  currentUserId,
  onNavigateDestination,
  onSelectRouteTarget,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AtaNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUserId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const unsubscribe = subscribeToUserNotifications(
      currentUserId,
      15,
      (result) => {
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
      },
      () => {}
    );

    return () => {
      unsubscribe();
    };
  }, [currentUserId]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNotificationClick = async (notif: AtaNotification) => {
    if (!notif.isRead) {
      await markNotificationRead(notif.id);
    }
    setIsOpen(false);
    const routeInfo = getNotificationRouteInfo(notif);
    if (onSelectRouteTarget) {
      onSelectRouteTarget(routeInfo);
    } else {
      onNavigateDestination(routeInfo.destination);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : 'Notifications'
        }
        aria-expanded={isOpen}
        className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-transparent text-[#090B14] dark:text-[#A7A9B8] hover:border-[#D4D7E2] dark:hover:border-[#303342] hover:text-[#090B14] dark:hover:text-white transition-colors duration-150"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} unread notifications`}
            className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#EF3038] text-white text-[9px] font-bold tabular-nums leading-none"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl z-50 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-[#090B14] px-4 py-3.5 border-b border-[#303342] flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <span className="font-accent-orbitron text-[11px] font-semibold tracking-wider text-[#EF3038] uppercase">
                Alerts
              </span>
              <span className="text-xs text-[#A7A9B8] tabular-nums">
                ({unreadCount} unread)
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onNavigateDestination('notifications');
              }}
              className="text-xs font-semibold text-white/90 hover:text-white underline underline-offset-2"
            >
              Open Centre
            </button>
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[#D4D7E2] dark:divide-[#303342]">
            {notifications.length === 0 ? (
              <div className="py-10 px-6 text-center space-y-2">
                <Inbox className="h-8 w-8 text-[#52576B] dark:text-[#A7A9B8] mx-auto" aria-hidden="true" />
                <p className="text-xs font-semibold text-[#090B14] dark:text-white">
                  No notifications yet
                </p>
                <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                  Replies, follows, and community alerts will appear here.
                </p>
              </div>
            ) : (
              notifications.slice(0, 8).map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => void handleNotificationClick(notif)}
                  className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors hover:bg-[#F4F5F8] dark:hover:bg-[#090B14]/60 ${
                    notif.isRead
                      ? 'bg-transparent'
                      : 'bg-[#EF3038]/5 dark:bg-[#EF3038]/10'
                  }`}
                >
                  <UserAvatar
                    displayName={notif.actorDisplayName || 'ATA Member'}
                    avatarUrl={notif.actorAvatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#090B14] dark:text-white truncate">
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-[#52576B] dark:text-[#A7A9B8] shrink-0 tabular-nums">
                        {formatRelativeTimestamp(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] line-clamp-2 leading-snug">
                      {notif.body}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <span className="h-2 w-2 rounded-full bg-[#EF3038] shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="bg-[#F4F5F8] dark:bg-[#090B14] px-4 py-3 border-t border-[#D4D7E2] dark:border-[#303342] flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onNavigateDestination('notifications');
              }}
              className="text-xs font-semibold text-[#B92335] dark:text-[#EF3038] hover:underline flex items-center gap-1.5"
            >
              <span>View all notifications</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
