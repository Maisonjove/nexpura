"use client";

import { useState } from "react";
import { Users, Clock, Gift, Star, Zap, Mail, ToggleLeft, ToggleRight, ChevronRight } from "lucide-react";

const SEGMENTS = [
  {
    id: "vip",
    name: "VIP Customers",
    description: "Customers who've spent over $5,000",
    rule: "total_spend > 5000",
    icon: Star,
    color: "amber",
    count: null,
  },
  {
    id: "inactive",
    name: "Inactive (90+ days)",
    description: "No purchase in the last 90 days",
    rule: "last_purchase > 90 days",
    icon: Clock,
    color: "rose",
    count: null,
  },
  {
    id: "birthday",
    name: "Birthday This Month",
    description: "Customers celebrating their birthday",
    rule: "birthday_month = current",
    icon: Gift,
    color: "purple",
    count: null,
  },
  {
    id: "new",
    name: "New Customers",
    description: "Joined in the last 30 days",
    rule: "created < 30 days",
    icon: Users,
    color: "emerald",
    count: null,
  },
];

const AUTOMATIONS = [
  {
    id: "birthday_discount",
    trigger: "birthday",
    name: "Birthday Discount",
    action: "Send birthday discount email with 10% off",
    discount: "10%",
    icon: Gift,
    recommended: true,
  },
  {
    id: "winback",
    trigger: "inactive_60",
    name: "Win-Back Campaign",
    action: "Send win-back email after 60 days of inactivity",
    discount: "15%",
    icon: Clock,
    recommended: true,
  },
  {
    id: "first_purchase",
    trigger: "first_purchase",
    name: "Thank You — First Purchase",
    action: "Send thank you email after first purchase",
    discount: null,
    icon: Star,
    recommended: false,
  },
  {
    id: "repair_feedback",
    trigger: "repair_complete",
    name: "Repair Feedback Request",
    action: "Send feedback request when repair is marked ready",
    discount: null,
    icon: Zap,
    recommended: false,
  },
];

const EMAIL_TEMPLATES = [
  { id: "birthday", name: "Birthday Celebration", preview: "Happy Birthday! Here's a special gift from us..." },
  { id: "winback", name: "We Miss You", preview: "It's been a while since your last visit..." },
  { id: "thankyou", name: "Thank You", preview: "Thank you for your purchase! We're so grateful..." },
  { id: "feedback", name: "How Did We Do?", preview: "Your repair is ready! We'd love to hear your feedback..." },
];

export default function AutomationPage() {
  const [enabledAutomations, setEnabledAutomations] = useState<Set<string>>(
    new Set(["birthday_discount", "repair_feedback"])
  );
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  function toggleAutomation(id: string) {
    setEnabledAutomations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const colorMap: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  const iconBgMap: Record<string, string> = {
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    purple: "bg-purple-100 text-purple-700",
    emerald: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Customer Automation</h1>
        <p className="text-sm text-stone-500 mt-1">
          Automatically send targeted messages to customer segments
        </p>
      </div>

      {/* Segments */}
      <section>
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
          Customer Segments
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SEGMENTS.map((seg) => {
            const Icon = seg.icon;
            return (
              <div
                key={seg.id}
                className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm hover:border-stone-300 transition-colors cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${iconBgMap[seg.color]}`}>
                  <Icon size={18} />
                </div>
                <h3 className="font-semibold text-stone-900 text-sm mb-1">{seg.name}</h3>
                <p className="text-xs text-stone-400 mb-3">{seg.description}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colorMap[seg.color]}`}>
                  Auto-segment
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Automation Rules */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider">
            Automation Rules
          </h2>
          <span className="text-xs text-stone-400">
            {enabledAutomations.size}/{AUTOMATIONS.length} active
          </span>
        </div>
        <div className="space-y-3">
          {AUTOMATIONS.map((auto) => {
            const Icon = auto.icon;
            const enabled = enabledAutomations.has(auto.id);
            return (
              <div
                key={auto.id}
                className={`bg-white rounded-xl border p-5 shadow-sm transition-all ${
                  enabled ? "border-amber-200" : "border-stone-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        enabled ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-stone-900 text-sm">{auto.name}</h3>
                        {auto.recommended && (
                          <span className="text-xs font-medium px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                            Recommended
                          </span>
                        )}
                        {auto.discount && (
                          <span className="text-xs font-medium px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                            {auto.discount} discount
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500">{auto.action}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAutomation(auto.id)}
                    className="flex-shrink-0 transition-colors"
                    title={enabled ? "Disable automation" : "Enable automation"}
                  >
                    {enabled ? (
                      <ToggleRight size={32} className="text-amber-600" />
                    ) : (
                      <ToggleLeft size={32} className="text-stone-300" />
                    )}
                  </button>
                </div>

                {/* Trigger summary */}
                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-4 text-xs text-stone-500">
                  <span className="flex items-center gap-1">
                    <Zap size={12} className="text-amber-600" />
                    Trigger: <strong>{auto.trigger.replace(/_/g, " ")}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail size={12} className="text-stone-400" />
                    Action: email
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Email Templates */}
      <section>
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
          Email Templates
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EMAIL_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => setSelectedTemplate(tpl.id === selectedTemplate ? null : tpl.id)}
              className={`text-left bg-white rounded-xl border p-4 shadow-sm transition-all hover:border-amber-300 ${
                selectedTemplate === tpl.id ? "border-amber-400 ring-1 ring-amber-200" : "border-stone-200"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-stone-900 text-sm">{tpl.name}</h3>
                <ChevronRight
                  size={16}
                  className={`text-stone-400 transition-transform ${selectedTemplate === tpl.id ? "rotate-90" : ""}`}
                />
              </div>
              <p className="text-xs text-stone-400 line-clamp-1">{tpl.preview}</p>
              {selectedTemplate === tpl.id && (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <div className="bg-stone-50 rounded-lg p-3 text-xs text-stone-600 font-mono">
                    {tpl.preview}
                    <br />
                    <br />
                    {"[Customer Name], we have a special offer just for you."}
                    <br />
                    <br />
                    {"Use code: AUTO10 at checkout."}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button className="text-xs bg-nexpura-charcoal text-white px-3 py-1.5 rounded-md hover:bg-nexpura-charcoal-700 transition-colors">
                      Edit Template
                    </button>
                    <button className="text-xs bg-stone-100 text-stone-700 px-3 py-1.5 rounded-md hover:bg-stone-200 transition-colors">
                      Preview
                    </button>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Save Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-amber-900">
            {enabledAutomations.size} automation{enabledAutomations.size !== 1 ? "s" : ""} active
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Changes are saved automatically when you toggle automations
          </p>
        </div>
        <button className="bg-nexpura-charcoal text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-nexpura-charcoal-700 transition-colors">
          Save Settings
        </button>
      </div>
    </div>
  );
}
