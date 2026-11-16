import React from 'react';
import { AnimeDiscoveryArea } from '../components/AnimeDiscoveryArea';
import { PopularDiscussions } from '../components/PopularDiscussions';
import { SocialFeedSection } from '../components/social/SocialFeedSection';
import { WelcomeSection } from '../components/WelcomeSection';
import type {
  AuthViewMode,
  DiscoverySeriesItem,
  DiscussionThread,
  NavDestinationId,
} from '../types';

interface HomePageProps {
  discussions: DiscussionThread[];
  featuredSeries: DiscoverySeriesItem[];
  onNavigate: (destination: NavDestinationId) => void;
  onOpenAuth: (mode: AuthViewMode) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  discussions,
  featuredSeries,
  onNavigate,
  onOpenAuth,
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
        onExploreDiscussions={() => scrollToSection('social-feed')}
        onExploreDiscovery={() => scrollToSection('anime-discovery-area')}
      />

      <SocialFeedSection
        onOpenAuth={onOpenAuth}
        onNavigateProfile={() => onNavigate('profile')}
      />

      {/* Explicit Separation Between Live Firestore Content & Build 01 Showcase Previews */}
      <div className="pt-2 border-t-2 border-dashed border-[#D4D7E2] dark:border-[#303342]">
        <p className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] text-[#52576B] dark:text-[#A7A9B8] uppercase">
          Sample Showcase <span aria-hidden="true">·</span> Demonstration
          Previews Only (Not Real Community Posts)
        </p>
      </div>

      <PopularDiscussions discussions={discussions} />

      <AnimeDiscoveryArea
        series={featuredSeries}
        onOpenDiscoverPage={() => onNavigate('discover')}
      />
    </div>
  );
};
