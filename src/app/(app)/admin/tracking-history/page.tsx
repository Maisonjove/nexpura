import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { MessageSquare } from "lucide-react";
import logger from "@/lib/logger";

export const metadata = { title: "Tracking history — Nexpura" };

interface MessageRow {
  id: string;
  tenant_id: string;
  order_type: "repair" | "bespoke";
  order_id: string;
  sender_type: "customer" | "staff";
  sender_display_name: string | null;
  body: string;
  message_type: "general" | "amendment_request" | "reply";
  read_by_staff_at: string | null;
  created_at: string;
}

interface OrderRef {
  id: string;
  tracking_id: string | null;
  item_description: string | null;
  number: string | null;
}

export default function TrackingHistoryPage() {
  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900 font-serif">Tracking history</h1>
        <p className="text-sm text-stone-500 mt-1">
          Every message sent through your customers' tracking pages, plus your team's replies and any
          bespoke approve/decline events. Click an order to open the full thread.
        </p>
      </div>

      <Suspense fallback={<TrackingHistorySkeleton />}>
        <TrackingHistoryBody />
      </Suspense>
    </div>
  );
}

async function TrackingHistoryBody() {
  // Joey 2026-05-03 P2-E audit (product call): restrict to owner +
  // manager. Pre-fix any authed tenant member could view customer
  // amendment requests on order_messages — Joey's spec: "same
  // pattern as G15 settings audit", so manager-or-better.
  const ctx = await resolveTenantWithRole();
  if (!ctx) {
    return (
      <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center">
        <p className="text-sm text-stone-500">Not authenticated.</p>
      </div>
    );
  }
  if (ctx.role !== "owner" && ctx.role !== "manager") {
    return (
      <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center">
        <p className="text-sm text-stone-500">This view is restricted to managers and owners.</p>
      </div>
    );
  }
  const tenantId = ctx.tenantId;

  const { messages, repairLookup, bespokeLookup } = await loadTrackingHistory(tenantId);

  if (messages.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center">
        <MessageSquare className="mx-auto text-stone-300" size={32} />
        <h3 className="mt-3 text-sm font-medium text-stone-900">No messages yet</h3>
        <p className="mt-1 text-xs text-stone-500 max-w-md mx-auto">
          Customers can send updates and amendment requests from their tracking link. Anything they
          send — and your replies — will land here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-100">
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-stone-400">When</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-stone-400">Order</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-stone-400">Sender</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-stone-400">Type</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-stone-400">Message</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-stone-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {messages.map((m) => {
              const ref =
                m.order_type === "repair" ? repairLookup.get(m.order_id) : bespokeLookup.get(m.order_id);
              const orderHref = m.order_type === "repair" ? `/repairs/${m.order_id}` : `/bespoke/${m.order_id}`;
              const isCustomer = m.sender_type === "customer";
              const isAmendment = m.message_type === "amendment_request";
              const isUnread = isCustomer && m.read_by_staff_at === null;

              return (
                <tr key={m.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4 text-stone-500 whitespace-nowrap">
                    {format(new Date(m.created_at), "dd MMM yyyy, HH:mm")}
                  </td>
                  <td className="px-6 py-4">
                    <Link href={orderHref} className="text-stone-900 hover:text-amber-700 font-medium">
                      {ref?.tracking_id ?? `${m.order_type === "repair" ? "RPR" : "BSP"}-${m.order_id.slice(0, 8)}`}
                    </Link>
                    {ref?.item_description && (
                      <p className="text-stone-400 truncate max-w-[180px]">{ref.item_description}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isCustomer ? (
                      <span className="px-2 py-0.5 bg-stone-100 text-stone-700 font-bold rounded uppercase tracking-tighter">
                        Customer
                      </span>
                    ) : (
                      <span className="font-medium text-stone-900">{m.sender_display_name || "Staff"}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 font-bold rounded uppercase tracking-tighter ${
                        m.order_type === "repair"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-purple-50 text-purple-700"
                      }`}
                    >
                      {m.order_type}
                    </span>
                    {isAmendment && (
                      <span className="ml-1 px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded uppercase tracking-tighter">
                        amendment
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-stone-600 max-w-md">
                    <p className="line-clamp-2">{m.body}</p>
                  </td>
                  <td className="px-6 py-4">
                    {isCustomer ? (
                      isUnread ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded uppercase tracking-tighter">
                          New
                        </span>
                      ) : (
                        <span className="text-stone-400">Read</span>
                      )
                    ) : (
                      <span className="text-stone-400">Sent</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function resolveTenantWithRole(): Promise<{ tenantId: string; role: string } | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = createAdminClient();
    const { data } = await admin.from("users").select("tenant_id, role").eq("id", user.id).single();
    if (!data?.tenant_id) return null;
    return { tenantId: data.tenant_id as string, role: (data.role as string) || "staff" };
  } catch (error) {
    logger.error("[admin/tracking-history] resolveTenantWithRole failed", error);
    return null;
  }
}

async function loadTrackingHistory(tenantId: string): Promise<{
  messages: MessageRow[];
  repairLookup: Map<string, OrderRef>;
  bespokeLookup: Map<string, OrderRef>;
}> {
  try {
    const admin = createAdminClient();
    const { data: messageRows } = await admin
      .from("order_messages")
      .select(
        "id, tenant_id, order_type, order_id, sender_type, sender_display_name, body, message_type, read_by_staff_at, created_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200);

    const messages = (messageRows ?? []) as MessageRow[];

    const repairIds = new Set<string>();
    const bespokeIds = new Set<string>();
    for (const m of messages) {
      (m.order_type === "repair" ? repairIds : bespokeIds).add(m.order_id);
    }

    // Pull every distinct order in one round-trip per type so the table can
    // show tracking_id + item_description without an N+1.
    const [repairs, bespokes] = await Promise.all([
      repairIds.size > 0
        ? admin
            .from("repairs")
            .select("id, tracking_id, item_description, repair_number")
            .in("id", [...repairIds])
            .eq("tenant_id", tenantId)
        : Promise.resolve({ data: [] as Array<{ id: string; tracking_id: string | null; item_description: string | null; repair_number: string | null }> }),
      bespokeIds.size > 0
        ? admin
            .from("bespoke_jobs")
            .select("id, tracking_id, item_description")
            .in("id", [...bespokeIds])
            .eq("tenant_id", tenantId)
        : Promise.resolve({ data: [] as Array<{ id: string; tracking_id: string | null; item_description: string | null }> }),
    ]);

    const repairLookup = new Map<string, OrderRef>();
    for (const r of repairs.data ?? []) {
      repairLookup.set(r.id, {
        id: r.id,
        tracking_id: r.tracking_id,
        item_description: r.item_description,
        number: r.repair_number,
      });
    }
    const bespokeLookup = new Map<string, OrderRef>();
    for (const b of bespokes.data ?? []) {
      bespokeLookup.set(b.id, {
        id: b.id,
        tracking_id: b.tracking_id,
        item_description: b.item_description,
        number: null,
      });
    }

    return { messages, repairLookup, bespokeLookup };
  } catch (error) {
    logger.error("[admin/tracking-history] loadTrackingHistory failed", error);
    return { messages: [], repairLookup: new Map(), bespokeLookup: new Map() };
  }
}

function TrackingHistorySkeleton() {
  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
      <Skeleton className="h-12 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full border-t border-stone-100" />
      ))}
    </div>
  );
}
