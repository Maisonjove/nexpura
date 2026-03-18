"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  MessageSquare, 
  Bell, 
  CheckCircle2, 
  XCircle,
  Loader2,
  AlertTriangle,
  Smartphone,
  Users,
  Zap,
  Phone,
  Settings,
  Trash2,
  HelpCircle,
  Info,
} from "lucide-react";
import TwilioSetupWizard from "./TwilioSetupWizard";
import { disconnectTwilio, saveSmsTemplates } from "./actions";

interface NotificationsClientProps {
  settings: {
    whatsapp_employee_notifications: boolean;
    notify_on_task_assignment: boolean;
    notify_on_status_change: boolean;
    notify_on_urgent_flagged: boolean;
    sms_job_ready_enabled: boolean;
    sms_appointment_reminder_enabled: boolean;
  };
  smsTemplates: {
    job_ready: string;
    appointment_reminder: string;
    custom_1: string;
    custom_2: string;
  };
  whatsappConnected: boolean;
  twilioConnected: boolean;
  twilioPhoneNumber: string | null;
  businessName: string;
}

const SMS_VARIABLES = [
  { key: "customer_name", desc: "Customer's full name" },
  { key: "job_type", desc: "Type of repair/job (e.g., Ring Sizing)" },
  { key: "business_name", desc: "Your business name" },
  { key: "date", desc: "Date of appointment/pickup" },
  { key: "time", desc: "Time of appointment" },
];

export default function NotificationsClient({
  settings: initialSettings,
  smsTemplates: initialSmsTemplates,
  whatsappConnected,
  twilioConnected: initialTwilioConnected,
  twilioPhoneNumber: initialTwilioPhoneNumber,
  businessName,
}: NotificationsClientProps) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [smsTemplates, setSmsTemplates] = useState(initialSmsTemplates);
  const [twilioConnected, setTwilioConnected] = useState(initialTwilioConnected);
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState(initialTwilioPhoneNumber);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWhatsAppSetup, setShowWhatsAppSetup] = useState(false);
  const [showTwilioSetup, setShowTwilioSetup] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [templatesSaved, setTemplatesSaved] = useState(false);
  const [whatsAppCredentials, setWhatsAppCredentials] = useState({
    phone_number_id: "",
    access_token: "",
    business_account_id: "",
  });
  const [connectingWhatsApp, setConnectingWhatsApp] = useState(false);

  const handleToggle = async (key: keyof typeof settings) => {
    // If trying to enable WhatsApp notifications but not connected, show setup
    if (key === "whatsapp_employee_notifications" && !settings[key] && !whatsappConnected) {
      setShowWhatsAppSetup(true);
      return;
    }

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

  const handleConnectWhatsApp = async () => {
    if (!whatsAppCredentials.phone_number_id || !whatsAppCredentials.access_token) {
      setError("Please enter Phone Number ID and Access Token");
      return;
    }

    setConnectingWhatsApp(true);
    setError(null);

    try {
      const res = await fetch("/api/integrations/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(whatsAppCredentials),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to connect");
      }

      setShowWhatsAppSetup(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnectingWhatsApp(false);
    }
  };

  const handleDisconnectTwilio = async () => {
    if (!confirm("Disconnect Twilio? You'll need to set it up again to send SMS messages.")) {
      return;
    }

    setDisconnecting(true);
    const result = await disconnectTwilio();
    
    if (result.error) {
      setError(result.error);
    } else {
      setTwilioConnected(false);
      setTwilioPhoneNumber(null);
      router.refresh();
    }
    
    setDisconnecting(false);
  };

  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    setTemplatesSaved(false);

    const result = await saveSmsTemplates(smsTemplates);
    
    if (result.error) {
      setError(result.error);
    } else {
      setTemplatesSaved(true);
      setTimeout(() => setTemplatesSaved(false), 2000);
    }
    
    setSavingTemplates(false);
  };

  const handleTwilioSetupComplete = () => {
    setShowTwilioSetup(false);
    setTwilioConnected(true);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* SMS Notifications (Twilio) */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-stone-900">SMS Notifications</h3>
              <p className="text-sm text-stone-500">Send SMS to customers via Twilio</p>
            </div>
            {twilioConnected ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-stone-500 bg-stone-100 px-2 py-1 rounded-full">
                <XCircle className="w-3 h-3" />
                Not connected
              </span>
            )}
          </div>
        </div>

        {twilioConnected ? (
          <div className="p-5 space-y-6">
            {/* Connected Status */}
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">Twilio Connected</p>
                  <p className="text-xs text-green-700">
                    Sending from: <span className="font-mono">{twilioPhoneNumber || "Unknown"}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleDisconnectTwilio}
                disabled={disconnecting}
                className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                {disconnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Disconnect
              </button>
            </div>

            {/* SMS Templates */}
            <div>
              <h4 className="font-medium text-stone-900 mb-3">SMS Templates</h4>
              <p className="text-sm text-stone-500 mb-4">
                Customize the messages sent to your customers. These templates will be used when 
                you notify customers about job status changes.
              </p>

              {/* Available Variables */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-2">Available Variables</p>
                    <div className="flex flex-wrap gap-2">
                      {SMS_VARIABLES.map((v) => (
                        <span
                          key={v.key}
                          className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono"
                          title={v.desc}
                        >
                          {`{{${v.key}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Job Ready Template */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Job Ready Notification
                  </label>
                  <textarea
                    value={smsTemplates.job_ready}
                    onChange={(e) => setSmsTemplates({ ...smsTemplates, job_ready: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                    placeholder="Hi {{customer_name}}, your {{job_type}} is ready..."
                  />
                  <p className="text-xs text-stone-400 mt-1">
                    {smsTemplates.job_ready.length}/160 characters
                    {smsTemplates.job_ready.length > 160 && (
                      <span className="text-amber-600 ml-2">
                        (Will be sent as {Math.ceil(smsTemplates.job_ready.length / 153)} messages)
                      </span>
                    )}
                  </p>
                </div>

                {/* Appointment Reminder Template */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Appointment Reminder
                  </label>
                  <textarea
                    value={smsTemplates.appointment_reminder}
                    onChange={(e) => setSmsTemplates({ ...smsTemplates, appointment_reminder: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                    placeholder="Hi {{customer_name}}, reminder: You have an appointment..."
                  />
                  <p className="text-xs text-stone-400 mt-1">
                    {smsTemplates.appointment_reminder.length}/160 characters
                  </p>
                </div>

                {/* Custom Template 1 */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Custom Template 1 <span className="text-stone-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={smsTemplates.custom_1}
                    onChange={(e) => setSmsTemplates({ ...smsTemplates, custom_1: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                    placeholder="Create your own template..."
                  />
                </div>

                {/* Custom Template 2 */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Custom Template 2 <span className="text-stone-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={smsTemplates.custom_2}
                    onChange={(e) => setSmsTemplates({ ...smsTemplates, custom_2: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                    placeholder="Create your own template..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4">
                {templatesSaved && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Saved
                  </span>
                )}
                <button
                  onClick={handleSaveTemplates}
                  disabled={savingTemplates}
                  className="px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {savingTemplates ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Templates"
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5">
            {showTwilioSetup ? (
              <TwilioSetupWizard onComplete={handleTwilioSetupComplete} />
            ) : (
              <div className="text-center py-6">
                <Phone className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                <h4 className="font-medium text-stone-900 mb-2">
                  Connect Twilio to Send SMS
                </h4>
                <p className="text-sm text-stone-500 mb-6 max-w-md mx-auto">
                  Send automated SMS notifications when jobs are ready, appointment reminders, 
                  and marketing messages. You pay Twilio directly — typically ~$1/month for a 
                  number and $0.01-0.05 per SMS.
                </p>
                <button
                  onClick={() => setShowTwilioSetup(true)}
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Set Up Twilio
                </button>
                <p className="text-xs text-stone-400 mt-3">
                  Takes about 5 minutes
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* WhatsApp Employee Notifications */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-900">WhatsApp Notifications</h3>
              <p className="text-sm text-stone-500">Notify employees via WhatsApp</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {whatsappConnected ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-stone-500 bg-stone-100 px-2 py-1 rounded-full">
                  <XCircle className="w-3 h-3" />
                  Not connected
                </span>
              )}
              <button
                onClick={() => handleToggle("whatsapp_employee_notifications")}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.whatsapp_employee_notifications && whatsappConnected
                    ? "bg-green-500"
                    : "bg-stone-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.whatsapp_employee_notifications && whatsappConnected
                      ? "translate-x-5"
                      : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Sub-settings - only show if WhatsApp is enabled */}
        {settings.whatsapp_employee_notifications && whatsappConnected && (
          <div className="p-5 bg-stone-50 space-y-4">
            <p className="text-sm font-medium text-stone-700 mb-3">When to notify:</p>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_on_task_assignment}
                onChange={() => handleToggle("notify_on_task_assignment")}
                className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-stone-900">Task Assignment</span>
                <p className="text-xs text-stone-500">When a repair or task is assigned to them</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_on_status_change}
                onChange={() => handleToggle("notify_on_status_change")}
                className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-stone-900">Status Changes</span>
                <p className="text-xs text-stone-500">When their assigned item's status changes</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_on_urgent_flagged}
                onChange={() => handleToggle("notify_on_urgent_flagged")}
                className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-stone-900">Urgent Items</span>
                <p className="text-xs text-stone-500">When an item they're assigned to is flagged urgent</p>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* WhatsApp Setup Modal */}
      {showWhatsAppSetup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl">
            <div className="p-6 border-b border-stone-100">
              <h3 className="text-lg font-semibold text-stone-900">Connect WhatsApp Business</h3>
              <p className="text-sm text-stone-500 mt-1">
                Enter your Meta WhatsApp Business API credentials
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Phone Number ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={whatsAppCredentials.phone_number_id}
                  onChange={(e) => setWhatsAppCredentials(prev => ({
                    ...prev,
                    phone_number_id: e.target.value
                  }))}
                  placeholder="e.g., 123456789012345"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <p className="text-xs text-stone-400 mt-1">
                  Found in Meta Business Suite → WhatsApp → API Setup
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Permanent Access Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={whatsAppCredentials.access_token}
                  onChange={(e) => setWhatsAppCredentials(prev => ({
                    ...prev,
                    access_token: e.target.value
                  }))}
                  placeholder="EAAxxxxxxxx..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <p className="text-xs text-stone-400 mt-1">
                  Generate in Meta for Developers → System Users
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Business Account ID (optional)
                </label>
                <input
                  type="text"
                  value={whatsAppCredentials.business_account_id}
                  onChange={(e) => setWhatsAppCredentials(prev => ({
                    ...prev,
                    business_account_id: e.target.value
                  }))}
                  placeholder="e.g., 123456789012345"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-medium text-amber-900 text-sm mb-2">How to get these credentials:</h4>
                <ol className="text-xs text-amber-800 space-y-1 list-decimal list-inside">
                  <li>Go to <a href="https://business.facebook.com" target="_blank" rel="noreferrer" className="underline">Meta Business Suite</a></li>
                  <li>Navigate to WhatsApp → API Setup</li>
                  <li>Copy your Phone Number ID</li>
                  <li>Create a System User and generate a permanent access token</li>
                </ol>
              </div>
            </div>

            <div className="p-6 border-t border-stone-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowWhatsAppSetup(false);
                  setError(null);
                }}
                className="px-4 py-2 text-stone-700 font-medium hover:bg-stone-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConnectWhatsApp}
                disabled={connectingWhatsApp}
                className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {connectingWhatsApp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    Connect WhatsApp
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Need Help */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-amber-900">Need Help Setting Up?</h4>
          <p className="text-sm text-amber-800 mt-1">
            Our support team can help you configure Twilio or WhatsApp. 
            <a href="/support" className="text-amber-700 hover:underline font-medium ml-1">Contact Support</a>
          </p>
        </div>
      </div>

      {/* Status */}
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
      </div>
    </div>
  );
}
