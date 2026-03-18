import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import GoogleCalendarClient from "./GoogleCalendarClient";
import { getIntegration } from "@/lib/integrations";

export const metadata = { title: "Google Calendar Integration — Nexpura" };

export default async function GoogleCalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/login");

  // Get integration status
  const integration = await getIntegration(ctx.tenantId, "google_calendar");
  
  const config = integration?.config as {
    calendar_email?: string;
    calendar_id?: string;
  } | null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <a href="/integrations" className="text-sm text-amber-600 hover:underline mb-2 inline-block">
          ← Back to Integrations
        </a>
        <h1 className="text-2xl font-semibold text-stone-900">Google Calendar</h1>
        <p className="text-sm text-stone-500 mt-1">
          Sync your appointments and repair due dates to Google Calendar.
        </p>
      </div>
      
      <GoogleCalendarClient 
        isConnected={integration?.status === "connected"}
        calendarEmail={config?.calendar_email}
        calendarId={config?.calendar_id}
        lastSyncAt={integration?.last_sync_at}
      />
    </div>
  );
}
