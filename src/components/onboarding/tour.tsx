'use client';

import { useCallback, useEffect, useState } from 'react';
import Joyride, { CallBackProps, STATUS, Step, Styles } from 'react-joyride';

const TOUR_STORAGE_KEY = 'nexpura_tour_completed';

// Define tour steps targeting sidebar navigation items
const tourSteps: Step[] = [
  {
    target: '[data-tour="dashboard"]',
    content: 'Welcome to Nexpura! This is your Dashboard — see your sales, repairs, and key metrics at a glance.',
    title: '📊 Dashboard',
    placement: 'right',
    disableBeacon: true,
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
];

// Custom styles to match Nexpura design
const joyrideStyles: Styles = {
  options: {
    arrowColor: '#ffffff',
    backgroundColor: '#ffffff',
    overlayColor: 'rgba(0, 0, 0, 0.5)',
    primaryColor: '#b45309', // amber-700
    textColor: '#292524', // stone-800
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
  },
  tooltipContainer: {
    textAlign: 'left' as const,
  },
  tooltipTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#292524',
  },
  tooltipContent: {
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#57534e', // stone-600
  },
  buttonNext: {
    backgroundColor: '#b45309',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 500,
    padding: '8px 16px',
  },
  buttonBack: {
    color: '#78716c',
    fontSize: '14px',
    fontWeight: 500,
    marginRight: '8px',
  },
  buttonSkip: {
    color: '#a8a29e',
    fontSize: '14px',
  },
  buttonClose: {
    color: '#a8a29e',
  },
  spotlight: {
    borderRadius: '8px',
  },
  overlay: {
    cursor: 'default',
  },
};

interface OnboardingTourProps {
  forceStart?: boolean;
  onComplete?: () => void;
}

export function OnboardingTour({ forceStart, onComplete }: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    // Check if tour has been completed
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    
    if (forceStart) {
      // Force start overrides stored preference
      setRun(true);
      setStepIndex(0);
    } else if (!completed) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setRun(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [forceStart]);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status, type, index, action } = data;
    
    // Handle step navigation
    if (type === 'step:after') {
      if (action === 'next') {
        setStepIndex(index + 1);
      } else if (action === 'prev') {
        setStepIndex(index - 1);
      }
    }

    // Handle tour completion or skip
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      onComplete?.();
    }
  }, [onComplete]);

  // Don't render if not running (prevents SSR issues)
  if (!run) return null;

  return (
    <Joyride
      steps={tourSteps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      disableScrolling={false}
      scrollToFirstStep
      spotlightClicks
      callback={handleCallback}
      styles={joyrideStyles}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip tour',
      }}
      floaterProps={{
        disableAnimation: true,
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
