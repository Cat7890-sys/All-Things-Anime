import React from 'react';
import { COMING_SOON_SPECS } from '../assets/sampleData';
import { ComingSoonPanel } from '../components/ComingSoonPanel';
import type { NavDestinationId } from '../types';

interface ComingSoonPageProps {
  destinationId: Exclude<NavDestinationId, 'home'>;
  onReturnHome: () => void;
}

export const ComingSoonPage: React.FC<ComingSoonPageProps> = ({
  destinationId,
  onReturnHome,
}) => {
  const spec = COMING_SOON_SPECS[destinationId];

  return <ComingSoonPanel spec={spec} onReturnHome={onReturnHome} />;
};
