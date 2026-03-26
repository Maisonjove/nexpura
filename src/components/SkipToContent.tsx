'use client';

/**
 * Skip to Content Link
 * 
 * Accessibility feature that allows keyboard users to skip navigation
 * and jump directly to the main content area.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-amber-700 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:text-sm focus:font-medium focus:shadow-lg"
    >
      Skip to main content
    </a>
  );
}
