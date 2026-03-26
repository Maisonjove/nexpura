"use client";

import { useState } from "react";
import { Package, RefreshCw, CheckCircle2 } from "lucide-react";

interface WooSyncPanelProps {
  isConnected: boolean;
  lastSyncAt?: string | null;
}

type SyncResult = {
  success: boolean;
  products?: { imported?: number; errors: string[] };
  customers?: { imported?: number; errors: string[] };
  orders?: { imported?: number; errors: string[] };
  error?: string;
};

export default function WooSyncPanel({ isConnected, lastSyncAt }: WooSyncPanelProps) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSync() {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/integrations/woocommerce/sync", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 text-sm">WooCommerce</h3>
            <p className="text-xs text-stone-400">WordPress / WooCommerce sync</p>
          </div>
        </div>
        <p className="text-sm text-stone-400">Connect WooCommerce in the website settings to enable sync.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
          <Package className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 text-sm">WooCommerce Sync</h3>
          {lastSyncAt && (
            <p className="text-xs text-stone-400">
              Last sync: {new Date(lastSyncAt).toLocaleString("en-AU")}
            </p>
          )}
        </div>
        <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />
      </div>

      {result?.success && (
        <div className="mb-4 p-3 bg-emerald-50 rounded-xl text-sm text-emerald-700 space-y-1">
          <p className="font-medium">✓ Sync complete</p>
          {result.products && <p>Products: {result.products.imported ?? 0} imported</p>}
          {result.customers && <p>Customers: {result.customers.imported ?? 0} imported</p>}
          {result.orders && <p>Orders: {result.orders.imported ?? 0} imported</p>}
        </div>
      )}
      {(error || result?.error) && (
        <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">
          {error || result?.error}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-stone-500 mb-3">
          Syncs products, customers, and orders bidirectionally.
        </p>
        <button
          onClick={runSync}
          disabled={syncing}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 disabled:opacity-50 transition"
        >
          {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? "Syncing..." : "Run Full Sync"}
        </button>
      </div>
    </div>
  );
}
