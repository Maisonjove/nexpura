"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

interface NotificationsClientProps {
  settings: {
    whatsapp_job_ready_enabled: boolean;
    whatsapp_task_assignment_enabled: boolean;
    notify_on_task_assignment: boolean;
    notify_on_status_change: boolean;
    notify_on_urgent_flagged: boolean;
  };
  businessName: string;
}

type SettingKey = keyof NotificationsClientProps["settings"];

interface NotificationRow {
  key: SettingKey;
  title: string;
  description: string;
  channel: "WhatsApp" | "Email" | "SMS";
}

interface NotificationGroup {
  eyebrow: string;
  heading: string;
  rows: NotificationRow[];
}

const GROUPS: NotificationGroup[] = [
  {
    eyebrow: "Customer",
    heading: "Customer notifications",
    rows: [
      {
        key: "whatsapp_job_ready_enabled",
        title: "Job ready",
        description:
          "Let customers know the moment their repair, bespoke piece, or service is ready to collect.",
        channel: "WhatsApp",
      },
    ],
  },
  {
    eyebrow: "Team",
    heading: "Team notifications",
    rows: [
      {
        key: "whatsapp_task_assignment_enabled",
        title: "Task assignments",
        description:
          "Notify team members the moment a repair, task, or job is assigned to them.",
        channel: "WhatsApp",
      },
      {
        key: "notify_on_task_assignment",
        title: "New assignments",
        description:
          "A note in-app whenever a piece of work lands with a team member.",
        channel: "Email",
      },
      {
        key: "notify_on_status_change",
        title: "Status changes",
        description:
          "Tell the assignee when an item they are working on moves between statuses.",
        channel: "Email",
      },
      {
        key: "notify_on_urgent_flagged",
        title: "Urgent flags",
        description:
          "Surface anything marked urgent so the right person sees it without delay.",
        channel: "Email",
      },
    ],
  },
];

export default function NotificationsClient({
  settings: initialSettings,
  businessName,
}: NotificationsClientProps) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (key: keyof typeof settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const saveSettings = async (newSettings: typeof settings) => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_settings: newSettings }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSettings(initialSettings);
    } finally {
      setSaving(false);
    }
  };

  const totalEnabled = (Object.values(settings) as boolean[]).filter(Boolean).length;
  const totalAvailable = Object.keys(settings).length;

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -my-6 lg:-my-8">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="mb-14">
          <div className="flex items-start gap-4">
            <Link
              href="/settings"
              className="mt-2 text-stone-400 hover:text-nexpura-bronze transition-colors duration-300"
              aria-label="Back to settings"
            >
              <ArrowLeftIcon className="w-5 h-5" strokeWidth={1.5} />
            </Link>
            <div>
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                Settings
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-stone-900 leading-[1.08]">
                Notifications
              </h1>
              <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
                Quiet, well-timed notes — to customers and to the team
                {businessName ? ` at ${businessName}` : ""} — so the right
                person hears about the right moment.
              </p>
              <div className="flex items-center gap-4 mt-6 text-sm">
                <span className="text-stone-700">
                  <span className="font-medium text-stone-900 tabular-nums">{totalEnabled}</span>{" "}
                  active
                </span>
                <span className="text-stone-300">·</span>
                <span className="text-stone-500 tabular-nums">
                  {totalAvailable} available
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Helper note */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 mb-10 lg:mb-12">
          <div className="flex items-start gap-4">
            <InformationCircleIcon
              className="w-5 h-5 text-stone-400 shrink-0 mt-0.5"
              strokeWidth={1.5}
            />
            <div className="text-sm text-stone-600 leading-relaxed">
              <p>
                WhatsApp messages are included with your Nexpura subscription —
                no setup required. Toggle anything below and we save the
                change immediately.
              </p>
              <p className="mt-2 text-stone-500">
                Team members need a phone number on their profile to receive
                WhatsApp alerts. Add one in{" "}
                <Link
                  href="/settings/roles"
                  className="text-nexpura-bronze hover:underline"
                >
                  Team &amp; Roles
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Notification Groups */}
        <div className="space-y-12 lg:space-y-14">
          {GROUPS.map((group) => (
            <section key={group.eyebrow}>
              <div className="mb-6">
                <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                  {group.eyebrow}
                </p>
                <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                  {group.heading}
                </h2>
              </div>

              <div className="space-y-4">
                {group.rows.map((row) => {
                  const isOn = settings[row.key];
                  return (
                    <div
                      key={row.key}
                      className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 transition-all duration-300 hover:border-stone-300"
                    >
                      <div className="flex items-start gap-5 sm:gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-serif text-xl sm:text-[1.4rem] text-stone-900 leading-tight tracking-tight">
                              {row.title}
                            </h3>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6875rem] font-medium tracking-wide uppercase text-stone-500 border border-stone-200">
                              {row.channel}
                            </span>
                            {isOn ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6875rem] font-medium text-nexpura-bronze bg-nexpura-bronze/10">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6875rem] font-medium text-stone-500 bg-stone-100">
                                Off
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-stone-500 mt-2 leading-relaxed max-w-xl">
                            {row.description}
                          </p>
                        </div>

                        <div className="shrink-0 mt-1">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isOn}
                              onChange={() => handleToggle(row.key)}
                              disabled={saving}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-nexpura-bronze/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nexpura-bronze"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Footer actions */}
        <div className="mt-12 lg:mt-14 flex flex-wrap items-center gap-4">
          <Link
            href="/settings"
            className="nx-btn-primary inline-flex items-center gap-2"
          >
            Done
          </Link>

          <div className="flex items-center gap-2 text-sm" aria-live="polite">
            {saving && (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin text-stone-400" />
                <span className="text-stone-500">Saving…</span>
              </>
            )}
            {saved && !saving && (
              <>
                <CheckCircleIcon className="w-4 h-4 text-nexpura-bronze" />
                <span className="text-stone-600">Saved</span>
              </>
            )}
            {error && !saving && (
              <>
                <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                <span className="text-red-600">{error}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
