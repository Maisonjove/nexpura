'use client';

import { useState, useEffect, useCallback } from 'react';
// @ts-expect-error - react-joyride v3 types are incomplete
import Joyride from 'react-joyride';

const TOUR_STEPS = [
  {
    target: '[data-tour="dashboard"]',
    content: 'Welcome to Nexpura! This is your dashboard where you can see key business metrics at a glance — sales, repairs, outstanding invoices, and more.',
    title: '🎉 Welcome to Nexpura!',
    placement: 'right' as const,
    disableBeacon: true,
  },
  {
    target: '[data-tour="pos"]',
    content: 'Start a new sale from the Point of Sale. Add items from inventory, apply discounts, split payments, and process transactions with ease.',
    title: '🛒 Point of Sale',
    placement: 'right' as const,
  },
  {
    target: '[data-tour="inventory"]',
    content: 'Manage all your products and stock levels here. Add photos, set pricing, track quantities, and list items on your website.',
    title: '📦 Inventory',
    placement: 'right' as const,
  },
  {
    target: '[data-tour="repairs"]',
    content: 'Track repair jobs through every stage — from intake to completion. Notify customers automatically when their item is ready.',
    title: '🔧 Repairs',
    placement: 'right' as const,
  },
  {
    target: '[data-tour="customers"]',
    content: "Keep a complete record of every customer — their purchases, repairs, bespoke commissions, store credit, and loyalty points.",
    title: '👥 Customers',
    placement: 'right' as const,
  },
  {
    target: '[data-tour="invoices"]',
    content: 'Create, send, and track invoices. Record payments and monitor outstanding balances across all your customers.',
    title: '🧾 Invoices',
    placement: 'right' as const,
  },
  {
    target: '[data-tour="reports"]',
    content: 'Get deep insights into your business with sales reports, inventory valuations, customer spending, and more.',
    title: '📊 Reports',
    placement: 'right' as const,
  },
  {
    target: '[data-tour="settings"]',
    content: 'Configure your business details, team members, tax settings, payment integrations, and branding here.',
    title: '⚙️ Settings',
    placement: 'right' as const,
  },
  {
    target: '[data-tour="help"]',
    content: "You're all set! Visit Help & Support any time for FAQs, video tutorials, and to contact our support team.",
    title: '🎓 You\'re Ready!',
    placement: 'right' as const,
  },
];

const TOUR_STORAGE_KEY = 'nexpura_tour_completed';

interface OnboardingTourProps {
  forceStart?: boolean;
  onComplete?: () => void;
}

export function OnboardingTour({ forceStart = false, onComplete }: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (forceStart) {
      setStepIndex(0);
      setRun(true);
      return;
    }
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => setRun(true), 800);
      return () => clearTimeout(timer);
    }
  }, [forceStart]);

  const handleCallback = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: any) => {
      const { status, action, type } = data;

      if (status === 'finished' || status === 'skipped') {
        setRun(false);
        localStorage.setItem(TOUR_STORAGE_KEY, 'true');
        onComplete?.();
        return;
      }

      if (type === 'step:after') {
        if (action === 'prev') {
          setStepIndex((i) => Math.max(0, i - 1));
        } else {
          setStepIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1));
        }
      }
    },
    [onComplete]
  );

  if (!run) return null;

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      stepIndex={stepIndex}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: '#92400e',
          textColor: '#1c1917',
          backgroundColor: '#ffffff',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '12px',
          fontSize: '14px',
          padding: '16px',
        },
        tooltipTitle: {
          fontSize: '15px',
          fontWeight: 600,
          marginBottom: '8px',
        },
        buttonNext: {
          backgroundColor: '#92400e',
          borderRadius: '8px',
          fontSize: '13px',
          padding: '8px 16px',
        },
        buttonBack: {
          color: '#78716c',
          fontSize: '13px',
        },
        buttonSkip: {
          color: '#78716c',
          fontSize: '13px',
        },
        spotlight: {
          borderRadius: '8px',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        open: 'Open',
        skip: 'Skip tour',
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
