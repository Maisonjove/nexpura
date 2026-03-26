'use client';

import { ArrowLeft, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { SyncQueuePanel } from '@/components/SyncQueuePanel';
import { OfflineBanner } from '@/components/OfflineIndicator';

export default function SyncQueuePage() {
  return (
    <div className="space-y-6">
      {/* Offline banner at top */}
      <OfflineBanner />
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/settings"
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Sync Queue</h1>
          <p className="text-sm text-stone-500">
            Manage offline transactions waiting to sync
          </p>
        </div>
      </div>

      {/* Main panel */}
      <SyncQueuePanel />

      {/* Help section */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How offline sync works</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>
                When you&apos;re offline, transactions are saved locally in your browser
              </li>
              <li>
                When you reconnect, transactions automatically sync in the background
              </li>
              <li>
                You can manually retry failed transactions using the retry button
              </li>
              <li>
                Transactions are stored securely and persist across browser sessions
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
