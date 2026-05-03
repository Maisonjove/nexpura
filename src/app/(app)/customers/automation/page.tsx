import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import AutomationClient, { type AutomationRow } from "./AutomationClient";
import Link from "next/link";

export const metadata = { title: "Customer Automation — Nexpura" };

export default async function AutomationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  const tenantId = userData?.tenant_id;
  if (!tenantId) redirect("/onboarding");

  const { data: automationsRaw } = await admin
    .from("marketing_automations")
    .select("id, automation_type, enabled, settings")
    .eq("tenant_id", tenantId)
    .order("automation_type");

  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = today.getMonth() + 1;

  const [vipCount, inactiveCount, birthdayRows, newCount] = await Promise.all([
    admin.from("customers").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).is("deleted_at", null).eq("is_vip", true),
    admin.from("customers").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).is("deleted_at", null).lt("updated_at", ninetyDaysAgo),
    admin.from("customers").select("id, birthday")
      .eq("tenant_id", tenantId).is("deleted_at", null).not("birthday", "is", null),
    admin.from("customers").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).is("deleted_at", null).gte("created_at", thirtyDaysAgo),
  ]);
  const birthdayMonthCount = (birthdayRows.data ?? []).filter((c) => {
    const m = (c.birthday as string | null)?.slice(5, 7);
    return m && parseInt(m, 10) === monthStart;
  }).length;

  const segmentCounts = {
    vip: vipCount.count ?? 0,
    inactive: inactiveCount.count ?? 0,
    birthday: birthdayMonthCount,
    new: newCount.count ?? 0,
  };

  const automations: AutomationRow[] = (automationsRaw ?? []).map((a) => ({
    id: a.id as string,
    automationType: a.automation_type as string,
    enabled: !!a.enabled,
    settings: (a.settings as Record<string, unknown>) ?? {},
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-stone-400">
        <Link href="/customers" className="hover:text-amber-700">Customers</Link>
        <span>/</span>
        <span className="text-stone-600">Automation</span>
      </div>
      <AutomationClient automations={automations} segmentCounts={segmentCounts} />
    </div>
  );
}
