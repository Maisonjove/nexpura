'use client';

import { useCallback } from 'react';

const TOUR_STORAGE_KEY = 'nexpura_tour_completed';

interface OnboardingTourProps {
  forceStart?: boolean;
  onComplete?: () => void;
}

// Onboarding tour disabled - react-joyride v3 API incompatible
// TODO: Implement custom tour or wait for react-joyride types fix
export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  return null;
}

export function useRestartTour() {
  return useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    window.location.reload();
  }, []);
}
