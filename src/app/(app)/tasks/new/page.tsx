import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import { getCached, tenantCacheKey } from "@/lib/cache";
import NewTaskClient from "./NewTaskClient";

export const metadata = { title: "New Task — Nexpura" };

export default async function NewTaskPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const { tenantId } = auth;
  const admin = createAdminClient();

  // Fetch team members (cached for 5 min)
  const teamMembers = await getCached(
    tenantCacheKey(tenantId, "team-members"),
    async () => {
      const { data } = await admin
        .from("users")
        .select("id, full_name, email")
        .eq("tenant_id", tenantId);
      return data ?? [];
    },
    300
  );

  return <NewTaskClient teamMembers={teamMembers} />;
}
