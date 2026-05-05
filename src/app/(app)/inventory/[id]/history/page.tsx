import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AuditDiffView from "@/components/AuditDiffView";

/**
 * Per-entity audit history for inventory items. Mirrors
 * /customers/[id]/history.
 */

export const metadata = { title: "Inventory item history — Nexpura" };

interface AuditLogRow {
  id: string;
  action: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  users: { full_name: string | null; email: string | null } | null;
}

export default async function InventoryHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) redirect("/onboarding");

  const { data: item } = await admin
    .from("inventory")
    .select("id, name, sku")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!item) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-stone-900">Item not found</h1>
        <p className="text-sm text-stone-500 mt-2">
          This item doesn&apos;t exist or you don&apos;t have permission to view it.
        </p>
        <Link href="/inventory" className="text-sm text-stone-700 underline mt-4 inline-block">
          ← Back to inventory
        </Link>
      </div>
    );
  }

  const { data: logs } = await admin
    .from("audit_logs")
    .select("id, action, entity_id, old_data, new_data, created_at, metadata, users(full_name, email)")
    .eq("tenant_id", userData.tenant_id)
    .eq("entity_type", "inventory")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  const safeLogs = (logs as unknown as AuditLogRow[] | null) ?? [];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <Link
          href={`/inventory/${id}`}
          className="text-xs text-stone-500 hover:text-stone-900 inline-flex items-center gap-1"
        >
          ← Back to {item.name ?? item.sku ?? "item"}
        </Link>
        <h1 className="text-2xl font-semibold text-stone-900 mt-2">Edit history</h1>
        <p className="text-stone-500 text-sm mt-1">
          Every recorded change on this inventory item. Most recent first.
        </p>
      </div>

      {safeLogs.length === 0 ? (
        <div className="border border-stone-200 rounded-2xl p-10 text-center text-stone-500">
          No edits recorded for this item yet.
        </div>
      ) : (
        <ol className="space-y-3">
          {safeLogs.map((log) => {
            const userName = log.users?.full_name || log.users?.email || "System";
            return (
              <li key={log.id} className="bg-white border border-stone-200 rounded-2xl p-5">
                <header className="flex items-baseline justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-stone-500">
                      {log.action.replace(/_/g, " ")}
                    </p>
                    <p className="text-sm text-stone-700 mt-0.5">
                      by <span className="font-medium">{userName}</span>
                    </p>
                  </div>
                  <time className="text-xs text-stone-400 font-mono tabular-nums shrink-0">
                    {new Date(log.created_at).toLocaleString("en-AU", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </header>
                <AuditDiffView
                  oldData={log.old_data}
                  newData={log.new_data}
                  compact={false}
                />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
