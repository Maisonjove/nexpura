"use client";

import { useState } from "react";
import { RefreshCw, ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from "lucide-react";

interface ShopifySyncPanelProps {
  isConnected: boolean;
  lastSyncAt?: string | null;
}

type SyncResult = { success: boolean; imported?: number; exported?: number; skipped?: number; errors?: string[] };

export default function ShopifySyncPanel({ isConnected, lastSyncAt }: ShopifySyncPanelProps) {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSync(direction: "import" | "export", type: string) {
    const key = `${direction}-${type}`;
    setSyncing(key);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/integrations/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, type }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(null);
    }
  }

  if (!isConnected) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h3 className="font-semibold text-stone-900 text-sm mb-2">Shopify Sync</h3>
        <p className="text-sm text-stone-400">Connect Shopify first to enable two-way sync.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 text-sm">Shopify Two-Way Sync</h3>
          {lastSyncAt && (
            <p className="text-xs text-stone-400 mt-0.5">
              Last sync: {new Date(lastSyncAt).toLocaleString("en-AU")}
            </p>
          )}
        </div>
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      </div>

      {result && (
        <div className={`mb-4 p-3 rounded-xl text-sm ${result.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {result.success
            ? `✓ Synced ${result.imported ?? result.exported ?? 0} items${result.skipped ? `, ${result.skipped} skipped` : ""}`
            : result.errors?.[0] || "Sync failed"}
        </div>
      )}
      {error && <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">{error}</div>}

      <div className="space-y-2">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Import from Shopify</p>
        <div className="grid grid-cols-3 gap-2">
          {(["products", "customers", "orders"] as const).map(type => (
            <button
              key={type}
              onClick={() => runSync("import", type)}
              disabled={!!syncing}
              className="flex flex-col items-center gap-1.5 p-3 border border-stone-200 rounded-xl hover:bg-stone-50 disabled:opacity-50 transition"
            >
              {syncing === `import-${type}` ? (
                <RefreshCw className="w-4 h-4 animate-spin text-stone-500" />
              ) : (
                <ArrowDownToLine className="w-4 h-4 text-stone-500" />
              )}
              <span className="text-xs text-stone-600 capitalize">{type}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 mt-4">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Export to Shopify</p>
        <button
          onClick={() => runSync("export", "inventory")}
          disabled={!!syncing}
          className="w-full flex items-center justify-center gap-2 p-3 border border-stone-200 rounded-xl hover:bg-stone-50 disabled:opacity-50 transition text-sm text-stone-600"
        >
          {syncing === "export-inventory" ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowUpFromLine className="w-4 h-4" />
          )}
          Push Inventory to Shopify
        </button>
      </div>
    </div>
  );
}
