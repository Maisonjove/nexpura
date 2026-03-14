import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import WorkshopCalendarClient from "./WorkshopCalendarClient";

export const metadata = { title: "Workshop Calendar — Nexpura" };

export default async function WorkshopCalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");

  const admin = createAdminClient();
  const tenantId = userData.tenant_id;

  // Fetch repairs and bespoke jobs
  const [{ data: repairs }, { data: bespoke }, { data: staff }] = await Promise.all([
    admin.from("repairs").select("id, ticket_number, description, status, due_date, assigned_to, customers(full_name)").eq("tenant_id", tenantId).not("due_date", "is", null),
    admin.from("bespoke_jobs").select("id, job_number, title, status, due_date, assigned_to, customers(full_name)").eq("tenant_id", tenantId).not("due_date", "is", null),
    admin.from("users").select("id, full_name").eq("tenant_id", tenantId),
  ]);

  return (
    <WorkshopCalendarClient
      repairs={repairs ?? []}
      bespoke={bespoke ?? []}
      staff={staff ?? []}
      tenantId={tenantId}
    />
  );
}
