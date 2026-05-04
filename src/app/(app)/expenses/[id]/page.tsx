import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { signStoragePath } from "@/lib/supabase/signed-urls";
import ExpenseDetailClient from "./ExpenseDetailClient";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id;

  const { data: expense } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId ?? "")
    .single();

  if (!expense) notFound();

  const { data: auditLogs } = await admin
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, old_data, new_data, created_at, user_id")
    .eq("tenant_id", tenantId ?? "")
    .eq("entity_type", "expense")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  let userMap: Record<string, { full_name: string | null; email: string | null }> = {};
  const userIds = Array.from(
    new Set(
      (auditLogs ?? [])
        .map((l) => l.user_id)
        .filter((u): u is string => !!u),
    ),
  );
  if (userIds.length > 0) {
    const { data: users } = await admin
      .from("users")
      .select("id, full_name, email")
      .in("id", userIds);
    userMap = Object.fromEntries(
      (users ?? []).map((u) => [u.id, { full_name: u.full_name, email: u.email }]),
    );
  }

  // cleanup #18 — `inventory-photos` bucket is private. `receipt_url` is
  // now a storage path; resolve to a 7-day signed URL here so the client
  // can render the "View receipt" link without re-signing.
  const receiptDisplayUrl = await signStoragePath(admin, "inventory-photos", expense.receipt_url);

  return (
    <ExpenseDetailClient
      expense={expense}
      receiptDisplayUrl={receiptDisplayUrl}
      auditLogs={auditLogs ?? []}
      userMap={userMap}
    />
  );
}
