import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Campaign — Nexpura" };

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmtPct(n: number, d: number) {
  if (d === 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

interface CampaignStats {
  sent?: number;
  delivered?: number;
  opened?: number;
  clicked?: number;
  bounced?: number;
  unsubscribed?: number;
  converted?: number;
  conversion_revenue?: number;
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: campaign } = await admin
    .from("email_campaigns")
    .select("id, name, subject, body, status, scheduled_at, sent_at, recipient_type, recipient_filter, stats, created_at, updated_at")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!campaign) notFound();

  // Pull individual email_logs rows linked to this campaign for the
  // breakdown tab. A campaign that's been sent will have one row per
  // recipient with status=sent|delivered|opened|bounced|complained.
  const { data: deliveries } = await admin
    .from("email_logs")
    .select("id, recipient, status, bounce_reason, created_at")
    .eq("tenant_id", tenantId)
    .eq("reference_type", "campaign")
    .eq("reference_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  // Stats: prefer the persisted jsonb column (populated by the send
  // worker / Resend webhooks), fall back to counting the email_logs
  // rows we just pulled. If the campaign hasn't been sent yet, every
  // bucket is 0.
  const persistedStats = (campaign.stats as CampaignStats | null) ?? {};
  const logsByStatus: Record<string, number> = {};
  for (const d of deliveries ?? []) {
    logsByStatus[d.status] = (logsByStatus[d.status] ?? 0) + 1;
  }
  const sent = persistedStats.sent ?? (deliveries?.length ?? 0);
  const delivered = persistedStats.delivered ?? logsByStatus["delivered"] ?? logsByStatus["sent"] ?? 0;
  const opened = persistedStats.opened ?? logsByStatus["opened"] ?? 0;
  const clicked = persistedStats.clicked ?? logsByStatus["clicked"] ?? 0;
  const bounced = persistedStats.bounced ?? logsByStatus["bounced"] ?? 0;
  const unsubscribed = persistedStats.unsubscribed ?? 0;
  const converted = persistedStats.converted ?? 0;
  const conversionRevenue = persistedStats.conversion_revenue ?? 0;

  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      sent: "bg-emerald-50 text-emerald-700",
      sending: "bg-amber-50 text-amber-700",
      scheduled: "bg-amber-50 text-amber-700",
      draft: "bg-stone-100 text-stone-600",
      cancelled: "bg-red-50 text-red-600",
      failed: "bg-red-50 text-red-600",
    };
    return (
      <span className={`inline-flex text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${colors[status] ?? "bg-stone-100 text-stone-600"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-2 text-sm text-stone-400">
        <Link href="/marketing" className="hover:text-amber-700">Marketing</Link>
        <span>/</span>
        <Link href="/marketing/campaigns" className="hover:text-amber-700">Campaigns</Link>
        <span>/</span>
        <span className="text-stone-600 truncate max-w-md">{campaign.name}</span>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-semibold text-2xl text-stone-900">{campaign.name}</h1>
            <p className="text-sm text-stone-500 mt-1">{campaign.subject}</p>
          </div>
          <StatusBadge status={campaign.status} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-stone-100">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Scheduled</p>
            <p className="text-sm text-stone-900 mt-1">{fmtDate(campaign.scheduled_at as string | null)}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Sent</p>
            <p className="text-sm text-stone-900 mt-1">{fmtDate(campaign.sent_at as string | null)}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Audience</p>
            <p className="text-sm text-stone-900 mt-1 capitalize">{campaign.recipient_type ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Sent", value: sent, sub: null },
          { label: "Delivered", value: delivered, sub: fmtPct(delivered, sent) },
          { label: "Opened", value: opened, sub: fmtPct(opened, delivered) },
          { label: "Clicked", value: clicked, sub: fmtPct(clicked, opened) },
          { label: "Bounced", value: bounced, sub: fmtPct(bounced, sent), urgent: bounced > 0 },
          { label: "Unsubscribed", value: unsubscribed, sub: fmtPct(unsubscribed, delivered) },
          { label: "Converted", value: converted, sub: fmtPct(converted, clicked) },
          { label: "Revenue", value: conversionRevenue ? `$${conversionRevenue.toFixed(0)}` : "—", sub: null },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400">{s.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${s.urgent ? "text-red-600" : "text-stone-900"}`}>
              {s.value ?? 0}
            </p>
            {s.sub && <p className="text-xs text-stone-400 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Deliveries breakdown */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Delivery breakdown</h2>
          <span className="text-xs text-stone-500">
            {deliveries?.length ?? 0} log row{(deliveries?.length ?? 0) === 1 ? "" : "s"}
          </span>
        </div>
        {!deliveries || deliveries.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-stone-400">
            {campaign.status === "draft" || campaign.status === "scheduled"
              ? "Campaign hasn't sent yet — delivery logs will appear here once it fires."
              : "No delivery logs found for this campaign."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">Recipient</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">Status</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">Bounce reason</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">Logged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-stone-50/60">
                    <td className="px-6 py-3 text-stone-900">{d.recipient}</td>
                    <td className="px-6 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-6 py-3 text-xs text-red-600 max-w-md truncate">{d.bounce_reason ?? "—"}</td>
                    <td className="px-6 py-3 text-xs text-stone-500">{fmtDate(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Body preview */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-stone-900 mb-3">Email body</h2>
        <div className="bg-stone-50 rounded-lg p-4 text-sm text-stone-800 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
          {campaign.body || "(empty)"}
        </div>
      </div>
    </div>
  );
}
