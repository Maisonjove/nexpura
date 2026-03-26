'use client';

import { useEffect } from 'react';

/**
 * Hook to update the page title for screen readers and browser tabs.
 * Appends " | Nexpura" suffix to the title.
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const fullTitle = title ? `${title} | Nexpura` : 'Nexpura';
    document.title = fullTitle;
    
    // Also announce the page change to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = `Navigated to ${title}`;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement is made
    const timeoutId = setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 1000);
    
    return () => {
      clearTimeout(timeoutId);
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    };
  }, [title]);
}

/**
 * Component wrapper for usePageTitle hook.
 * Use in server components or when you don't need the hook directly.
 */
export function PageTitle({ title }: { title: string }) {
  usePageTitle(title);
  return null;
}
