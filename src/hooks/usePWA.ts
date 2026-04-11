'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';

interface PWAState {
  isOnline: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  hasPendingSync: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Perform a real connectivity check by fetching a small resource.
 * navigator.onLine can give false negatives, so we verify with an actual request.
 * Any HTTP response (even 404) means we can reach the server = we're online.
 */
async function checkRealConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch('/api/health', {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    // Any response (even 4xx/5xx) means we reached the server = online
    return true;
  } catch {
    // Network error or timeout — try a simpler fallback
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      await fetch('/manifest.json', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return true;
    } catch {
      return false;
    }
  }
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    // Start optimistically as online - we'll verify shortly
    isOnline: true,
    isInstalled: false,
    isStandalone: false,
    canInstall: false,
    hasPendingSync: false,
  });

  const connectivityCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Check online status with real connectivity verification
  useEffect(() => {
    // Perform real connectivity check
    const verifyConnectivity = async () => {
      const isReallyOnline = await checkRealConnectivity();
      setState((s) => ({ ...s, isOnline: isReallyOnline }));
    };

    // When browser reports online, verify with a real check
    const handleOnline = () => {
      // Set online immediately (optimistic) but verify
      setState((s) => ({ ...s, isOnline: true }));
      verifyConnectivity();
    };

    // When browser reports offline, double-check before showing indicator
    const handleOffline = () => {
      // Don't immediately show offline - verify first
      // This prevents false positives from unreliable navigator.onLine
      verifyConnectivity();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    verifyConnectivity();

    // Periodic connectivity check every 30 seconds when we think we're offline
    // This helps recover from false offline states faster
    connectivityCheckRef.current = setInterval(() => {
      if (!state.isOnline) {
        verifyConnectivity();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connectivityCheckRef.current) {
        clearInterval(connectivityCheckRef.current);
      }
    };
  }, [state.isOnline]);

  // Check if running as standalone PWA
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error - Safari specific
      window.navigator.standalone === true;
    setState((s) => ({ ...s, isStandalone, isInstalled: isStandalone }));
  }, []);

  // Listen for install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setState((s) => ({ ...s, canInstall: true }));
    };

    const handleAppInstalled = () => {
      deferredPrompt = null;
      setState((s) => ({ ...s, canInstall: false, isInstalled: true }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Listen for sync messages from service worker
  useEffect(() => {
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_COMPLETE') {
        setState((s) => ({ ...s, hasPendingSync: false }));
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleSWMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, []);

  // Trigger install prompt
  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setState((s) => ({ ...s, canInstall: false }));
    return outcome === 'accepted';
  }, []);

  // Request background sync
  const requestSync = useCallback(async () => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // @ts-expect-error - SyncManager types not included
        await registration.sync.register('sync-pos-transactions');
        return true;
      } catch (error) {
        Sentry.captureException(error, {
          tags: { hook: 'usePWA', action: 'background-sync' },
        });
        return false;
      }
    }
    return false;
  }, []);

  return {
    ...state,
    install,
    requestSync,
  };
}

export default usePWA;
