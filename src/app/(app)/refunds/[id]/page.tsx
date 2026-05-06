import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RefundDetailClient from "./RefundDetailClient";

export const metadata = { title: "Refund — Nexpura" };

export default async function RefundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) redirect("/onboarding");

  const admin = createAdminClient();

  const { data: refund } = await admin
    .from("refunds")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!refund) redirect("/refunds");

  const { data: items } = await admin
    .from("refund_items")
    .select("*")
    .eq("refund_id", id);

  // Audit trail — pull recent log entries for this refund + the original sale
  // (so a void shows alongside the create event). Cluster-PR item 4
  // adds old_data so the per-row diff view (AuditDiffView) can render
  // the full field-by-field change set on expand. The previous select
  // omitted old_data entirely, so even if a click handler was wired, the
  // diff view had nothing to render against → rows looked dead.
  const { data: auditLogs } = await admin
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, old_data, new_data, created_at, user_id")
    .eq("tenant_id", userData.tenant_id)
    .or(`entity_id.eq.${id},and(entity_type.eq.refund,entity_id.eq.${id})`)
    .order("created_at", { ascending: false })
    .limit(20);

  return <RefundDetailClient refund={refund} items={items ?? []} auditLogs={auditLogs ?? []} />;
}
