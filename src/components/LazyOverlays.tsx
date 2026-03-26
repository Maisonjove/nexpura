'use client';

import dynamic from 'next/dynamic';

// Lazy-load non-critical overlay components to reduce initial bundle size
// These components are only needed after user interaction, so they're deferred
const CommandPalette = dynamic(
  () => import("@/components/command-palette").then(m => ({ default: m.CommandPalette })),
  { ssr: false }
);

const OnboardingTour = dynamic(
  () => import("@/components/onboarding/tour").then(m => ({ default: m.OnboardingTour })),
  { ssr: false }
);

const SessionTimeoutWarning = dynamic(
  () => import("@/components/SessionTimeoutWarning").then(m => ({ default: m.SessionTimeoutWarning })),
  { ssr: false }
);

/**
 * Wrapper component that lazy-loads overlay UI components.
 * These are rendered client-side only and don't block initial page load.
 */
export function LazyOverlays() {
  return (
    <>
      <CommandPalette />
      <OnboardingTour />
      <SessionTimeoutWarning />
    </>
  );
}
