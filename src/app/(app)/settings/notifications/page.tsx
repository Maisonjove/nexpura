import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import NotificationsClient from "./NotificationsClient";

export const metadata = { title: "Notification Settings — Nexpura" };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/login");

  const admin = createAdminClient();

  // Get tenant notification settings and name
  const { data: tenant } = await admin
    .from("tenants")
    .select("notification_settings, sms_templates, name, business_name")
    .eq("id", ctx.tenantId)
    .single();

  // Get WhatsApp integration status
  const { data: whatsappIntegration } = await admin
    .from("tenant_integrations")
    .select("settings, enabled")
    .eq("tenant_id", ctx.tenantId)
    .eq("integration_type", "whatsapp")
    .single();

  // Get Twilio integration status
  const { data: twilioIntegration } = await admin
    .from("tenant_integrations")
    .select("settings, enabled")
    .eq("tenant_id", ctx.tenantId)
    .eq("integration_type", "twilio")
    .single();

  const defaultSettings = {
    whatsapp_employee_notifications: false,
    notify_on_task_assignment: true,
    notify_on_status_change: true,
    notify_on_urgent_flagged: true,
    sms_job_ready_enabled: true,
    sms_appointment_reminder_enabled: true,
  };

  const defaultSmsTemplates = {
    job_ready: "Hi {{customer_name}}, great news! Your {{job_type}} is ready for pickup at {{business_name}}. See you soon!",
    appointment_reminder: "Hi {{customer_name}}, reminder: You have an appointment at {{business_name}} tomorrow at {{time}}.",
    custom_1: "",
    custom_2: "",
  };
  
  const settings = {
    ...defaultSettings,
    ...(tenant?.notification_settings as Record<string, boolean> || {}),
  };

  const smsTemplates = {
    ...defaultSmsTemplates,
    ...(tenant?.sms_templates as Record<string, string> || {}),
  };

  const twilioSettings = twilioIntegration?.settings as {
    account_sid?: string;
    phone_number?: string;
  } | null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <a href="/settings" className="text-sm text-amber-600 hover:underline mb-2 inline-block">
          ← Back to Settings
        </a>
        <h1 className="text-2xl font-semibold text-stone-900">Notification Settings</h1>
        <p className="text-sm text-stone-500 mt-1">
          Configure how your team receives notifications about repairs, tasks, and updates.
        </p>
      </div>
      
      <NotificationsClient 
        settings={settings}
        smsTemplates={smsTemplates}
        whatsappConnected={!!whatsappIntegration?.enabled}
        twilioConnected={!!twilioIntegration?.enabled}
        twilioPhoneNumber={twilioSettings?.phone_number || null}
        businessName={tenant?.business_name || tenant?.name || ""}
      />
    </div>
  );
}
