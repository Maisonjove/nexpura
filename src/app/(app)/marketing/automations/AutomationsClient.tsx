"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Zap,
  Cake,
  Gift,
  Heart,
  Wrench,
  UserMinus,
  ShoppingBag,
  Calendar,
  PartyPopper,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toggleAutomation, updateAutomation } from "./actions";

interface Automation {
  id: string;
  automation_type: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  template_id: string | null;
}

interface Template {
  id: string;
  name: string;
  template_type: string | null;
}

interface Props {
  automations: Automation[];
  templates: Template[];
  tenantId: string;
}

interface SettingOption {
  value: number;
  label: string;
}

interface AutomationSetting {
  key: string;
  label: string;
  type: "select" | "toggle";
  options?: SettingOption[];
}

interface AutomationConfig {
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  settings: AutomationSetting[];
}

const AUTOMATION_CONFIG: Record<string, AutomationConfig> = {
  birthday: {
    name: "Birthday Wishes",
    description: "Send personalized birthday emails to customers",
    icon: Cake,
    color: "text-pink-400 bg-pink-500/10",
    settings: [
      {
        key: "days_before",
        label: "Send",
        type: "select",
        options: [
          { value: 0, label: "On their birthday" },
          { value: 1, label: "1 day before" },
          { value: 3, label: "3 days before" },
          { value: 7, label: "7 days before" },
        ],
      },
      {
        key: "include_discount",
        label: "Include discount code",
        type: "toggle",
      },
    ],
  },
  anniversary: {
    name: "Anniversary Wishes",
    description: "Celebrate customer anniversaries (first purchase date)",
    icon: Heart,
    color: "text-red-400 bg-red-500/10",
    settings: [
      {
        key: "days_before",
        label: "Send",
        type: "select",
        options: [
          { value: 0, label: "On their anniversary" },
          { value: 1, label: "1 day before" },
          { value: 7, label: "7 days before" },
        ],
      },
    ],
  },
  repair_ready_reminder: {
    name: "Repair Ready Reminder",
    description: "Remind customers to collect completed repairs",
    icon: Wrench,
    color: "text-amber-400 bg-amber-500/10",
    settings: [
      {
        key: "days_after",
        label: "Send reminder after",
        type: "select",
        options: [
          { value: 3, label: "3 days" },
          { value: 5, label: "5 days" },
          { value: 7, label: "7 days" },
          { value: 14, label: "14 days" },
        ],
      },
    ],
  },
  reengagement: {
    name: "Re-engagement",
    description: '"We miss you" emails for inactive customers',
    icon: UserMinus,
    color: "text-blue-400 bg-blue-500/10",
    settings: [
      {
        key: "months_inactive",
        label: "Send after inactive for",
        type: "select",
        options: [
          { value: 3, label: "3 months" },
          { value: 6, label: "6 months" },
          { value: 12, label: "12 months" },
        ],
      },
      {
        key: "include_offer",
        label: "Include special offer",
        type: "toggle",
      },
    ],
  },
  post_purchase: {
    name: "Post-Purchase Thank You",
    description: "Automatic thank you email after purchase",
    icon: ShoppingBag,
    color: "text-green-400 bg-green-500/10",
    settings: [
      {
        key: "request_review",
        label: "Request a review",
        type: "toggle",
      },
    ],
  },
  appointment_24h: {
    name: "Appointment Reminder (24h)",
    description: "Remind customers 24 hours before appointment",
    icon: Calendar,
    color: "text-purple-400 bg-purple-500/10",
    settings: [],
  },
  appointment_1h: {
    name: "Appointment Reminder (1h)",
    description: "Remind customers 1 hour before appointment",
    icon: Calendar,
    color: "text-indigo-400 bg-indigo-500/10",
    settings: [],
  },
  valentines: {
    name: "Valentine's Day",
    description: "Send Valentine's Day promotional email (February)",
    icon: Heart,
    color: "text-rose-400 bg-rose-500/10",
    settings: [],
  },
  mothers_day: {
    name: "Mother's Day",
    description: "Send Mother's Day promotional email (May)",
    icon: Gift,
    color: "text-fuchsia-400 bg-fuchsia-500/10",
    settings: [],
  },
  christmas: {
    name: "Christmas",
    description: "Send Christmas promotional email (December)",
    icon: PartyPopper,
    color: "text-emerald-400 bg-emerald-500/10",
    settings: [],
  },
};

type AutomationKey = string;

export default function AutomationsClient({ automations, templates, tenantId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function getAutomation(type: string): Automation | undefined {
    return automations.find((a) => a.automation_type === type);
  }

  async function handleToggle(type: string, enabled: boolean) {
    setLoading(type);
    const result = await toggleAutomation(type, enabled);
    if (result.error) {
      alert(result.error);
    }
    setLoading(null);
    router.refresh();
  }

  async function handleSettingChange(
    type: string,
    key: string,
    value: unknown,
    currentSettings: Record<string, unknown>
  ) {
    setLoading(type);
    const result = await updateAutomation(type, {
      settings: { ...currentSettings, [key]: value },
    });
    if (result.error) {
      alert(result.error);
    }
    setLoading(null);
    router.refresh();
  }

  function renderAutomationCard(type: AutomationKey) {
    const config = AUTOMATION_CONFIG[type];
    const automation = getAutomation(type);
    const isEnabled = automation?.enabled ?? false;
    const settings = automation?.settings || {};
    const isExpanded = expanded === type;
    const Icon = config.icon;

    return (
      <div
        key={type}
        className={`bg-[#1A1A1A] border rounded-lg overflow-hidden transition-colors ${
          isEnabled ? "border-amber-500/30" : "border-white/[0.06]"
        }`}
      >
        <div className="p-4">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h3 className="font-medium text-white">{config.name}</h3>
                {isEnabled && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                    Active
                  </span>
                )}
              </div>
              <p className="text-sm text-stone-400 mt-0.5">{config.description}</p>
            </div>

            <div className="flex items-center gap-3">
              {config.settings.length > 0 && (
                <button
                  onClick={() => setExpanded(isExpanded ? null : type)}
                  className="p-2 hover:bg-white/[0.05] rounded-lg text-stone-400 hover:text-white transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              )}

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => handleToggle(type, e.target.checked)}
                  disabled={loading === type}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500/40 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {isExpanded && config.settings.length > 0 && (
          <div className="px-4 pb-4 pt-2 border-t border-white/[0.06] bg-white/[0.01]">
            <div className="space-y-3">
              {config.settings.map((setting) => (
                <div key={setting.key} className="flex items-center justify-between">
                  <label className="text-sm text-stone-300">{setting.label}</label>

                  {setting.type === "select" && (
                    <select
                      value={(settings[setting.key] as number) ?? setting.options?.[0]?.value}
                      onChange={(e) =>
                        handleSettingChange(
                          type,
                          setting.key,
                          parseInt(e.target.value),
                          settings
                        )
                      }
                      disabled={loading === type}
                      className="px-3 py-1.5 bg-[#252525] border border-white/[0.06] rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    >
                      {setting.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {setting.type === "toggle" && (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(settings[setting.key] as boolean) ?? false}
                        onChange={(e) =>
                          handleSettingChange(type, setting.key, e.target.checked, settings)
                        }
                        disabled={loading === type}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-stone-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500/40 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const customerAutomations: AutomationKey[] = [
    "birthday",
    "anniversary",
    "post_purchase",
    "reengagement",
  ];
  const operationalAutomations: AutomationKey[] = [
    "repair_ready_reminder",
    "appointment_24h",
    "appointment_1h",
  ];
  const holidayAutomations: AutomationKey[] = ["valentines", "mothers_day", "christmas"];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/marketing"
          className="p-2 hover:bg-white/[0.05] rounded-lg text-stone-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-400" />
            Marketing Automations
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            Set up automatic emails that engage customers at the right moment
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
        <p className="text-blue-300 text-sm">
          <strong>How it works:</strong> When enabled, these automations run automatically based
          on customer data and events. Emails are personalized using your templates and sent via
          your configured email settings.
        </p>
      </div>

      {/* Customer Engagement */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-stone-300 uppercase tracking-wide mb-4">
          Customer Engagement
        </h2>
        <div className="space-y-3">
          {customerAutomations.map((type) => renderAutomationCard(type))}
        </div>
      </div>

      {/* Operational */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-stone-300 uppercase tracking-wide mb-4">
          Operational Reminders
        </h2>
        <div className="space-y-3">
          {operationalAutomations.map((type) => renderAutomationCard(type))}
        </div>
      </div>

      {/* Holiday */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-stone-300 uppercase tracking-wide mb-4">
          Holiday Campaigns
        </h2>
        <div className="space-y-3">
          {holidayAutomations.map((type) => renderAutomationCard(type))}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-4">
        <h3 className="font-medium text-white mb-2">💡 Automation Tips</h3>
        <ul className="text-sm text-stone-300 space-y-1">
          <li>• Birthday emails have 3x higher engagement than regular emails</li>
          <li>• Sending repair reminders reduces uncollected items by 60%</li>
          <li>• Re-engagement campaigns can recover 10% of lapsed customers</li>
          <li>• Enable appointment reminders to reduce no-shows</li>
        </ul>
      </div>
    </div>
  );
}
