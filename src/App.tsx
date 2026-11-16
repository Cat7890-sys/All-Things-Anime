/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { TrendingSidebarSection } from './components/TrendingSidebarSection';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './layout/AppShell';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { CommunitiesPage } from './pages/CommunitiesPage';
import { HomePage } from './pages/HomePage';
import { MessagesPage } from './pages/MessagesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotificationToastContainer } from './components/notifications/NotificationToastContainer';
import { initializeMessagingNotificationBridge } from './services/notifications/notificationEventService';
import { subscribeToUserMemberStates } from './services/messaging/conversationService';
import { subscribeToMessageSettings } from './services/messaging/messagingSettingsService';
import { publishOwnPresence } from './services/messaging/presenceService';
import { sampleContentService } from './services/sampleContentService';
import type {
  AuthViewMode,
  CommunityHighlight,
  DiscoverySeriesItem,
  DiscussionThread,
  NavDestinationId,
  TrendingAnimeItem,
} from './types';

export default function App() {
  const { firebaseUser } = useAuth();
  const [activeDestination, setActiveDestination] =
    useState<NavDestinationId>('home');
  const [authMode, setAuthMode] = useState<AuthViewMode>('login');
  const [pendingDirectMessageUserId, setPendingDirectMessageUserId] = useState<
    string | null
  >(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  const [discussions, setDiscussions] = useState<DiscussionThread[]>([]);
  const [featuredSeries, setFeaturedSeries] = useState<DiscoverySeriesItem[]>(
    []
  );
  const [trendingAnime, setTrendingAnime] = useState<TrendingAnimeItem[]>([]);
  const [communities, setCommunities] = useState<CommunityHighlight[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadDemonstrationContent() {
      const [discRes, seriesRes, trendingRes, commRes] = await Promise.all([
        sampleContentService.getSampleDiscussions('All'),
        sampleContentService.getFeaturedSeries(),
        sampleContentService.getTrendingAnime(),
        sampleContentService.getCommunityHighlights(),
      ]);

      if (!isMounted) return;
      setDiscussions(discRes.data);
      setFeaturedSeries(seriesRes.data);
      setTrendingAnime(trendingRes.data);
      setCommunities(commRes.data);
    }

    void loadDemonstrationContent();

    return () => {
      isMounted = false;
    };
  }, []);

  // Global unread message count + conservative visibility-aware presence heartbeat
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setUnreadMessagesCount(0);
      return;
    }

    const uid = firebaseUser.uid;
    let onlineStatusVisible = true;

    const unsubMembers = subscribeToUserMemberStates(uid, (states) => {
      const total = Object.values(states).reduce((sum, member) => {
        if (member.archived) return sum;
        return sum + (member.unreadCount || 0);
      }, 0);
      setUnreadMessagesCount(total);
    });

    const unsubSettings = subscribeToMessageSettings(uid, (settings) => {
      onlineStatusVisible = settings.onlineStatusVisible;
      const status =
        document.visibilityState === 'visible' ? 'online' : 'away';
      void publishOwnPresence(uid, status, onlineStatusVisible);
    });

    const syncPresence = () => {
      const status =
        document.visibilityState === 'visible' ? 'online' : 'away';
      void publishOwnPresence(uid, status, onlineStatusVisible);
    };

    syncPresence();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible' && onlineStatusVisible) {
        void publishOwnPresence(uid, 'online', true);
      }
    }, 3 * 60 * 1000);

    const handleVisibility = () => syncPresence();
    const handlePageHide = () => {
      void publishOwnPresence(uid, 'away', onlineStatusVisible);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      void publishOwnPresence(uid, 'away', onlineStatusVisible);
      unsubMembers();
      unsubSettings();
    };
  }, [firebaseUser]);

  // Initialize messaging notification bridge
  useEffect(() => {
    const unsubBridge = initializeMessagingNotificationBridge();
    return () => {
      unsubBridge();
    };
  }, []);

  const handleSelectDestination = useCallback((destination: NavDestinationId) => {
    setActiveDestination(destination);
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, []);

  const handleOpenAuth = useCallback(
    (mode: AuthViewMode) => {
      setAuthMode(mode);
      handleSelectDestination('profile');
    },
    [handleSelectDestination]
  );

  const handleStartDirectMessage = useCallback(
    (targetUserId: string) => {
      setPendingDirectMessageUserId(targetUserId);
      handleSelectDestination('messages');
    },
    [handleSelectDestination]
  );

  const handleConsumeDirectTarget = useCallback(() => {
    setPendingDirectMessageUserId(null);
  }, []);

  return (
    <AppShell
      activeDestination={activeDestination}
      onSelectDestination={handleSelectDestination}
      onOpenAuth={handleOpenAuth}
      unreadMessagesCount={unreadMessagesCount}
      rightSidebar={
        <TrendingSidebarSection
          trending={trendingAnime}
          communities={communities}
          onNavigateCommunities={() => handleSelectDestination('communities')}
          onNavigateDiscover={() => handleSelectDestination('discover')}
        />
      }
    >
      {activeDestination === 'home' ? (
        <HomePage
          discussions={discussions}
          featuredSeries={featuredSeries}
          onNavigate={handleSelectDestination}
          onOpenAuth={handleOpenAuth}
          onStartDirectMessage={handleStartDirectMessage}
        />
      ) : activeDestination === 'communities' ? (
        <CommunitiesPage
          onOpenAuth={handleOpenAuth}
          onNavigateProfile={() => handleSelectDestination('profile')}
          onStartDirectMessage={handleStartDirectMessage}
        />
      ) : activeDestination === 'messages' ? (
        <MessagesPage
          initialDirectTargetUserId={pendingDirectMessageUserId}
          onConsumeDirectTarget={handleConsumeDirectTarget}
          onOpenAuth={handleOpenAuth}
          onNavigateProfile={() => handleSelectDestination('profile')}
        />
      ) : activeDestination === 'notifications' ? (
        <NotificationsPage
          currentUserId={firebaseUser?.uid}
          onNavigateDestination={handleSelectDestination}
        />
      ) : activeDestination === 'profile' ? (
        <ProfilePage
          initialAuthMode={authMode}
          onStartDirectMessage={handleStartDirectMessage}
        />
      ) : (
        <ComingSoonPage
          destinationId={activeDestination}
          onReturnHome={() => handleSelectDestination('home')}
        />
      )}
      <NotificationToastContainer
        currentUserId={firebaseUser?.uid}
        onNavigateDestination={handleSelectDestination}
      />
    </AppShell>
  );
}
