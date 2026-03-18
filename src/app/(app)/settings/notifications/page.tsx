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
    .select("notification_settings, name, business_name")
    .eq("id", ctx.tenantId)
    .single();

  const defaultSettings = {
    whatsapp_job_ready_enabled: true,
    whatsapp_task_assignment_enabled: false,
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
          Configure WhatsApp notifications for customers and staff
        </p>
      </div>
      
      <NotificationsClient 
        settings={settings}
        businessName={tenant?.business_name || tenant?.name || ""}
      />
    </div>
  );
}
