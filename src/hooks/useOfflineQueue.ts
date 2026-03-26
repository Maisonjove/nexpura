'use client';

import { useState, useEffect, useCallback } from 'react';

export interface QueuedItem {
  timestamp: number;
  url: string;
  method: string;
  body: Record<string, unknown>;
  retryCount?: number;
  lastError?: string;
}

export interface OfflineQueueState {
  items: QueuedItem[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
}

const DB_NAME = 'nexpura-offline';
const STORE_NAME = 'queue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
      }
    };
  });
}

export function useOfflineQueue() {
  const [state, setState] = useState<OfflineQueueState>({
    items: [],
    isLoading: true,
    isSyncing: false,
    error: null,
  });

  // Load queued items from IndexedDB
  const loadQueue = useCallback(async () => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      
      const items: QueuedItem[] = await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      setState((s) => ({
        ...s,
        items: items.sort((a, b) => a.timestamp - b.timestamp),
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      console.error('[OfflineQueue] Failed to load queue:', error);
      setState((s) => ({
        ...s,
        isLoading: false,
        error: 'Failed to load offline queue',
      }));
    }
  }, []);

  // Retry a single item
  const retryItem = useCallback(async (timestamp: number) => {
    setState((s) => ({ ...s, isSyncing: true }));
    
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      
      const item: QueuedItem | undefined = await new Promise((resolve, reject) => {
        const req = store.get(timestamp);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (!item) {
        throw new Error('Item not found');
      }

      const response = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body),
      });

      if (response.ok) {
        // Delete from queue
        const deleteTx = db.transaction(STORE_NAME, 'readwrite');
        await new Promise<void>((resolve, reject) => {
          const req = deleteTx.objectStore(STORE_NAME).delete(timestamp);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        await loadQueue();
      } else {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('[OfflineQueue] Retry failed:', error);
      // Update retry count
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        const item: QueuedItem | undefined = await new Promise((resolve, reject) => {
          const req = store.get(timestamp);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        if (item) {
          item.retryCount = (item.retryCount || 0) + 1;
          item.lastError = error instanceof Error ? error.message : 'Unknown error';
          await new Promise<void>((resolve, reject) => {
            const req = store.put(item);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        }
        await loadQueue();
      } catch (updateError) {
        console.error('[OfflineQueue] Failed to update retry count:', updateError);
      }
    } finally {
      setState((s) => ({ ...s, isSyncing: false }));
    }
  }, [loadQueue]);

  // Retry all items
  const retryAll = useCallback(async () => {
    setState((s) => ({ ...s, isSyncing: true }));
    
    for (const item of state.items) {
      await retryItem(item.timestamp);
    }
    
    setState((s) => ({ ...s, isSyncing: false }));
  }, [state.items, retryItem]);

  // Remove an item from queue
  const removeItem = useCallback(async (timestamp: number) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      await new Promise<void>((resolve, reject) => {
        const req = tx.objectStore(STORE_NAME).delete(timestamp);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      await loadQueue();
    } catch (error) {
      console.error('[OfflineQueue] Failed to remove item:', error);
    }
  }, [loadQueue]);

  // Clear all items
  const clearQueue = useCallback(async () => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      await new Promise<void>((resolve, reject) => {
        const req = tx.objectStore(STORE_NAME).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      await loadQueue();
    } catch (error) {
      console.error('[OfflineQueue] Failed to clear queue:', error);
    }
  }, [loadQueue]);

  // Load on mount and listen for sync events
  useEffect(() => {
    loadQueue();

    // Listen for sync completion messages from SW
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_COMPLETE') {
        loadQueue();
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    // Poll for changes every 5 seconds when there are items
    const interval = setInterval(() => {
      if (state.items.length > 0) {
        loadQueue();
      }
    }, 5000);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, [loadQueue, state.items.length]);

  return {
    ...state,
    pendingCount: state.items.length,
    retryItem,
    retryAll,
    removeItem,
    clearQueue,
    refresh: loadQueue,
  };
}

export default useOfflineQueue;
