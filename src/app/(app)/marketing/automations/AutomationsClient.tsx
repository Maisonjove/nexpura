"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BoltIcon,
  CakeIcon,
  GiftIcon,
  HeartIcon,
  WrenchIcon,
  UserMinusIcon,
  ShoppingBagIcon,
  CalendarIcon,
  SparklesIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import {
  toggleAutomation,
  updateAutomation,
  previewAutomationMatches,
  type AutomationTestRunResult,
} from "./actions";

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
  settings: AutomationSetting[];
}

const AUTOMATION_CONFIG: Record<string, AutomationConfig> = {
  birthday: {
    name: "Birthday Wishes",
    description: "Send personalised birthday emails to customers.",
    icon: CakeIcon,
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
    description: "Celebrate customer anniversaries from their first purchase date.",
    icon: HeartIcon,
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
    description: "Remind customers to collect completed repairs.",
    icon: WrenchIcon,
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
    description: "A quiet \u201Cwe miss you\u201D note to customers who have drifted away.",
    icon: UserMinusIcon,
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
    description: "An automatic thank you note after each purchase.",
    icon: ShoppingBagIcon,
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
    description: "Remind customers 24 hours before their appointment.",
    icon: CalendarIcon,
    settings: [],
  },
  appointment_1h: {
    name: "Appointment Reminder (1h)",
    description: "A gentle nudge an hour before the appointment.",
    icon: CalendarIcon,
    settings: [],
  },
  valentines: {
    name: "Valentine's Day",
    description: "A seasonal Valentine's promotion sent in February.",
    icon: HeartIcon,
    settings: [],
  },
  mothers_day: {
    name: "Mother's Day",
    description: "A seasonal Mother's Day promotion sent in May.",
    icon: GiftIcon,
    settings: [],
  },
  christmas: {
    name: "Christmas",
    description: "A festive Christmas promotion sent in December.",
    icon: SparklesIcon,
    settings: [],
  },
};

type AutomationKey = string;

export default function AutomationsClient({ automations, templates, tenantId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // M-08: per-automation test-run result. Keyed by automationType.
  const [testRunResult, setTestRunResult] = useState<
    Record<string, AutomationTestRunResult & { at: number }>
  >({});
  const [testRunPending, setTestRunPending] = useState<string | null>(null);

  async function handleTestRun(type: string) {
    setTestRunPending(type);
    const result = await previewAutomationMatches(type);
    setTestRunPending(null);
    setTestRunResult((prev) => ({ ...prev, [type]: { ...result, at: Date.now() } }));
  }

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
    const hasSettings = config.settings.length > 0;
    const Icon = config.icon;

    return (
      <div
        key={type}
        className="group bg-white border border-stone-200 rounded-2xl overflow-hidden transition-all duration-400 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 hover:-translate-y-0.5"
      >
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-5 sm:gap-6">
            <div className="shrink-0 mt-1">
              <Icon
                className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300"
                strokeWidth={1.5}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-serif text-xl sm:text-[1.4rem] text-stone-900 leading-tight tracking-tight">
                  {config.name}
                </h3>
                {isEnabled ? (
                  <span className="nx-badge-success">Active</span>
                ) : (
                  <span className="nx-badge-neutral">Off</span>
                )}
              </div>
              <p className="text-sm text-stone-500 mt-2 leading-relaxed max-w-xl">
                {config.description}
              </p>

              <div className="flex items-center gap-4 mt-4 flex-wrap">
                {hasSettings && (
                  <button
                    onClick={() => setExpanded(isExpanded ? null : type)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-nexpura-bronze transition-colors duration-200"
                    aria-expanded={isExpanded}
                    aria-controls={`automation-settings-${type}`}
                  >
                    {isExpanded ? "Hide settings" : "Configure"}
                    <ChevronDownIcon
                      className={`w-3.5 h-3.5 transition-transform duration-300 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                )}
                {/* M-08: Test run button — counts customers that would match
                    this automation today without sending. */}
                <button
                  type="button"
                  onClick={() => handleTestRun(type)}
                  disabled={testRunPending === type}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-nexpura-bronze transition-colors duration-200 disabled:opacity-50"
                >
                  {testRunPending === type ? "Running…" : "Test run"}
                </button>
              </div>
              {testRunResult[type] && (
                <p
                  role="status"
                  className="mt-2 text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-md px-3 py-1.5 inline-block"
                >
                  {testRunResult[type].error
                    ? `Test run failed: ${testRunResult[type].error}`
                    : testRunResult[type].unsupported
                      ? testRunResult[type].reason ?? "Test run not supported."
                      : `Would match ${testRunResult[type].matchedCount ?? 0} customer${
                          (testRunResult[type].matchedCount ?? 0) === 1 ? "" : "s"
                        } if fired now (no email sent).`}
                </p>
              )}
            </div>

            <div className="shrink-0 mt-1">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => handleToggle(type, e.target.checked)}
                  disabled={loading === type}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-nexpura-bronze/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nexpura-bronze"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {isExpanded && hasSettings && (
          <div
            id={`automation-settings-${type}`}
            className="px-6 sm:px-7 pb-6 sm:pb-7 pt-5 border-t border-stone-200 bg-stone-50/40"
          >
            <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-4">
              Settings
            </p>
            <div className="space-y-4">
              {config.settings.map((setting) => (
                <div
                  key={setting.key}
                  className="flex items-center justify-between gap-4 py-1"
                >
                  <label className="text-sm text-stone-700">{setting.label}</label>

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
                      className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-900 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
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
                      <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-nexpura-bronze/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-nexpura-bronze"></div>
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

  const totalConfigured =
    customerAutomations.length + operationalAutomations.length + holidayAutomations.length;
  const totalEnabled = automations.filter((a) => a.enabled).length;

  if (totalConfigured === 0) {
    return (
      <div className="bg-nexpura-ivory min-h-screen">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <BoltIcon
              className="w-8 h-8 text-stone-300 mx-auto mb-5"
              strokeWidth={1.5}
            />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              No automations available
            </h3>
            <p className="text-stone-500 text-sm mb-7 max-w-sm mx-auto leading-relaxed">
              Configure email templates first, then set up automated campaigns to engage customers
              automatically.
            </p>
            <Link href="/marketing" className="nx-btn-primary inline-flex items-center gap-2">
              Back to Marketing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-nexpura-ivory min-h-screen">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div className="flex items-start gap-4">
            <Link
              href="/marketing"
              className="mt-2 text-stone-400 hover:text-nexpura-bronze transition-colors duration-300"
              aria-label="Back to marketing"
            >
              <ArrowLeftIcon className="w-5 h-5" strokeWidth={1.5} />
            </Link>
            <div>
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                Marketing
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-stone-900 leading-tight">
                Automations
              </h1>
              <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
                Quiet, well-timed messages — birthdays, appointments, holidays — sent automatically
                so the right note arrives at the right moment.
              </p>
              <div className="flex items-center gap-4 mt-6 text-sm">
                <span className="text-stone-700">
                  <span className="font-medium text-stone-900 tabular-nums">{totalEnabled}</span>{" "}
                  active
                </span>
                <span className="text-stone-300">·</span>
                <span className="text-stone-500 tabular-nums">
                  {totalConfigured} available
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Engagement */}
        <div className="mb-14">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-luxury mb-6">
            Customer Engagement
          </h2>
          <div className="space-y-4">
            {customerAutomations.map((type) => renderAutomationCard(type))}
          </div>
        </div>

        {/* Operational */}
        <div className="mb-14">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-luxury mb-6">
            Operational Reminders
          </h2>
          <div className="space-y-4">
            {operationalAutomations.map((type) => renderAutomationCard(type))}
          </div>
        </div>

        {/* Holiday */}
        <div className="mb-14">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-luxury mb-6">
            Holiday Campaigns
          </h2>
          <div className="space-y-4">
            {holidayAutomations.map((type) => renderAutomationCard(type))}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-white border border-stone-200 rounded-2xl p-7 sm:p-8">
          <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
            Notes from the field
          </p>
          <h3 className="font-serif text-xl sm:text-2xl text-stone-900 tracking-tight leading-tight mb-5">
            What we've learned about automation
          </h3>
          <ul className="text-sm text-stone-600 space-y-3 leading-relaxed max-w-2xl">
            <li className="flex gap-3">
              <span className="text-nexpura-bronze mt-1.5 shrink-0 h-px w-3 bg-current" aria-hidden="true" />
              <span>Birthday emails see roughly 3x the engagement of regular sends.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-nexpura-bronze mt-1.5 shrink-0 h-px w-3 bg-current" aria-hidden="true" />
              <span>Repair-ready reminders cut uncollected pieces by around 60%.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-nexpura-bronze mt-1.5 shrink-0 h-px w-3 bg-current" aria-hidden="true" />
              <span>Re-engagement notes recover roughly one in ten lapsed customers.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-nexpura-bronze mt-1.5 shrink-0 h-px w-3 bg-current" aria-hidden="true" />
              <span>Appointment reminders meaningfully reduce no-shows.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
