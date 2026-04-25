'use client';

import dynamic from 'next/dynamic';

// Lazy-load non-critical overlay components to reduce initial bundle size
// These components are only needed after user interaction, so they're deferred
const CommandPalette = dynamic(
  () => import("@/components/command-palette").then(m => ({ default: m.CommandPalette })),
  { ssr: false }
);

const SessionTimeoutWarning = dynamic(
  () => import("@/components/SessionTimeoutWarning").then(m => ({ default: m.SessionTimeoutWarning })),
  { ssr: false }
);

/**
 * Wrapper component that lazy-loads overlay UI components.
 * These are rendered client-side only and don't block initial page load.
 *
 * The OnboardingTour (`react-joyride`) used to mount here for every
 * signed-in route. It rendered a fullscreen 50%-opacity overlay
 * (`<div id="react-joyride-portal">`) that intercepted pointer events
 * on every paint until the user finished or skipped each step. For
 * users who already knew the product (every existing tenant), it was
 * pure friction — and the portal stayed in the DOM even after the
 * tour ended, occasionally swallowing clicks during navigation.
 * Removed per Joey's request; first-time-user guidance now lives in
 * the /help surface only.
 */
export function LazyOverlays() {
  return (
    <>
      <CommandPalette />
      <SessionTimeoutWarning />
    </>
  );
}
