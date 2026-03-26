"use client";

import { useState } from "react";
import { Mail, RefreshCw, CheckCircle2 } from "lucide-react";

interface MailchimpPanelProps {
  isConnected: boolean;
  lastSyncAt?: string | null;
}

export default function MailchimpPanel({ isConnected, lastSyncAt }: MailchimpPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [listId, setListId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connected, setConnected] = useState(isConnected);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    if (!apiKey || !listId) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/mailchimp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, list_id: listId, auto_sync: true }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setConnected(true);
        setResult("✓ Connected to Mailchimp");
      }
    } catch (err) {
      setError("Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/integrations/mailchimp/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setResult(`✓ Synced ${data.synced} subscribers`);
      } else {
        setError(data.errors?.[0] || "Sync failed");
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
          <Mail className="w-4 h-4 text-yellow-600" />
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 text-sm">Mailchimp</h3>
          <p className="text-xs text-stone-400">Sync customers to your email audience</p>
        </div>
        {connected && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}
      </div>

      {result && <div className="mb-3 p-3 bg-emerald-50 rounded-xl text-sm text-emerald-700">{result}</div>}
      {error && <div className="mb-3 p-3 bg-red-50 rounded-xl text-sm text-red-700">{error}</div>}

      {!connected ? (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Mailchimp API key (xxx-us14)"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            className="w-full text-sm px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <input
            type="text"
            placeholder="Audience/List ID"
            value={listId}
            onChange={e => setListId(e.target.value)}
            className="w-full text-sm px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <button
            onClick={connect}
            disabled={connecting || !apiKey || !listId}
            className="w-full py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 disabled:opacity-50 transition"
          >
            {connecting ? "Connecting..." : "Connect Mailchimp"}
          </button>
          <p className="text-xs text-stone-400 text-center">
            Find your API key in Mailchimp → Account → Extras → API Keys
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lastSyncAt && (
            <p className="text-xs text-stone-400">
              Last synced: {new Date(lastSyncAt).toLocaleString("en-AU")}
            </p>
          )}
          <button
            onClick={syncNow}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition"
          >
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Customers Now
          </button>
          <p className="text-xs text-stone-400">
            Customers with marketing consent are automatically synced to your Mailchimp audience.
          </p>
        </div>
      )}
    </div>
  );
}
