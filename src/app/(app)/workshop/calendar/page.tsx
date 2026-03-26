import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import WorkshopCalendarClient from "./WorkshopCalendarClient";
import { getIntegration } from "@/lib/integrations";

export const metadata = { title: "Workshop Calendar — Nexpura" };

export default async function WorkshopCalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");

  const admin = createAdminClient();
  const tenantId = userData.tenant_id;

  // Fetch repairs, bespoke jobs, and Google Calendar status
  const [repairsResult, bespokeResult, { data: staff }, gcalIntegration] = await Promise.all([
    admin.from("repairs").select("id, ticket_number, description, status, due_date, assigned_to, customers(full_name)").eq("tenant_id", tenantId).not("due_date", "is", null),
    admin.from("bespoke_jobs").select("id, job_number, title, status, due_date, assigned_to, customers(full_name)").eq("tenant_id", tenantId).not("due_date", "is", null),
    admin.from("users").select("id, full_name").eq("tenant_id", tenantId),
    getIntegration(tenantId, "google_calendar"),
  ]);
  
  const repairs = (repairsResult.data ?? []).map(r => ({
    ...r,
    customers: Array.isArray(r.customers) ? r.customers[0] ?? null : r.customers
  }));
  const bespoke = (bespokeResult.data ?? []).map(b => ({
    ...b,
    customers: Array.isArray(b.customers) ? b.customers[0] ?? null : b.customers
  }));

  return (
    <WorkshopCalendarClient
      repairs={repairs as any}
      bespoke={bespoke as any}
      staff={staff ?? []}
      tenantId={tenantId}
      googleCalendarConnected={gcalIntegration?.status === "connected"}
    />
  );
}
