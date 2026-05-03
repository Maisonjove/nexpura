import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Message — Nexpura" };

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default async function CommunicationDetailPage({
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

  const { data: comm } = await admin
    .from("communications")
    .select("id, type, subject, body, customer_name, customer_email, status, sent_at, created_at, sent_by")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!comm) notFound();

  let senderName: string | null = null;
  if (comm.sent_by) {
    const { data: sender } = await admin
      .from("users")
      .select("full_name, email")
      .eq("id", comm.sent_by)
      .maybeSingle();
    senderName = sender?.full_name || sender?.email || null;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-stone-400">
        <Link href="/communications?tab=manual" className="hover:text-amber-700">Communications</Link>
        <span>/</span>
        <span className="text-stone-600">Message</span>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex text-xs font-bold uppercase tracking-wide text-amber-700">
              {comm.type}
            </span>
            <h1 className="font-semibold text-2xl text-stone-900 mt-1">
              {comm.subject || "(no subject)"}
            </h1>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
            comm.status === "sent" ? "bg-green-50 text-green-700" :
            comm.status === "failed" ? "bg-red-50 text-red-600" :
            "bg-stone-100 text-stone-600"
          }`}>
            {comm.status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400">To</p>
            <p className="text-sm text-stone-900 mt-1">{comm.customer_name || "—"}</p>
            <p className="text-xs text-stone-500">{comm.customer_email || ""}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Sent</p>
            <p className="text-sm text-stone-900 mt-1">{fmt(comm.sent_at as string | null) || fmt(comm.created_at as string | null)}</p>
            {senderName && <p className="text-xs text-stone-500">by {senderName}</p>}
          </div>
        </div>

        <div className="pt-2 border-t border-stone-100">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">Message</p>
          <div className="bg-stone-50 rounded-lg p-4 text-sm text-stone-800 whitespace-pre-wrap font-mono">
            {comm.body || "(empty)"}
          </div>
        </div>
      </div>
    </div>
  );
}
