"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  MessageSquare, 
  Bell, 
  CheckCircle2, 
  Loader2,
  Users,
  Smartphone,
  Info,
} from "lucide-react";

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

  return (
    <div className="space-y-6">
      {/* WhatsApp Notifications - Powered by Nexpura */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-stone-900">WhatsApp Notifications</h3>
              <p className="text-sm text-stone-500">
                Automatic notifications to customers and staff
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Powered by Nexpura
            </span>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Info Box */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-800">
                WhatsApp notifications are <strong>included free</strong> with your Nexpura subscription. 
                No setup required — just toggle the features you want.
              </p>
            </div>
          </div>

          {/* Customer Notifications Section */}
          <div>
            <h4 className="font-medium text-stone-900 mb-3 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-stone-500" />
              Customer Notifications
            </h4>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 bg-stone-50 rounded-lg cursor-pointer hover:bg-stone-100 transition-colors">
                <div>
                  <span className="text-sm font-medium text-stone-900">Job Ready Notifications</span>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Automatically notify customers when their repair/job is ready for pickup
                  </p>
                </div>
                <button
                  onClick={() => handleToggle("whatsapp_job_ready_enabled")}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings.whatsapp_job_ready_enabled ? "bg-green-500" : "bg-stone-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings.whatsapp_job_ready_enabled ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>

          {/* Employee Notifications Section */}
          <div>
            <h4 className="font-medium text-stone-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-stone-500" />
              Employee Notifications
            </h4>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 bg-stone-50 rounded-lg cursor-pointer hover:bg-stone-100 transition-colors">
                <div>
                  <span className="text-sm font-medium text-stone-900">Task Assignments</span>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Notify staff when a repair or task is assigned to them
                  </p>
                </div>
                <button
                  onClick={() => handleToggle("whatsapp_task_assignment_enabled")}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings.whatsapp_task_assignment_enabled ? "bg-green-500" : "bg-stone-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings.whatsapp_task_assignment_enabled ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </label>

              {settings.whatsapp_task_assignment_enabled && (
                <div className="ml-4 pl-4 border-l-2 border-stone-200 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notify_on_status_change}
                      onChange={() => handleToggle("notify_on_status_change")}
                      className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-nexpura-bronze"
                    />
                    <div>
                      <span className="text-sm font-medium text-stone-700">Status Changes</span>
                      <p className="text-xs text-stone-500">When their assigned item's status changes</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notify_on_urgent_flagged}
                      onChange={() => handleToggle("notify_on_urgent_flagged")}
                      className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-nexpura-bronze"
                    />
                    <div>
                      <span className="text-sm font-medium text-stone-700">Urgent Items</span>
                      <p className="text-xs text-stone-500">When an item they're assigned to is flagged urgent</p>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Marketing Note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
        <Bell className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-amber-900">Marketing Campaigns</h4>
          <p className="text-sm text-amber-800 mt-1">
            Want to send promotional messages to your customers? 
            <a href="/marketing/whatsapp-campaigns" className="text-amber-700 hover:underline font-medium ml-1">
              Create a WhatsApp Campaign →
            </a>
          </p>
          <p className="text-xs text-amber-700 mt-2">
            Marketing messages are billed at $0.16 per message
          </p>
        </div>
      </div>

      {/* Employee Phone Numbers Note */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 flex items-start gap-3">
        <Users className="w-5 h-5 text-stone-500 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-stone-900">Team Phone Numbers</h4>
          <p className="text-sm text-stone-600 mt-1">
            To receive WhatsApp notifications, team members need a phone number on their profile. 
            Go to <a href="/settings/roles" className="text-amber-600 hover:underline">Team & Roles</a> to add phone numbers.
          </p>
        </div>
      </div>

      {/* Status */}
      {(saving || saved || error) && (
        <div className="flex items-center gap-2 text-sm">
          {saving && (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
              <span className="text-stone-500">Saving...</span>
            </>
          )}
          {saved && (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-green-600">Saved</span>
            </>
          )}
          {error && (
            <span className="text-red-600">{error}</span>
          )}
        </div>
      )}
    </div>
  );
}
