'use client';

import { useState, useEffect, useCallback } from 'react';

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

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isInstalled: false,
    isStandalone: false,
    canInstall: false,
    hasPendingSync: false,
  });

  // Check online status
  useEffect(() => {
    const handleOnline = () => setState((s) => ({ ...s, isOnline: true }));
    const handleOffline = () => setState((s) => ({ ...s, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
        console.error('Background sync failed:', error);
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
