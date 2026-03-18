"use client";

import { useState } from "react";
import { Calendar, CheckCircle2, Loader2, RefreshCw, Unlink, Clock, AlertTriangle } from "lucide-react";

interface GoogleCalendarClientProps {
  isConnected: boolean;
  calendarEmail?: string | null;
  calendarId?: string | null;
  lastSyncAt?: string | null;
}

export default function GoogleCalendarClient({
  isConnected,
  calendarEmail,
  calendarId,
  lastSyncAt,
}: GoogleCalendarClientProps) {
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncResult, setSyncResult] = useState<{ appointments: number; repairs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    
    try {
      const res = await fetch("/api/integrations/google-calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "all" }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Sync failed");
      }
      
      setSyncResult(data.synced);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Google Calendar? Future appointments won't sync.")) {
      return;
    }
    
    setDisconnecting(true);
    setError(null);
    
    try {
      const res = await fetch("/api/integrations/google-calendar/setup", {
        method: "DELETE",
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Disconnect failed");
      }
      
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
      setDisconnecting(false);
    }
  };

  const formatLastSync = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);
    
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff} minutes ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className={`rounded-xl border p-6 ${
        isConnected 
          ? "bg-green-50/50 border-green-200" 
          : "bg-stone-50 border-stone-200"
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isConnected ? "bg-green-100 text-green-600" : "bg-stone-200 text-stone-500"
          }`}>
            <Calendar className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-stone-900">
                {isConnected ? "Connected" : "Not Connected"}
              </h3>
              {isConnected && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  Active
                </span>
              )}
            </div>
            
            {isConnected && calendarEmail && (
              <p className="text-sm text-stone-600 mt-1">
                Syncing to: <span className="font-medium">{calendarEmail}</span>
              </p>
            )}
            
            {isConnected && lastSyncAt && (
              <p className="text-xs text-stone-500 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last synced: {formatLastSync(lastSyncAt)}
              </p>
            )}
            
            {!isConnected && (
              <p className="text-sm text-stone-500 mt-1">
                Connect your Google Calendar to sync appointments and repair due dates automatically.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <h4 className="font-medium text-stone-900">Actions</h4>
        
        {!isConnected ? (
          <a
            href="/api/integrations/google-calendar/connect"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Connect Google Calendar
          </a>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sync Now
                </>
              )}
            </button>
            
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 font-medium rounded-lg hover:bg-stone-200 transition-colors disabled:opacity-50"
            >
              {disconnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <Unlink className="w-4 h-4" />
                  Disconnect
                </>
              )}
            </button>
          </div>
        )}

        {/* Sync Result */}
        {syncResult && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            <CheckCircle2 className="w-4 h-4 inline-block mr-2" />
            Synced {syncResult.appointments} appointments and {syncResult.repairs} repair due dates
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <AlertTriangle className="w-4 h-4 inline-block mr-2" />
            {error}
          </div>
        )}
      </div>

      {/* What Gets Synced */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h4 className="font-medium text-stone-900 mb-3">What Gets Synced</h4>
        <ul className="space-y-2 text-sm text-stone-600">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span><strong>Appointments</strong> — Customer appointments appear as calendar events</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span><strong>Repair Due Dates</strong> — When a repair is due, it shows as an all-day event</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span><strong>Updates</strong> — Changes in Nexpura reflect in your calendar</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
