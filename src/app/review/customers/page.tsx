import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";


export default async function ReviewCustomersPage() {
  const admin = createAdminClient();

  const { data: rawCustomers } = await admin
    .from("customers")
    .select("id, full_name, email, phone, mobile, tags, created_at")
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  // Deduplicate by email — keep first occurrence
  const seen = new Set<string>();
  const customers = (rawCustomers || []).filter((c) => {
    const key = c.email || c.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Customers</h1>
        <p className="text-sm text-stone-400 mt-0.5">{customers.length} customer{customers.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Tags</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-stone-400">No customers found</td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-b border-stone-100 hover:bg-stone-50/60 transition-colors">
                  <td className="px-4 py-3 text-sm text-stone-700">
                    <Link href={`/review/customers/${c.id}`} className="font-medium text-stone-900 hover:text-amber-700 transition-colors">
                      {c.full_name || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-sm text-stone-700">{c.phone || c.mobile || "—"}</td>
                  <td className="px-4 py-3 text-sm text-stone-700">
                    {Array.isArray(c.tags) && c.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {(c.tags as string[]).map((tag) => (
                          <span key={tag} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString("en-GB") : "—"}
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
