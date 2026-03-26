'use client';

import { useState } from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react';
import { useOfflineQueue, type QueuedItem } from '@/hooks/useOfflineQueue';
import { usePWA } from '@/hooks/usePWA';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getItemDescription(item: QueuedItem): string {
  const url = new URL(item.url);
  const path = url.pathname;
  
  // Parse common POS endpoints
  if (path.includes('/api/pos/sale')) return 'POS Sale';
  if (path.includes('/api/pos/refund')) return 'POS Refund';
  if (path.includes('/api/inventory')) return 'Inventory Update';
  if (path.includes('/api/customers')) return 'Customer Update';
  if (path.includes('/api/repairs')) return 'Repair Update';
  
  return `${item.method} ${path}`;
}

function QueueItem({
  item,
  onRetry,
  onRemove,
  isRetrying,
}: {
  item: QueuedItem;
  onRetry: () => void;
  onRemove: () => void;
  isRetrying: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasError = !!item.lastError;
  
  return (
    <div
      className={cn(
        'border rounded-lg p-3 transition-colors',
        hasError ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              hasError ? 'bg-red-500' : 'bg-amber-500'
            )}
          />
          <span className="font-medium text-sm truncate">
            {getItemDescription(item)}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0">
            {formatTimestamp(item.timestamp)}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {item.retryCount && item.retryCount > 0 && (
            <span className="text-xs text-red-600 px-1.5 py-0.5 bg-red-100 rounded">
              {item.retryCount} {item.retryCount === 1 ? 'retry' : 'retries'}
            </span>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={onRemove}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {item.lastError && (
            <div className="flex items-start gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{item.lastError}</span>
            </div>
          )}
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
            {JSON.stringify(item.body, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function SyncQueuePanel() {
  const { isOnline } = usePWA();
  const {
    items,
    isLoading,
    isSyncing,
    pendingCount,
    retryItem,
    retryAll,
    clearQueue,
  } = useOfflineQueue();
  
  const [confirmClear, setConfirmClear] = useState(false);
  const [retryingItem, setRetryingItem] = useState<number | null>(null);
  
  const handleRetryItem = async (timestamp: number) => {
    setRetryingItem(timestamp);
    await retryItem(timestamp);
    setRetryingItem(null);
  };
  
  const handleClear = async () => {
    await clearQueue();
    setConfirmClear(false);
  };
  
  return (
    <div className="bg-white rounded-lg border shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-full',
            isOnline ? 'bg-green-100' : 'bg-amber-100'
          )}>
            {isOnline ? (
              <Cloud className="w-5 h-5 text-green-600" />
            ) : (
              <CloudOff className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Sync Queue</h3>
            <p className="text-sm text-gray-500">
              {isOnline ? 'Connected' : 'Offline'} •{' '}
              {pendingCount === 0
                ? 'No pending items'
                : `${pendingCount} pending ${pendingCount === 1 ? 'item' : 'items'}`}
            </p>
          </div>
        </div>
        
        {/* Syncing indicator */}
        {isSyncing && (
          <div className="flex items-center gap-2 text-blue-600 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Syncing...</span>
          </div>
        )}
      </div>
      
      {/* Status bar */}
      {pendingCount > 0 && (
        <div className={cn(
          'px-4 py-2 text-sm flex items-center gap-2',
          isOnline ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
        )}>
          {isOnline ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Ready to sync — click retry to process items</span>
            </>
          ) : (
            <>
              <Clock className="w-4 h-4" />
              <span>Waiting for connection — items will sync automatically</span>
            </>
          )}
        </div>
      )}
      
      {/* Queue items */}
      <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p className="font-medium">All synced!</p>
            <p className="text-sm">No pending offline transactions</p>
          </div>
        ) : (
          items.map((item) => (
            <QueueItem
              key={item.timestamp}
              item={item}
              onRetry={() => handleRetryItem(item.timestamp)}
              onRemove={() => retryItem(item.timestamp)}
              isRetrying={retryingItem === item.timestamp}
            />
          ))
        )}
      </div>
      
      {/* Actions */}
      {items.length > 0 && (
        <div className="px-4 py-3 border-t flex items-center justify-between gap-2">
          <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-600">
                <Trash2 className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clear Sync Queue?</DialogTitle>
                <DialogDescription>
                  This will permanently remove {items.length} pending{' '}
                  {items.length === 1 ? 'transaction' : 'transactions'} from the
                  queue. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleClear}>
                  Clear Queue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button
            size="sm"
            onClick={retryAll}
            disabled={isSyncing || !isOnline}
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-1" />
                Retry All
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// Compact indicator for sidebar/header
export function SyncQueueIndicator() {
  const { isOnline, hasPendingSync } = usePWA();
  const { pendingCount, isSyncing } = useOfflineQueue();
  
  if (pendingCount === 0 && !isSyncing) return null;
  
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        isSyncing
          ? 'bg-blue-100 text-blue-700'
          : !isOnline
          ? 'bg-amber-100 text-amber-700'
          : 'bg-gray-100 text-gray-700'
      )}
    >
      {isSyncing ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : !isOnline ? (
        <CloudOff className="w-3 h-3" />
      ) : (
        <Clock className="w-3 h-3" />
      )}
      <span>
        {isSyncing ? 'Syncing' : `${pendingCount} pending`}
      </span>
    </div>
  );
}

export default SyncQueuePanel;
