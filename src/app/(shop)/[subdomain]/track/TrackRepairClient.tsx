"use client";

import { useState } from "react";
import { Search, Wrench, CheckCircle2, Clock, AlertCircle, Phone, Mail, MapPin } from "lucide-react";

interface TrackResult {
  ticket: {
    number: string;
    item: string;
    stage: string;
    stageLabel: string;
    estimatedReady: string | null;
    receivedAt: string;
  };
  store: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
}

const STAGE_ORDER = [
  "intake",
  "quoted",
  "approved",
  "in_progress",
  "in_workshop",
  "quality_check",
  "ready",
  "collected",
];

const STAGE_LABELS: Record<string, string> = {
  intake: "Received",
  quoted: "Quote Ready",
  approved: "Approved",
  in_progress: "In Progress",
  in_workshop: "In Workshop",
  quality_check: "Quality Check",
  ready: "Ready for Collection",
  collected: "Collected",
  cancelled: "Cancelled",
  on_hold: "On Hold",
};

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function StageTimeline({ stage }: { stage: string }) {
  const currentIdx = STAGE_ORDER.indexOf(stage);
  const isCancelled = stage === "cancelled";
  const isOnHold = stage === "on_hold";

  if (isCancelled || isOnHold) {
    return (
      <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
        <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
        <span className="text-sm font-medium text-amber-800">
          {isCancelled
            ? "This repair has been cancelled. Please contact us for more information."
            : "This repair is currently on hold. Please contact us for more information."}
        </span>
      </div>
    );
  }

  const displayStages = ["intake", "in_progress", "quality_check", "ready"];

  return (
    <div className="space-y-3">
      {displayStages.map((s) => {
        const idx = STAGE_ORDER.indexOf(s);
        const completed = currentIdx >= idx && currentIdx >= 0;
        const isActiveStep =
          STAGE_ORDER[currentIdx] === s ||
          (s === "in_progress" && ["approved", "in_progress", "in_workshop"].includes(stage));
        return (
          <div key={s} className="flex items-center gap-4">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                completed
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "bg-white border-stone-200 text-stone-300"
              }`}
            >
              {completed ? <CheckCircle2 size={14} /> : <Clock size={14} />}
            </div>
            <span
              className={`text-sm ${completed ? "text-stone-900" : "text-stone-400"} ${
                isActiveStep ? "font-bold" : "font-medium"
              }`}
            >
              {STAGE_LABELS[s] ?? s}
              {isActiveStep && completed && (
                <span className="ml-2 text-xs text-emerald-600 font-normal">← Current step</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function TrackRepairClient({ subdomain }: { subdomain: string }) {
  const [ticketNumber, setTicketNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!ticketNumber.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(
        `/api/shop/${subdomain}/repair-track?ticket=${encodeURIComponent(ticketNumber.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error ?? "Repair ticket not found. Please check the number and try again."
        );
      } else {
        setResult(data);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const isReady = result?.ticket.stage === "ready";
  const isCollected = result?.ticket.stage === "collected";

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <div className="w-14 h-14 bg-[#8B7355]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Wrench size={26} className="text-[#8B7355]" />
        </div>
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Track Your Repair</h1>
        <p className="text-stone-500 text-sm">
          Enter your repair ticket number to check the current status of your piece.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-lg overflow-hidden">
        <div className="p-6 border-b border-stone-100">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value.toUpperCase())}
                placeholder="e.g. REP-1001"
                className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B7355] font-mono text-base"
              />
            </div>
            <button
              disabled={loading}
              type="submit"
              className="px-6 py-3 bg-[#8B7355] text-white rounded-xl font-semibold hover:bg-[#7A6347] transition-all disabled:opacity-50 text-sm"
            >
              {loading ? "Searching…" : "Track"}
            </button>
          </form>
        </div>

        {error && (
          <div className="p-6 flex items-start gap-3 text-red-700 bg-red-50 border-t border-red-100">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {result && (
          <div className="p-6 space-y-6">
            {/* Status banner */}
            {isReady && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">
                    Your item is ready for collection! 🎉
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Please bring this ticket number when you come in.
                  </p>
                </div>
              </div>
            )}
            {isCollected && (
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl flex items-center gap-3">
                <CheckCircle2 size={20} className="text-stone-500 flex-shrink-0" />
                <p className="text-sm font-medium text-stone-700">
                  This item has been collected. Thank you!
                </p>
              </div>
            )}

            {/* Item info */}
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
                Your Item
              </p>
              <h2 className="text-lg font-bold text-stone-900">{result.ticket.item}</h2>
              <p className="text-sm text-stone-500 mt-0.5 font-mono">
                Ticket #{result.ticket.number}
              </p>
            </div>

            {/* Stage */}
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
                Repair Progress
              </p>
              <StageTimeline stage={result.ticket.stage} />
              <div className="mt-3 inline-block px-3 py-1.5 bg-[#8B7355]/10 text-[#8B7355] rounded-full text-xs font-semibold">
                {result.ticket.stageLabel}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-stone-50 rounded-xl">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
                  Received
                </p>
                <p className="text-sm font-medium text-stone-900">
                  {fmtDate(result.ticket.receivedAt)}
                </p>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
                  Est. Ready
                </p>
                <p className="text-sm font-medium text-stone-900">
                  {fmtDate(result.ticket.estimatedReady) ?? "To be advised"}
                </p>
              </div>
            </div>

            {/* Store contact */}
            <div className="border-t border-stone-100 pt-4">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
                Questions? Contact Us
              </p>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-stone-900">{result.store.name}</p>
                {result.store.phone && (
                  <a
                    href={`tel:${result.store.phone}`}
                    className="flex items-center gap-2 text-sm text-[#8B7355] hover:underline"
                  >
                    <Phone size={14} /> {result.store.phone}
                  </a>
                )}
                {result.store.email && (
                  <a
                    href={`mailto:${result.store.email}`}
                    className="flex items-center gap-2 text-sm text-[#8B7355] hover:underline"
                  >
                    <Mail size={14} /> {result.store.email}
                  </a>
                )}
                {result.store.address && (
                  <p className="flex items-start gap-2 text-sm text-stone-500">
                    <MapPin size={14} className="flex-shrink-0 mt-0.5" /> {result.store.address}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
