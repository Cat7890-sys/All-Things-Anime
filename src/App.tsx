/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { TrendingSidebarSection } from './components/TrendingSidebarSection';
import { PublicProfileModal } from './components/social/PublicProfileModal';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './layout/AppShell';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { CommunitiesPage } from './pages/CommunitiesPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { HomePage } from './pages/HomePage';
import { MessagesPage } from './pages/MessagesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotificationToastContainer } from './components/notifications/NotificationToastContainer';
import { subscribeToUserNotifications } from './services/notifications/notificationService';
import type { NotificationRouteTarget } from './services/notifications/notificationRoutingService';
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
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);
  const [pendingCommunityTarget, setPendingCommunityTarget] = useState<{
    communityId: string;
    postId?: string;
    tab?: 'discussions' | 'rules' | 'members' | 'manage';
  } | null>(null);
  const [pendingMessagesTarget, setPendingMessagesTarget] = useState<{
    conversationId?: string;
    tab?: 'chats' | 'requests' | 'groups';
  } | null>(null);
  const [deepLinkedProfileId, setDeepLinkedProfileId] = useState<string | null>(
    null
  );
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

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

  // Global unread notifications badge count
  useEffect(() => {
    if (!firebaseUser) {
      setUnreadNotificationsCount(0);
      return;
    }

    const unsubscribe = subscribeToUserNotifications(
      firebaseUser.uid,
      50,
      (result) => {
        setUnreadNotificationsCount(result.unreadCount);
      },
      () => {}
    );

    return () => {
      unsubscribe();
    };
  }, [firebaseUser]);

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

  const handleConsumeInitialPost = useCallback(() => {
    setPendingPostId(null);
  }, []);

  const handleConsumeCommunityTarget = useCallback(() => {
    setPendingCommunityTarget(null);
  }, []);

  const handleConsumeMessagesTarget = useCallback(() => {
    setPendingMessagesTarget(null);
  }, []);

  const handleSelectRouteTarget = useCallback(
    (routeInfo: NotificationRouteTarget) => {
      const { destination, params } = routeInfo;

      if (destination === 'profile') {
        if (params?.profileId && params.profileId !== firebaseUser?.uid) {
          setDeepLinkedProfileId(params.profileId);
          return;
        }
        handleSelectDestination('profile');
        return;
      }

      setDeepLinkedProfileId(null);

      if (destination === 'home') {
        setPendingPostId(params?.postId || null);
        handleSelectDestination('home');
        return;
      }

      if (destination === 'communities') {
        setPendingCommunityTarget(
          params?.communityId
            ? {
                communityId: params.communityId,
                postId: params.postId,
                tab: params.communityTab,
              }
            : null
        );
        handleSelectDestination('communities');
        return;
      }

      if (destination === 'messages') {
        setPendingMessagesTarget(
          params?.conversationId || params?.messagesTab
            ? {
                conversationId: params.conversationId,
                tab: params.messagesTab,
              }
            : null
        );
        handleSelectDestination('messages');
      }
    },
    [firebaseUser?.uid, handleSelectDestination]
  );

  return (
    <AppShell
      activeDestination={activeDestination}
      onSelectDestination={handleSelectDestination}
      onSelectRouteTarget={handleSelectRouteTarget}
      onOpenAuth={handleOpenAuth}
      unreadMessagesCount={unreadMessagesCount}
      unreadNotificationsCount={unreadNotificationsCount}
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
          initialPostId={pendingPostId}
          onConsumeInitialPost={handleConsumeInitialPost}
          onNavigate={handleSelectDestination}
          onOpenAuth={handleOpenAuth}
          onStartDirectMessage={handleStartDirectMessage}
        />
      ) : activeDestination === 'discover' ? (
        <DiscoverPage />
      ) : activeDestination === 'communities' ? (
        <CommunitiesPage
          initialCommunityTarget={pendingCommunityTarget}
          onConsumeCommunityTarget={handleConsumeCommunityTarget}
          onOpenAuth={handleOpenAuth}
          onNavigateProfile={() => handleSelectDestination('profile')}
          onStartDirectMessage={handleStartDirectMessage}
        />
      ) : activeDestination === 'messages' ? (
        <MessagesPage
          initialDirectTargetUserId={pendingDirectMessageUserId}
          onConsumeDirectTarget={handleConsumeDirectTarget}
          initialRouteTarget={pendingMessagesTarget}
          onConsumeRouteTarget={handleConsumeMessagesTarget}
          onOpenAuth={handleOpenAuth}
          onNavigateProfile={() => handleSelectDestination('profile')}
        />
      ) : activeDestination === 'notifications' ? (
        <NotificationsPage
          currentUserId={firebaseUser?.uid}
          onNavigateDestination={handleSelectDestination}
          onSelectRouteTarget={handleSelectRouteTarget}
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
        onSelectRouteTarget={handleSelectRouteTarget}
      />
      <PublicProfileModal
        targetUserId={deepLinkedProfileId}
        onClose={() => setDeepLinkedProfileId(null)}
        onOpenAuth={handleOpenAuth}
        onStartDirectMessage={(uid) => {
          setDeepLinkedProfileId(null);
          handleStartDirectMessage(uid);
        }}
        onOpenPostDetail={(clickedPost) => {
          setDeepLinkedProfileId(null);
          setPendingPostId(clickedPost.id);
          handleSelectDestination('home');
        }}
      />
    </AppShell>
  );
}
