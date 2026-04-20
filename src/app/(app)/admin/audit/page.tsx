import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Search, Filter } from "lucide-react";
import logger from "@/lib/logger";

/**
 * /admin/audit — CC-ready page-route.
 *
 * Tenant-scoped audit log. Top-level is synchronous and returns the
 * static header (title + search/filter chrome) immediately; the
 * dynamic body (cookies → session → tenant_id → audit_logs query)
 * streams inside a Suspense boundary.
 *
 * Split matches /settings/tags: `resolveTenantId()` is request-time
 * (reads cookies, never cacheable); `loadAuditLogs(tenantId)` is pure
 * w.r.t. its input and ready for `'use cache' + cacheTag(...)` once
 * cacheComponents is globally enabled.
 *
 * TODO(cacheComponents-flag): add to `loadAuditLogs`:
 *   'use cache';
 *   cacheLife('seconds');
 *   cacheTag(`audit-logs:${tenantId}`);
 * (Audit logs are effectively append-only; a short cache life is fine.)
 */

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: unknown;
  users: { full_name: string | null; email: string | null } | null;
}

export default function AuditLogsPage() {
  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
      {/* Shell — fully static. Search/filter inputs are cosmetic (no
          handlers yet) so they're safe in the prerendered shell. */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 font-serif">System Audit</h1>
          <p className="text-sm text-stone-500 mt-1">Full transparency of all security and data events</p>
        </div>
        <div className="flex gap-2">
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
             <input placeholder="Search logs..." className="pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-amber-600" />
           </div>
           <button className="flex items-center gap-2 px-4 py-2 border border-stone-200 bg-white rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50">
             <Filter size={16} /> Filter
           </button>
        </div>
      </div>

      <Suspense fallback={<AuditLogsSkeleton />}>
        <AuditLogsBody />
      </Suspense>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic body. Resolves the authenticated tenant_id (request-time) then
// fetches the tenant's audit_logs.
// ─────────────────────────────────────────────────────────────────────────
async function AuditLogsBody() {
  const tenantId = await resolveTenantId();
  const logs = tenantId ? await loadAuditLogs(tenantId) : [];

  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-100">
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-stone-400">Timestamp</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-stone-400">User</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-stone-400">Action</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-stone-400">Resource</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-stone-400">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {logs.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-stone-400 italic">No audit events recorded.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4 text-stone-500 whitespace-nowrap">
                    {format(new Date(log.created_at), "dd MMM yyyy, HH:mm:ss")}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-stone-900">{log.users?.full_name || "System"}</p>
                    <p className="text-stone-400">{log.users?.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-amber-700/10 text-amber-700 font-bold rounded uppercase tracking-tighter">
                      {log.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-stone-400 lowercase">
                    {log.entity_type} {log.entity_id?.slice(0, 8)}
                  </td>
                  <td className="px-6 py-4 text-stone-600 max-w-xs truncate">
                    {JSON.stringify(log.metadata)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Request-time: reads cookies via request-scoped Supabase client and
// resolves the authenticated user's tenant ID. NEVER cacheable.
// ─────────────────────────────────────────────────────────────────────────
async function resolveTenantId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = createAdminClient();
    const { data } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    return (data?.tenant_id as string | null) ?? null;
  } catch (error) {
    logger.error("[admin/audit] resolveTenantId failed", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Cacheable per tenant. Uses request-scoped client for RLS — audit_logs
// are owner-restricted so a non-owner fetching their own tenant's logs
// still gets denied by RLS at the DB layer.
// ─────────────────────────────────────────────────────────────────────────
async function loadAuditLogs(tenantId: string): Promise<AuditLog[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("audit_logs")
      .select("*, users(full_name, email)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as AuditLog[];
  } catch (error) {
    logger.error("[admin/audit] loadAuditLogs failed", error);
    return [];
  }
}

function AuditLogsSkeleton() {
  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
      <Skeleton className="h-12 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full border-t border-stone-100" />
      ))}
    </div>
  );
}
