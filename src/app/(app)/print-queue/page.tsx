import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PrintQueueClient from "./PrintQueueClient";

export const metadata = { title: "Print Queue — Nexpura" };

export default async function PrintQueuePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");
  const tenantId = userData.tenant_id;

  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("print_jobs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <PrintQueueClient
      jobs={jobs ?? []}
      tenantId={tenantId}
    />
  );
}
