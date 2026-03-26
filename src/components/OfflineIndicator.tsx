'use client';

import { WifiOff, CloudOff, Loader2, Cloud, ChevronRight } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import Link from 'next/link';

export function OfflineIndicator() {
  const { isOnline, hasPendingSync } = usePWA();
  const { pendingCount, isSyncing } = useOfflineQueue();

  // Don't show anything when online and no pending items
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-bottom-2">
      {!isOnline ? (
        <div className="flex items-center gap-2 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg px-3 py-2 shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">
            Offline{pendingCount > 0 && ` • ${pendingCount} pending`}
          </span>
        </div>
      ) : isSyncing ? (
        <div className="flex items-center gap-2 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg px-3 py-2 shadow-lg">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">Syncing...</span>
        </div>
      ) : pendingCount > 0 ? (
        <Link href="/settings/sync">
          <div className="flex items-center gap-2 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg px-3 py-2 shadow-lg cursor-pointer hover:bg-amber-50 transition-colors">
            <Cloud className="w-4 h-4" />
            <span className="text-sm font-medium">{pendingCount} pending sync</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
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
