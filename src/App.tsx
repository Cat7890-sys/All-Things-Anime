/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { AtaLoadingSpinner } from './components/AtaLoadingSpinner';
import { AnnouncementBanner } from './components/layout/AnnouncementBanner';
import { SiteFooter } from './components/layout/SiteFooter';
import { CookiePreferencesModal } from './components/legal/CookiePreferencesModal';
import { CopyrightFeedbackModal } from './components/legal/CopyrightFeedbackModal';
import { NotificationToastContainer } from './components/notifications/NotificationToastContainer';
import { PersonalisationOnboardingModal } from './components/personalisation/PersonalisationOnboardingModal';
import { PublicProfileModal } from './components/social/PublicProfileModal';
import { TrendingSidebarSection } from './components/TrendingSidebarSection';
import { usePreferences } from './context/PreferencesContext';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './layout/AppShell';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AnimeTrackerPage } from './pages/AnimeTrackerPage';
import { CalendarPage } from './pages/CalendarPage';
import { ChallengesHubPage } from './pages/ChallengesHubPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { CommunitiesPage } from './pages/CommunitiesPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { HomePage } from './pages/HomePage';
import { LegalDocumentPage } from './pages/legal/LegalDocumentPage';
import { MessagesPage } from './pages/MessagesPage';
import { MyAnimeDashboardPage } from './pages/MyAnimeDashboardPage';
import { NewsCenterPage } from './pages/NewsCenterPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PersonalisationPage } from './pages/PersonalisationPage';
import { ProfilePage } from './pages/ProfilePage';
import { WatchJourneyPage } from './pages/WatchJourneyPage';
import { verifyAdminSession } from './services/admin/adminService';
import { subscribeToUserMemberStates } from './services/messaging/conversationService';
import { subscribeToMessageSettings } from './services/messaging/messagingSettingsService';
import { publishOwnPresence } from './services/messaging/presenceService';
import type { NotificationRouteTarget } from './services/notifications/notificationRoutingService';
import { subscribeToUserNotifications } from './services/notifications/notificationService';
import { buildAppHref, resolveRouteFromLocation } from './services/routingService';
import { sampleContentService } from './services/sampleContentService';
import type {
  AdminAccountRecord,
  AppRouteView,
  AuthViewMode,
  CommunityHighlight,
  DiscoverySeriesItem,
  DiscussionThread,
  LegalPageSlug,
  NavDestinationId,
  TrendingAnimeItem,
} from './types';

export default function App() {
  const { firebaseUser, profile, isLoadingAuth, profileError } = useAuth();
  const { isOnboardingOpen, setIsOnboardingOpen } = usePreferences();

  const [routeView, setRouteView] = useState<AppRouteView>(() =>
    resolveRouteFromLocation(
      window.location.pathname,
      window.location.hash,
      import.meta.env.BASE_URL
    )
  );
  const [authMode, setAuthMode] = useState<AuthViewMode>('login');
  const [pendingDirectMessageUserId, setPendingDirectMessageUserId] = useState<
    string | null
  >(null);
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);
  const [pendingCommunityTarget, setPendingCommunityTarget] = useState<{
    communityId: string;
    postId?: string;
    tab?: 'discussions' | 'events' | 'rules' | 'members' | 'manage';
  } | null>(null);
  const [pendingMessagesTarget, setPendingMessagesTarget] = useState<{
    conversationId?: string;
    tab?: 'chats' | 'requests' | 'groups';
  } | null>(null);
  const [pendingChallengeId, setPendingChallengeId] = useState<string | null>(
    null
  );
  const [pendingWatchPartyId, setPendingWatchPartyId] = useState<string | null>(
    null
  );
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

  // Build 08B Admin & Compliance UI State
  const [adminSession, setAdminSession] = useState<{
    admin: AdminAccountRecord;
    cloudFunctionsAvailable: boolean;
  } | null>(null);
  const [isCheckingAdminRoute, setIsCheckingAdminRoute] = useState(false);
  const [adminDenialReason, setAdminDenialReason] = useState<string | null>(
    null
  );
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [legalFeedbackTab, setLegalFeedbackTab] = useState<
    'copyright' | 'feedback' | null
  >(null);

  const activeDestination: NavDestinationId =
    routeView.kind === 'destination' ? routeView.destination : 'home';

  const navigateToRoute = useCallback((nextRoute: AppRouteView) => {
    setRouteView(nextRoute);
    const nextHref = buildAppHref(nextRoute, import.meta.env.BASE_URL);
    if (window.location.pathname !== nextHref) {
      window.history.pushState({}, '', nextHref);
    }
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRouteView(
        resolveRouteFromLocation(
          window.location.pathname,
          window.location.hash,
          import.meta.env.BASE_URL
        )
      );
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Verify admin session whenever navigating directly to /admin
  useEffect(() => {
    if (routeView.kind !== 'admin-dashboard') return;
    if (adminSession && firebaseUser && adminSession.admin.uid === firebaseUser.uid) {
      return;
    }
    if (isLoadingAuth) return;

    if (!firebaseUser) {
      setAdminSession(null);
      setAdminDenialReason('Sign in with an authorised administrator account.');
      return;
    }

    let active = true;
    setIsCheckingAdminRoute(true);
    void verifyAdminSession()
      .then((res) => {
        if (!active) return;
        if (res.admin) {
          setAdminSession({
            admin: res.admin,
            cloudFunctionsAvailable: res.cloudFunctionsAvailable,
          });
          setAdminDenialReason(null);
        } else {
          setAdminSession(null);
          setAdminDenialReason(
            res.denialReason ||
              'Your account does not have active ATA administrator permissions.'
          );
        }
      })
      .finally(() => {
        if (active) setIsCheckingAdminRoute(false);
      });

    return () => {
      active = false;
    };
  }, [routeView.kind, adminSession, firebaseUser, isLoadingAuth]);

  useEffect(() => {
    if (!firebaseUser) {
      setAdminSession(null);
    }
  }, [firebaseUser]);

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

  const handleSelectDestination = useCallback(
    (destination: NavDestinationId) => {
      navigateToRoute({ kind: 'destination', destination });
    },
    [navigateToRoute]
  );

  const handleNavigateLegal = useCallback(
    (slug: LegalPageSlug) => {
      navigateToRoute({ kind: 'legal', slug });
    },
    [navigateToRoute]
  );

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
        return;
      }

      if (destination === 'challenges') {
        setPendingChallengeId(params?.challengeId || null);
        setPendingWatchPartyId(params?.watchPartyId || null);
        handleSelectDestination('challenges');
      }
    },
    [firebaseUser?.uid, handleSelectDestination]
  );

  // Isolated Admin Routes (No consumer AppShell / no onboarding modal clutter)
  if (routeView.kind === 'admin-login') {
    return (
      <AdminLoginPage
        initialDenialReason={adminDenialReason}
        onAdminAuthenticated={(verifiedAdmin, cloudAvail) => {
          setAdminSession({
            admin: verifiedAdmin,
            cloudFunctionsAvailable: cloudAvail,
          });
          setAdminDenialReason(null);
          navigateToRoute({ kind: 'admin-dashboard' });
        }}
        onReturnToApp={() => handleSelectDestination('home')}
      />
    );
  }

  if (routeView.kind === 'admin-dashboard') {
    if (isLoadingAuth || isCheckingAdminRoute) {
      return (
        <div className="min-h-screen bg-[#090B14] text-white flex flex-col items-center justify-center gap-3 p-6">
          <AtaLoadingSpinner size="lg" label="Verifying administrator session" />
          <p className="text-xs sm:text-sm text-[#A7A9B8]">
            Verifying administrator seat and permissions...
          </p>
        </div>
      );
    }

    if (!adminSession || !firebaseUser) {
      return (
        <AdminLoginPage
          initialDenialReason={adminDenialReason}
          onAdminAuthenticated={(verifiedAdmin, cloudAvail) => {
            setAdminSession({
              admin: verifiedAdmin,
              cloudFunctionsAvailable: cloudAvail,
            });
            setAdminDenialReason(null);
          }}
          onReturnToApp={() => handleSelectDestination('home')}
        />
      );
    }

    return (
      <AdminDashboardPage
        admin={adminSession.admin}
        cloudFunctionsAvailable={adminSession.cloudFunctionsAvailable}
        onReturnToApp={() => handleSelectDestination('home')}
        onSignedOut={() => {
          setAdminSession(null);
          navigateToRoute({ kind: 'admin-login' });
        }}
      />
    );
  }

  const isAccountRestricted =
    profile?.accountStatus === 'suspended' || profile?.accountStatus === 'banned';

  const isQuotaExceeded = Boolean(
    profileError && profileError.toLowerCase().includes('quota exceeded')
  );

  const topBannerNode = (
    <>
      <AnnouncementBanner />
      {isQuotaExceeded && (
        <div
          role="alert"
          className="rounded-2xl bg-amber-500/10 border border-amber-500/60 p-4 mb-4 flex items-start gap-3 text-xs sm:text-sm text-amber-950 dark:text-amber-100"
        >
          <AlertTriangle
            className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="font-bold">Firestore Daily Free Quota Limit Reached</p>
            <p className="text-xs opacity-90 mt-0.5">
              Cloud Firestore daily free read/write limits have been reached for this project. Database operations will automatically resume when the quota resets tomorrow, or you can upgrade your plan in the Firebase Console.
            </p>
          </div>
        </div>
      )}
      {isAccountRestricted && (
        <div
          role="alert"
          className="rounded-2xl bg-[#EF3038]/10 border border-[#EF3038] p-4 flex items-start gap-3 text-xs sm:text-sm text-[#090B14] dark:text-white"
        >
          <ShieldAlert
            className="h-5 w-5 text-[#EF3038] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="font-bold">
              {profile?.accountStatus === 'banned'
                ? 'Account Permanently Restricted'
                : 'Account Temporarily Suspended'}
            </p>
            <p className="text-xs text-[#52576B] dark:text-[#D4D7E2] mt-0.5">
              {profile?.accountStatus === 'banned'
                ? profile.banReason ||
                  'Interactive posting and messaging are disabled.'
                : profile?.suspensionReason ||
                  'Interactive posting and messaging are temporarily disabled pending review.'}
            </p>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      <AppShell
        activeDestination={activeDestination}
        onSelectDestination={handleSelectDestination}
        onSelectRouteTarget={handleSelectRouteTarget}
        onOpenAuth={handleOpenAuth}
        unreadMessagesCount={unreadMessagesCount}
        unreadNotificationsCount={unreadNotificationsCount}
        topBanner={topBannerNode}
        footer={
          <SiteFooter
            onNavigateLegal={handleNavigateLegal}
            onOpenCookiePreferences={() => setIsCookieModalOpen(true)}
            onOpenCopyrightModal={() => setLegalFeedbackTab('copyright')}
            onOpenFeedbackModal={() => setLegalFeedbackTab('feedback')}
            onOpenAdminLogin={() => navigateToRoute({ kind: 'admin-login' })}
          />
        }
        rightSidebar={
          <TrendingSidebarSection
            trending={trendingAnime}
            communities={communities}
            onNavigateCommunities={() => handleSelectDestination('communities')}
            onNavigateDiscover={() => handleSelectDestination('discover')}
          />
        }
      >
        {routeView.kind === 'legal' ? (
          <LegalDocumentPage
            slug={routeView.slug}
            onSelectSlug={handleNavigateLegal}
            onBackToApp={() => handleSelectDestination('home')}
            onOpenCookiePreferences={() => setIsCookieModalOpen(true)}
            onOpenCopyrightModal={() => setLegalFeedbackTab('copyright')}
            onOpenFeedbackModal={() => setLegalFeedbackTab('feedback')}
          />
        ) : activeDestination === 'home' ? (
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
            onNavigatePersonalisation={() =>
              handleSelectDestination('personalisation')
            }
            onNavigateLegal={handleNavigateLegal}
            onOpenCopyrightModal={() => setLegalFeedbackTab('copyright')}
            onOpenFeedbackModal={() => setLegalFeedbackTab('feedback')}
            onOpenCookiePreferences={() => setIsCookieModalOpen(true)}
          />
        ) : activeDestination === 'my-anime' ? (
          <MyAnimeDashboardPage
            currentUserId={firebaseUser?.uid}
            onOpenAuth={() => handleOpenAuth('login')}
            onNavigateDestination={handleSelectDestination}
          />
        ) : activeDestination === 'anime-tracker' ? (
          <AnimeTrackerPage
            currentUserId={firebaseUser?.uid}
            onOpenAuth={() => handleOpenAuth('login')}
          />
        ) : activeDestination === 'collections' ? (
          <CollectionsPage
            currentUserId={firebaseUser?.uid}
            onOpenAuth={() => handleOpenAuth('login')}
            onNavigateDestination={handleSelectDestination}
          />
        ) : activeDestination === 'personalisation' ? (
          <PersonalisationPage
            currentUserId={firebaseUser?.uid}
            onNavigateDestination={handleSelectDestination}
          />
        ) : activeDestination === 'calendar' ? (
          <CalendarPage
            currentUserId={firebaseUser?.uid}
            onOpenAuth={() => handleOpenAuth('login')}
            onNavigateDestination={handleSelectDestination}
            onOpenChallenge={(challengeId) => {
              setPendingWatchPartyId(null);
              setPendingChallengeId(challengeId);
              handleSelectDestination('challenges');
            }}
            onOpenWatchParty={(partyId) => {
              setPendingChallengeId(null);
              setPendingWatchPartyId(partyId);
              handleSelectDestination('challenges');
            }}
          />
        ) : activeDestination === 'challenges' ? (
          <ChallengesHubPage
            onOpenAuth={handleOpenAuth}
            onOpenUserProfile={(targetUid) => setDeepLinkedProfileId(targetUid)}
            initialChallengeId={pendingChallengeId}
            initialWatchPartyId={pendingWatchPartyId}
            onClearDeepLink={() => {
              setPendingChallengeId(null);
              setPendingWatchPartyId(null);
            }}
          />
        ) : activeDestination === 'news' ? (
          <NewsCenterPage
            currentUserId={firebaseUser?.uid}
            onOpenAuth={() => handleOpenAuth('login')}
          />
        ) : activeDestination === 'journey' ? (
          <WatchJourneyPage
            currentUserId={firebaseUser?.uid}
            onOpenAuth={() => handleOpenAuth('login')}
            onNavigateDestination={handleSelectDestination}
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
        <PersonalisationOnboardingModal
          isOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
        />
      </AppShell>

      <CookiePreferencesModal
        isOpen={isCookieModalOpen}
        onClose={() => setIsCookieModalOpen(false)}
        onOpenCookiePolicy={() => handleNavigateLegal('cookie-policy')}
      />

      <CopyrightFeedbackModal
        isOpen={legalFeedbackTab !== null}
        initialTab={legalFeedbackTab || 'copyright'}
        pageContext={
          routeView.kind === 'legal' ? `/${routeView.slug}` : `/${activeDestination}`
        }
        onClose={() => setLegalFeedbackTab(null)}
        onRequireAuth={() => handleOpenAuth('login')}
      />
    </>
  );
}
