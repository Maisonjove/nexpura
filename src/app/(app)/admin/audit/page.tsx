import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { format } from "date-fns";
import { Search, Filter } from "lucide-react";

export default async function AuditLogsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*, users(full_name, email)")
    .eq("tenant_id", userData?.tenant_id ?? "")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
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
              {(!logs || logs.length === 0) ? (
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
    </div>
  );
}
