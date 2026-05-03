"use client";

import { useState, useTransition } from "react";
import { Users, Clock, Gift, Star, Zap, Mail, ToggleLeft, ToggleRight } from "lucide-react";
import { setAutomationEnabled } from "./actions";

export interface AutomationRow {
  id: string;
  automationType: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

interface SegmentCounts { vip: number; inactive: number; birthday: number; new: number }

const AUTOMATION_LABELS: Record<string, { name: string; trigger: string; action: string; recommended?: boolean; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  birthday: { name: "Birthday Greeting", trigger: "customer birthday", action: "Send birthday email with optional discount", icon: Gift, recommended: true },
  anniversary: { name: "Anniversary Reminder", trigger: "customer anniversary", action: "Send anniversary email", icon: Gift },
  repair_ready_reminder: { name: "Repair Ready Reminder", trigger: "repair complete + N days uncollected", action: "Email customer to come collect", icon: Clock, recommended: true },
  reengagement: { name: "Re-engagement (Lapsed)", trigger: "no purchase in N months", action: "Send win-back email", icon: Clock, recommended: true },
  post_purchase: { name: "Post-purchase Thank You", trigger: "sale paid", action: "Send receipt + review request", icon: Star },
  appointment_24h: { name: "Appointment — 24h Reminder", trigger: "24h before appointment", action: "SMS/email reminder", icon: Mail },
  appointment_1h: { name: "Appointment — 1h Reminder", trigger: "1h before appointment", action: "SMS reminder", icon: Mail },
  valentines: { name: "Valentine's Campaign", trigger: "Feb 1st", action: "Send seasonal email", icon: Gift },
  mothers_day: { name: "Mother's Day Campaign", trigger: "first Sunday of May", action: "Send seasonal email", icon: Gift },
  christmas: { name: "Christmas Campaign", trigger: "Dec 1st", action: "Send seasonal email", icon: Gift },
};

export default function AutomationClient({
  automations: initial,
  segmentCounts,
}: {
  automations: AutomationRow[];
  segmentCounts: SegmentCounts;
}) {
  const [automations, setAutomations] = useState(initial);
  const [errorById, setErrorById] = useState<Record<string, string | null>>({});
  const [, startTransition] = useTransition();

  const enabledCount = automations.filter((a) => a.enabled).length;

  function handleToggle(a: AutomationRow) {
    const next = !a.enabled;
    // Optimistic
    setAutomations((prev) => prev.map((p) => (p.id === a.id ? { ...p, enabled: next } : p)));
    setErrorById((prev) => ({ ...prev, [a.id]: null }));
    startTransition(async () => {
      const r = await setAutomationEnabled(a.id, next);
      if (r.error) {
        setAutomations((prev) => prev.map((p) => (p.id === a.id ? { ...p, enabled: !next } : p)));
        setErrorById((prev) => ({ ...prev, [a.id]: r.error ?? "Failed to save" }));
      }
    });
  }

  const SEGMENT_CARDS = [
    { id: "vip", name: "VIP Customers", description: "Tagged as VIP", icon: Star, color: "amber-50 text-amber-700", iconBg: "bg-amber-100 text-amber-700", count: segmentCounts.vip },
    { id: "inactive", name: "Inactive (90+ days)", description: "Last activity > 90 days ago", icon: Clock, color: "rose-50 text-rose-700", iconBg: "bg-rose-100 text-rose-700", count: segmentCounts.inactive },
    { id: "birthday", name: "Birthday This Month", description: "Customers celebrating this month", icon: Gift, color: "purple-50 text-purple-700", iconBg: "bg-purple-100 text-purple-700", count: segmentCounts.birthday },
    { id: "new", name: "New Customers", description: "Joined in the last 30 days", icon: Users, color: "emerald-50 text-emerald-700", iconBg: "bg-emerald-100 text-emerald-700", count: segmentCounts.new },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Customer Automation</h1>
        <p className="text-sm text-stone-500 mt-1">
          Automatically send targeted messages to customer segments. Toggles persist immediately.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">Customer Segments</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SEGMENT_CARDS.map((seg) => {
            const Icon = seg.icon;
            return (
              <div key={seg.id} className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${seg.iconBg}`}>
                  <Icon size={18} />
                </div>
                <h3 className="font-semibold text-stone-900 text-sm mb-1">{seg.name}</h3>
                <p className="text-xs text-stone-400 mb-2">{seg.description}</p>
                <p className="text-2xl font-bold text-stone-900">{seg.count}</p>
                <p className="text-xs text-stone-400 mt-0.5">customer{seg.count === 1 ? "" : "s"}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider">Automation Rules</h2>
          <span className="text-xs text-stone-400">{enabledCount}/{automations.length} active</span>
        </div>
        <div className="space-y-3">
          {automations.map((a) => {
            const meta = AUTOMATION_LABELS[a.automationType] ?? {
              name: a.automationType.replaceAll("_", " "),
              trigger: a.automationType,
              action: "Send email",
              icon: Zap,
            };
            const Icon = meta.icon ?? Zap;
            return (
              <div
                key={a.id}
                className={`bg-white rounded-xl border p-5 shadow-sm transition-all ${a.enabled ? "border-amber-200" : "border-stone-200"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${a.enabled ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-stone-900 text-sm">{meta.name}</h3>
                        {meta.recommended && (
                          <span className="text-xs font-medium px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500">{meta.action}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(a)}
                    className="flex-shrink-0 transition-colors"
                    title={a.enabled ? "Disable automation" : "Enable automation"}
                    aria-label={`${a.enabled ? "Disable" : "Enable"} ${meta.name}`}
                  >
                    {a.enabled
                      ? <ToggleRight size={32} className="text-amber-600" />
                      : <ToggleLeft size={32} className="text-stone-300" />}
                  </button>
                </div>
                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-4 text-xs text-stone-500">
                  <span className="flex items-center gap-1">
                    <Zap size={12} className="text-amber-600" />
                    Trigger: <strong>{meta.trigger}</strong>
                  </span>
                </div>
                {errorById[a.id] && (
                  <p className="mt-2 text-xs text-red-600">{errorById[a.id]}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
