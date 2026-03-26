'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';

type AriaLive = 'polite' | 'assertive' | 'off';

interface LiveRegionContextValue {
  announce: (message: string, priority?: AriaLive) => void;
}

const LiveRegionContext = createContext<LiveRegionContextValue | null>(null);

/**
 * Provider for accessible live region announcements.
 * Wrap your app with this to enable screen reader announcements for dynamic content.
 */
export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const announce = useCallback((message: string, priority: AriaLive = 'polite') => {
    // Clear any pending message clear
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
    }

    if (priority === 'assertive') {
      setAssertiveMessage(message);
    } else {
      setPoliteMessage(message);
    }

    // Clear the message after it's been announced (screen readers need the text to change)
    clearTimeoutRef.current = setTimeout(() => {
      setPoliteMessage('');
      setAssertiveMessage('');
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, []);

  return (
    <LiveRegionContext.Provider value={{ announce }}>
      {children}
      
      {/* Polite announcements - for status updates, non-urgent changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>

      {/* Assertive announcements - for errors, urgent information */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </LiveRegionContext.Provider>
  );
}

/**
 * Hook to announce messages to screen readers.
 * 
 * @example
 * const { announce } = useLiveRegion();
 * 
 * // Polite announcement (default)
 * announce('Item added to cart');
 * 
 * // Assertive announcement (for errors)
 * announce('Error: Failed to save', 'assertive');
 */
export function useLiveRegion() {
  const context = useContext(LiveRegionContext);
  
  if (!context) {
    // Return a no-op if not wrapped in provider (graceful degradation)
    return { 
      announce: (message: string, _priority?: AriaLive) => {
        console.warn('[a11y] LiveRegionProvider not found. Message not announced:', message);
      }
    };
  }
  
  return context;
}

/**
 * Component for inline status announcements.
 * Use this for toast messages, form feedback, etc.
 */
export function StatusAnnouncement({ 
  children, 
  role = 'status',
  live = 'polite'
}: { 
  children: ReactNode;
  role?: 'status' | 'alert';
  live?: AriaLive;
}) {
  return (
    <div role={role} aria-live={live} aria-atomic="true">
      {children}
    </div>
  );
}
