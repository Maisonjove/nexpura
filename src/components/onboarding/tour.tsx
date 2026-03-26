'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useJoyride, Step, STATUS, EVENTS } from 'react-joyride';

const TOUR_STORAGE_KEY = 'nexpura_tour_completed';

interface OnboardingTourProps {
  forceStart?: boolean;
  onComplete?: () => void;
}

export function OnboardingTour({ forceStart, onComplete }: OnboardingTourProps) {
  // Define tour steps targeting sidebar navigation items
  const tourSteps: Step[] = useMemo(() => [
    {
      target: '[data-tour="dashboard"]',
      content: 'Welcome to Nexpura! This is your Dashboard — see your sales, repairs, and key metrics at a glance.',
      title: '📊 Dashboard',
      placement: 'right',
      skipBeacon: true,
    },
    {
      target: '[data-tour="pos"]',
      content: 'Process sales, handle payments, and manage transactions from the POS. You can also create laybys and handle trade-ins.',
      title: '🛒 Point of Sale',
      placement: 'right',
    },
    {
      target: '[data-tour="inventory"]',
      content: 'Manage your stock, add new items, track stock levels, and publish products to your website.',
      title: '📦 Inventory',
      placement: 'right',
    },
    {
      target: '[data-tour="customers"]',
      content: 'Your customer database. View purchase history, manage communications, and track loyalty.',
      title: '👥 Customers',
      placement: 'right',
    },
    {
      target: '[data-tour="repairs"]',
      content: 'Track repair jobs from intake to collection. Send automatic notifications when repairs are ready.',
      title: '🔧 Repairs',
      placement: 'right',
    },
    {
      target: '[data-tour="settings"]',
      content: 'Configure your business profile, team members, integrations, and preferences.',
      title: '⚙️ Settings',
      placement: 'right',
    },
    {
      target: '[data-tour="help"]',
      content: 'Need help? Find FAQs, video tutorials, and contact support here. You can restart this tour anytime!',
      title: '❓ Help & Support',
      placement: 'right',
    },
  ], []);

  const { Tour, controls, on } = useJoyride({
    steps: tourSteps,
    continuous: true,
    locale: {
      back: 'Back',
      close: 'Close',
      last: 'Finish',
      next: 'Next',
      skip: 'Skip tour',
    },
    options: {
      primaryColor: '#b45309',
      textColor: '#292524',
      overlayColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 10000,
      showProgress: true,
      backgroundColor: '#ffffff',
    },
  });

  // Listen for tour end events
  useEffect(() => {
    const unsubscribe = on(EVENTS.TOUR_END, (data) => {
      const { status } = data;
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        localStorage.setItem(TOUR_STORAGE_KEY, 'true');
        onComplete?.();
      }
    });
    return unsubscribe;
  }, [on, onComplete]);

  // Start tour on mount if not completed
  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    
    if (forceStart) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        controls.start();
      }, 1000);
      return () => clearTimeout(timer);
    } else if (!completed) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        controls.start();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [forceStart, controls]);

  return Tour;
}

export function useRestartTour() {
  return useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    window.location.reload();
  }, []);
}
