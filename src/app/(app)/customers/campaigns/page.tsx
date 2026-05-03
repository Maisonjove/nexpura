import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Customer Campaigns — Nexpura" };

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default async function CampaignsPage() {
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

  const [segmentsRes, campaignsRes] = await Promise.all([
    admin
      .from("customer_segments")
      .select("id, name, description, rules, is_system, customer_count, updated_at")
      .eq("tenant_id", tenantId)
      .order("is_system", { ascending: false })
      .order("name", { ascending: true }),
    admin
      .from("email_campaigns")
      .select("id, name, subject, status, scheduled_at, sent_at, recipient_type, stats, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const segments = segmentsRes.data ?? [];
  const campaigns = campaignsRes.data ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-2 text-sm text-stone-400">
        <Link href="/customers" className="hover:text-amber-700">Customers</Link>
        <span>/</span>
        <span className="text-stone-600">Campaigns</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Campaigns &amp; Segments</h1>
        <p className="text-sm text-stone-500 mt-1">
          Targeted email and WhatsApp campaigns to customer segments. Dynamic segments auto-update based on rules.
        </p>
      </div>

      {/* SEGMENTS */}
      <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Customer Segments</h2>
            <p className="text-xs text-stone-500 mt-0.5">{segments.length} segment{segments.length === 1 ? "" : "s"} configured</p>
          </div>
        </div>
        {segments.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-stone-400">
            No segments yet. The default VIP / New / Lapsed / Repair / High Value segments are seeded per tenant.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {segments.map((s) => {
              const rules = (s.rules as Record<string, unknown> | null) ?? {};
              const ruleSummary = Object.entries(rules)
                .filter(([k]) => k !== "type")
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ");
              return (
                <div key={s.id} className="px-6 py-4 hover:bg-stone-50/60">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-stone-900">{s.name}</p>
                        {s.is_system && (
                          <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded">
                            System
                          </span>
                        )}
                      </div>
                      {s.description && <p className="text-xs text-stone-500">{s.description}</p>}
                      {ruleSummary && (
                        <p className="text-xs text-stone-400 mt-1 font-mono">Rule: {ruleSummary}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-semibold text-stone-900">{s.customer_count ?? 0}</p>
                      <p className="text-xs text-stone-400">customers</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CAMPAIGNS */}
      <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Recent Campaigns</h2>
            <p className="text-xs text-stone-500 mt-0.5">Email + WhatsApp campaigns sent in the last 30 days</p>
          </div>
          <Link
            href="/customers/automation"
            className="text-sm text-amber-700 hover:underline font-medium"
          >
            Lifecycle automations →
          </Link>
        </div>
        {campaigns.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-stone-400">
            No campaigns sent yet. Lifecycle automation triggers will appear here once they fire.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-left">Name</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-left">Subject</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-left">Status</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-left">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50/60">
                    <td className="px-6 py-3 font-medium text-stone-900">{c.name}</td>
                    <td className="px-6 py-3 text-stone-700">{c.subject ?? "—"}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        c.status === "sent" ? "bg-emerald-50 text-emerald-700" :
                        c.status === "scheduled" ? "bg-amber-50 text-amber-700" :
                        c.status === "draft" ? "bg-stone-100 text-stone-600" :
                        "bg-red-50 text-red-600"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-stone-600">{fmtDate(c.sent_at as string | null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
