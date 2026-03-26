'use client';

import { WifiOff, CloudOff, Loader2 } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

export function OfflineIndicator() {
  const { isOnline, hasPendingSync } = usePWA();

  // Don't show anything when online and no pending sync
  if (isOnline && !hasPendingSync) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2">
      {!isOnline ? (
        <div className="flex items-center gap-2 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg px-3 py-2">
          <WifiOff className="w-4 h-4" />
          <span>You're offline — transactions will sync when reconnected</span>
        </div>
      ) : hasPendingSync ? (
        <div className="flex items-center gap-2 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg px-3 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Syncing offline transactions...</span>
        </div>
      ) : null}
    </div>
  );
}

// Banner version for top of page
export function OfflineBanner() {
  const { isOnline } = usePWA();

  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
      <CloudOff className="w-4 h-4" />
      <span>You're currently offline. Changes will be saved locally and synced when you reconnect.</span>
    </div>
  );
}

export default OfflineIndicator;
