import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ImportHubClient from "./ImportHubClient";

export default async function ImportPage() {
  let counts: Record<string, number> = {};

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: userData } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (userData?.tenant_id) {
        const tenantId = userData.tenant_id;
        const admin = createAdminClient();

        const [
          { count: customers },
          { count: invoices },
          { count: repairs },
          { count: bespoke_jobs },
          { count: sales },
          { count: inventory },
          { count: expenses },
          { count: suppliers },
        ] = await Promise.all([
          admin.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).is("deleted_at", null),
          admin.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
          admin.from("repairs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
          admin.from("bespoke_jobs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
          admin.from("sales").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
          admin.from("inventory").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
          admin.from("expenses").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
          admin.from("suppliers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        ]);

        counts = {
          customers: customers ?? 0,
          invoices: invoices ?? 0,
          repairs: repairs ?? 0,
          bespoke_jobs: bespoke_jobs ?? 0,
          sales: sales ?? 0,
          inventory: inventory ?? 0,
          expenses: expenses ?? 0,
          suppliers: suppliers ?? 0,
        };
      }
    }
  } catch {
    // Silently fail — counts will just show as 0
  }

  return <ImportHubClient counts={counts} />;
}
