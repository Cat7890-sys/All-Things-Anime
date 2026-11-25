import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, Filter, Inbox, Settings, Trash2, Check, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import type { AtaNotification, NotificationCategory, NavDestinationId } from '../types';
import {
  subscribeToUserNotifications,
  fetchOlderNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  clearDismissedNotifications,
} from '../services/notifications/notificationService';
import {
  getNotificationRouteInfo,
  type NotificationRouteTarget,
} from '../services/notifications/notificationRoutingService';
import { UserAvatar } from '../components/UserAvatar';
import { formatRelativeTimestamp } from '../utils/time';
import { NotificationSettings } from '../components/notifications/NotificationSettings';

interface NotificationsPageProps {
  currentUserId?: string;
  onNavigateDestination: (destination: NavDestinationId) => void;
  onSelectRouteTarget?: (routeInfo: NotificationRouteTarget) => void;
}

type TabMode = 'all' | 'unread' | 'settings';
type CategoryFilter = 'all' | NotificationCategory;

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  currentUserId,
  onNavigateDestination,
  onSelectRouteTarget,
}) => {
  const [notifications, setNotifications] = useState<AtaNotification[]>([]);
  const [olderNotifications, setOlderNotifications] = useState<AtaNotification[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const hasLoadedOlderRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabMode, setTabMode] = useState<TabMode>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setOlderNotifications([]);
    setHasMoreOlder(false);
    hasLoadedOlderRef.current = false;

    if (!currentUserId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToUserNotifications(
      currentUserId,
      50,
      (result) => {
        setNotifications(result.notifications);
        if (!hasLoadedOlderRef.current) {
          setHasMoreOlder(result.notifications.length >= 50);
        }
        setLoading(false);
      },
      (errMessage) => {
        setError(errMessage);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUserId]);

  const allNotifications = useMemo(() => {
    if (olderNotifications.length === 0) return notifications;
    const liveIds = new Set(notifications.map((n) => n.id));
    return [
      ...notifications,
      ...olderNotifications.filter((n) => !liveIds.has(n.id)),
    ];
  }, [notifications, olderNotifications]);

  const unreadCount = useMemo(
    () => allNotifications.filter((n) => !n.isRead).length,
    [allNotifications]
  );

  const handleLoadOlder = async () => {
    if (!currentUserId || loadingOlder) return;
    const lastDated = [...allNotifications]
      .reverse()
      .find((n) => n.createdAt !== null)?.createdAt;
    if (!lastDated) {
      setHasMoreOlder(false);
      return;
    }

    setLoadingOlder(true);
    setError(null);
    try {
      const res = await fetchOlderNotifications(currentUserId, lastDated, 50);
      hasLoadedOlderRef.current = true;
      setOlderNotifications((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const appended = res.notifications.filter((n) => !seen.has(n.id));
        return [...prev, ...appended];
      });
      setHasMoreOlder(res.hasMore);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load older notifications.'
      );
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleNotificationClick = async (notif: AtaNotification) => {
    if (!notif.isRead) {
      await markNotificationRead(notif.id);
      setOlderNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
    }
    const routeInfo = getNotificationRouteInfo(notif);
    if (onSelectRouteTarget) {
      onSelectRouteTarget(routeInfo);
    } else {
      onNavigateDestination(routeInfo.destination);
    }
  };

  const handleMarkAllRead = async () => {
    if (!currentUserId) return;
    setActionLoading(true);
    try {
      await markAllNotificationsRead(currentUserId);
      setOlderNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notifications read.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    try {
      await dismissNotification(notificationId);
      setOlderNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss notification.');
    }
  };

  // Filter notifications
  const filteredNotifications = allNotifications.filter((notif) => {
    if (tabMode === 'unread' && notif.isRead) {
      return false;
    }
    if (categoryFilter !== 'all' && notif.category !== categoryFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#D4D7E2] dark:border-[#303342]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-accent-orbitron text-xs font-bold tracking-widest text-[#EF3038] uppercase">
              Alerts & Activity
            </span>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#EF3038] text-white text-[10px] font-bold tabular-nums">
                {unreadCount} unread
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#090B14] dark:text-white tracking-tight">
            Notification Centre
          </h1>
          <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8]">
            Stay updated with social replies, community activity, and direct messages across ATA.
          </p>
        </div>

        {/* Top actions */}
        {currentUserId && tabMode !== 'settings' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={actionLoading || unreadCount === 0}
              onClick={() => void handleMarkAllRead()}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-xs font-bold text-[#090B14] dark:text-white hover:border-[#EF3038] transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCheck className="h-4 w-4 text-[#EF3038]" />
              <span>Mark all read</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[#D4D7E2] dark:border-[#303342]">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setTabMode('all')}
            className={`pb-3 text-xs font-bold transition-colors border-b-2 -mb-px ${
              tabMode === 'all'
                ? 'border-[#EF3038] text-[#EF3038]'
                : 'border-transparent text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white'
            }`}
          >
            All Activity ({allNotifications.length})
          </button>
          <button
            type="button"
            onClick={() => setTabMode('unread')}
            className={`pb-3 text-xs font-bold transition-colors border-b-2 -mb-px ${
              tabMode === 'unread'
                ? 'border-[#EF3038] text-[#EF3038]'
                : 'border-transparent text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            type="button"
            onClick={() => setTabMode('settings')}
            className={`pb-3 text-xs font-bold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              tabMode === 'settings'
                ? 'border-[#EF3038] text-[#EF3038]'
                : 'border-transparent text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Preferences</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-xl bg-[#EF3038]/10 border border-[#EF3038]/30 text-xs text-[#EF3038] font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content */}
      {tabMode === 'settings' ? (
        <NotificationSettings currentUserId={currentUserId} />
      ) : (
        <div className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: 'all', label: 'All Categories' },
              { id: 'social', label: 'Social' },
              { id: 'followers', label: 'Followers' },
              { id: 'communities', label: 'Communities' },
              { id: 'messaging', label: 'Messages' },
              { id: 'groups', label: 'Groups' },
              { id: 'system', label: 'System' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id as CategoryFilter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                  categoryFilter === cat.id
                    ? 'bg-[#EF3038] text-white shadow-md'
                    : 'bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          {loading ? (
            <div className="py-20 flex justify-center items-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#EF3038]" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-20 px-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-center space-y-3">
              <Inbox className="h-10 w-10 text-[#52576B] dark:text-[#A7A9B8] mx-auto" />
              <p className="text-sm font-bold text-[#090B14] dark:text-white">
                No notifications found
              </p>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] max-w-sm mx-auto">
                {tabMode === 'unread'
                  ? "You've read all your notifications! Check back later or browse community activity."
                  : "When ATA members interact with your posts, comments, or communities, your alerts will appear here."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => void handleNotificationClick(notif)}
                  className={`p-4 rounded-2xl bg-white dark:bg-[#171923] border transition-all duration-150 cursor-pointer flex items-start gap-4 group ${
                    notif.isRead
                      ? 'border-[#D4D7E2] dark:border-[#303342] hover:border-[#090B14] dark:hover:border-white/50'
                      : 'border-[#EF3038]/50 bg-[#EF3038]/5 dark:bg-[#EF3038]/10 hover:border-[#EF3038]'
                  }`}
                >
                  <UserAvatar
                    displayName={notif.actorDisplayName || 'ATA Member'}
                    avatarUrl={notif.actorAvatarUrl}
                    size="md"
                  />

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-[#090B14] dark:text-white group-hover:text-[#EF3038] transition-colors">
                          {notif.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md bg-[#F4F5F8] dark:bg-[#090B14] text-[10px] font-semibold text-[#52576B] dark:text-[#A7A9B8] uppercase tracking-wider">
                          {notif.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] shrink-0 tabular-nums">
                        {formatRelativeTimestamp(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] leading-relaxed">
                      {notif.body}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!notif.isRead && (
                      <span className="h-2.5 w-2.5 rounded-full bg-[#EF3038]" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => void handleDismiss(e, notif.id)}
                      aria-label="Dismiss notification"
                      className="p-1.5 rounded-lg text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038] hover:bg-[#EF3038]/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {hasMoreOlder && (
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    disabled={loadingOlder}
                    onClick={() => void handleLoadOlder()}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-xs font-bold text-[#090B14] dark:text-white hover:border-[#EF3038] transition-colors disabled:opacity-50"
                  >
                    {loadingOlder ? 'Loading older notifications...' : 'Load older notifications'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
