/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { TrendingSidebarSection } from './components/TrendingSidebarSection';
import { AppShell } from './layout/AppShell';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { HomePage } from './pages/HomePage';
import { ProfilePage } from './pages/ProfilePage';
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
  const [activeDestination, setActiveDestination] =
    useState<NavDestinationId>('home');
  const [authMode, setAuthMode] = useState<AuthViewMode>('login');
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

  const handleSelectDestination = (destination: NavDestinationId) => {
    setActiveDestination(destination);
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  const handleOpenAuth = (mode: AuthViewMode) => {
    setAuthMode(mode);
    handleSelectDestination('profile');
  };

  return (
    <AppShell
      activeDestination={activeDestination}
      onSelectDestination={handleSelectDestination}
      onOpenAuth={handleOpenAuth}
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
        />
      ) : activeDestination === 'profile' ? (
        <ProfilePage initialAuthMode={authMode} />
      ) : (
        <ComingSoonPage
          destinationId={activeDestination}
          onReturnHome={() => handleSelectDestination('home')}
        />
      )}
    </AppShell>
  );
}
