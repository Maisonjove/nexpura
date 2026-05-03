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

  // W14-LINK-PICKER (Group 14 audit): pre-fetch candidate entities for
  // the linked-entity picker on the form. Pre-fix the form had a free
  // "Paste ID here" text input — staff had to copy a UUID from another
  // page and paste, with no validation that the ID exists. Now we
  // pre-load a small list per type so the form renders a real
  // searchable dropdown.
  const [recentRepairs, recentBespoke, recentInventory, recentSuppliers] = await Promise.all([
    admin
      .from("repairs")
      .select("id, repair_number, item_description, customer_name")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("stage", "in", '("collected","cancelled")')
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("bespoke_jobs")
      .select("id, job_number, title, customer_name")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("stage", "in", '("completed","cancelled")')
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("inventory")
      .select("id, name, sku")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("suppliers")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("name")
      .limit(100),
  ]);

  const linkCandidates = {
    repair: (recentRepairs.data ?? []).map((r) => ({
      id: r.id as string,
      label: `${r.repair_number ?? (r.id as string).slice(0, 8)} — ${r.item_description ?? "(no description)"}${r.customer_name ? ` · ${r.customer_name}` : ""}`,
    })),
    bespoke: (recentBespoke.data ?? []).map((b) => ({
      id: b.id as string,
      label: `${b.job_number ?? (b.id as string).slice(0, 8)} — ${b.title ?? "(no title)"}${b.customer_name ? ` · ${b.customer_name}` : ""}`,
    })),
    inventory: (recentInventory.data ?? []).map((i) => ({
      id: i.id as string,
      label: `${i.sku ? i.sku + " — " : ""}${i.name}`,
    })),
    supplier: (recentSuppliers.data ?? []).map((s) => ({
      id: s.id as string,
      label: s.name as string,
    })),
  };

  return <NewTaskClient teamMembers={teamMembers} linkCandidates={linkCandidates} />;
}
