'use client';

import { useCallback } from 'react';

const TOUR_STORAGE_KEY = 'nexpura_tour_completed';

interface OnboardingTourProps {
  forceStart?: boolean;
  onComplete?: () => void;
}

// Placeholder - react-joyride v3 integration pending
export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  // Tour functionality temporarily disabled
  // Will be re-implemented with react-joyride v3 hook API
  return null;
}

export function useRestartTour() {
  return useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    window.location.reload();
  }, []);
}
