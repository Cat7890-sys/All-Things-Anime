import React from 'react';
import { AnimeDiscoveryArea } from '../components/AnimeDiscoveryArea';
import { PopularDiscussions } from '../components/PopularDiscussions';
import { PostComposerPlaceholder } from '../components/PostComposerPlaceholder';
import { WelcomeSection } from '../components/WelcomeSection';
import type {
  DiscoverySeriesItem,
  DiscussionThread,
  NavDestinationId,
} from '../types';

interface HomePageProps {
  discussions: DiscussionThread[];
  featuredSeries: DiscoverySeriesItem[];
  onNavigate: (destination: NavDestinationId) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  discussions,
  featuredSeries,
  onNavigate,
}) => {
  const scrollToSection = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    el.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  return (
    <div className="space-y-8">
      <WelcomeSection
        onExploreDiscussions={() => scrollToSection('popular-discussions')}
        onExploreDiscovery={() => scrollToSection('anime-discovery-area')}
      />

      <PostComposerPlaceholder />

      <PopularDiscussions discussions={discussions} />

      <AnimeDiscoveryArea
        series={featuredSeries}
        onOpenDiscoverPage={() => onNavigate('discover')}
      />
    </div>
  );
};
