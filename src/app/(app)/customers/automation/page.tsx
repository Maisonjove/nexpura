"use client";

import { Zap, Bell, Play, Pause, Clock } from "lucide-react";

const EXAMPLE_RULES = [
  {
    id: "1",
    name: "Welcome Email",
    trigger: "New Customer Created",
    action: "Send Email (Template: Welcome)",
    isActive: true,
  },
  {
    id: "2",
    name: "Birthday SMS",
    trigger: "Birthday is in 7 days",
    action: "Send SMS (Template: Bday Promo)",
    isActive: true,
  },
  {
    id: "3",
    name: "Post-Purchase Follow-up",
    trigger: "Sale Completed",
    action: "Create Task: Follow-up Call",
    isActive: false,
  },
];

export default function AutomationPage() {
  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 font-serif">Marketing Automation</h1>
          <p className="text-sm text-stone-500 mt-0.5">Automate your customer communications and workflows</p>
        </div>
        <button
          disabled
          title="Coming soon"
          className="flex items-center gap-2 px-4 py-2 bg-stone-200 text-stone-400 rounded-xl font-bold cursor-not-allowed opacity-60"
        >
          + New Automation
        </button>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
        <div className="p-2 rounded-lg bg-amber-100 text-amber-600 mt-0.5">
          <Clock size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-amber-900 mb-1">Automation rules are coming soon</h3>
          <p className="text-sm text-amber-700 leading-relaxed">
            Rules shown below are examples only. No automations are currently active or being triggered.
            Save and Enable buttons are disabled until this feature is fully available.
          </p>
        </div>
      </div>

      {/* Example rules — disabled */}
      <div className="grid grid-cols-1 gap-4">
        {EXAMPLE_RULES.map((rule) => (
          <div
            key={rule.id}
            className="bg-white rounded-2xl border border-stone-200 p-6 flex items-center justify-between opacity-60"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-stone-100 text-stone-400">
                <Zap size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-stone-700">{rule.name}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-400">
                    Example
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-stone-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Bell size={14} className="text-stone-300" /> Trigger: {rule.trigger}
                  </span>
                  <span className="w-1 h-1 bg-stone-200 rounded-full" />
                  <span className="flex items-center gap-1">
                    <Play size={14} className="text-stone-300" /> Action: {rule.action}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled
                title="Coming soon"
                className="p-2 text-stone-300 rounded-lg cursor-not-allowed"
              >
                {rule.isActive ? <Pause size={18} /> : <Play size={18} />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
