import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import NotificationsClient from "./NotificationsClient";
import { getIntegration } from "@/lib/integrations";

export const metadata = { title: "Notification Settings — Nexpura" };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/login");

  // Get tenant notification settings
  const { data: tenant } = await supabase
    .from("tenants")
    .select("notification_settings")
    .eq("id", ctx.tenantId)
    .single();

  // Get WhatsApp integration status
  const whatsappIntegration = await getIntegration(ctx.tenantId, "whatsapp");
  
  // Get Twilio integration status
  const twilioIntegration = await getIntegration(ctx.tenantId, "twilio");

  const defaultSettings = {
    whatsapp_employee_notifications: false,
    notify_on_task_assignment: true,
    notify_on_status_change: true,
    notify_on_urgent_flagged: true,
  };
  
  const settings = {
    ...defaultSettings,
    ...(tenant?.notification_settings as Record<string, boolean> || {}),
  };

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
        whatsappConnected={whatsappIntegration?.status === "connected"}
        twilioConnected={twilioIntegration?.status === "connected"}
      />
    </div>
  );
}
