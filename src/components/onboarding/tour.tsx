'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Joyride = dynamic(() => import('react-joyride').then(m => m.Joyride), { ssr: false }) as any;

const TOUR_STORAGE_KEY = 'nexpura_tour_completed';

interface OnboardingTourProps {
  forceStart?: boolean;
  onComplete?: () => void;
}

export function OnboardingTour({ forceStart, onComplete }: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Define tour steps targeting sidebar navigation items
  const tourSteps = [
    {
      target: '[data-tour="dashboard"]',
      content: 'Welcome to Nexpura! This is your Dashboard — see your sales, repairs, and key metrics at a glance.',
      title: '📊 Dashboard',
      placement: 'right' as const,
    },
    {
      target: '[data-tour="pos"]',
      content: 'Process sales, handle payments, and manage transactions from the POS. You can also create laybys and handle trade-ins.',
      title: '🛒 Point of Sale',
      placement: 'right' as const,
    },
    {
      target: '[data-tour="inventory"]',
      content: 'Manage your stock, add new items, track stock levels, and publish products to your website.',
      title: '📦 Inventory',
      placement: 'right' as const,
    },
    {
      target: '[data-tour="customers"]',
      content: 'Your customer database. View purchase history, manage communications, and track loyalty.',
      title: '👥 Customers',
      placement: 'right' as const,
    },
    {
      target: '[data-tour="repairs"]',
      content: 'Track repair jobs from intake to collection. Send automatic notifications when repairs are ready.',
      title: '🔧 Repairs',
      placement: 'right' as const,
    },
    {
      target: '[data-tour="settings"]',
      content: 'Configure your business profile, team members, integrations, and preferences.',
      title: '⚙️ Settings',
      placement: 'right' as const,
    },
    {
      target: '[data-tour="help"]',
      content: 'Need help? Find FAQs, video tutorials, and contact support here. You can restart this tour anytime!',
      title: '❓ Help & Support',
      placement: 'right' as const,
    },
  ];

  // Handle tour completion/skip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCallback = useCallback((data: any) => {
    const { status, type } = data;
    
    if (type === 'tour:end') {
      if (status === 'finished' || status === 'skipped') {
        // Mark tour as completed in localStorage
        localStorage.setItem(TOUR_STORAGE_KEY, 'true');
        setRun(false);
        onComplete?.();
      }
    }
  }, [onComplete]);

  // Check if tour should run on mount
  useEffect(() => {
    setMounted(true);
    
    // Check localStorage after mount (client-side only)
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    
    if (forceStart) {
      // Force start - clear the flag and run
      localStorage.removeItem(TOUR_STORAGE_KEY);
      const timer = setTimeout(() => setRun(true), 1500);
      return () => clearTimeout(timer);
    } else if (!completed) {
      // First time user - start tour after a delay to ensure DOM is ready
      const timer = setTimeout(() => setRun(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [forceStart]);

  // Don't render on server
  if (!mounted) return null;

  return (
    <Joyride
      steps={tourSteps}
      run={run}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      callback={handleCallback}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip tour',
      }}
      styles={{
        options: {
          primaryColor: '#b45309',
          textColor: '#292524',
          overlayColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 10000,
          backgroundColor: '#ffffff',
        },
      }}
    />
  );
}

export function useRestartTour() {
  return useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    window.location.reload();
  }, []);
}
