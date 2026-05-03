import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { markAllAsRead } from "@/app/(app)/actions/notifications";
import { revalidatePath } from "next/cache";

async function markAllReadAction() {
  "use server";
  await markAllAsRead();
  revalidatePath("/notifications");
}

export const metadata = { title: "Notifications — Nexpura" };

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TYPE_LABELS: Record<string, { label: string; colour: string }> = {
  repair_completed: { label: "Repair", colour: "bg-stone-100 text-stone-700" },
  repair_ready: { label: "Repair Ready", colour: "bg-green-50 text-green-700" },
  job_completed: { label: "Bespoke Job", colour: "bg-amber-50 text-amber-700" },
  sale_created: { label: "Sale", colour: "bg-amber-700/10 text-amber-700" },
  invoice_paid: { label: "Invoice Paid", colour: "bg-green-50 text-green-700" },
  account_suspended: { label: "Account", colour: "bg-red-50 text-red-700" },
  grace_period_24h: { label: "Billing", colour: "bg-red-50 text-red-700" },
  trial_ending: { label: "Trial", colour: "bg-amber-50 text-amber-700" },
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = userData?.tenant_id;

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("tenant_id", tenantId ?? "")
    .order("created_at", { ascending: false })
    .limit(100);

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-semibold text-2xl text-stone-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-stone-500 text-sm mt-1">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* W14 (Group 14 audit): preferences (email/SMS/WhatsApp toggles
              per category) live at /settings/notifications. Pre-fix
              there was no way to reach them from this page — staff who
              wanted to silence repair_ready emails had to dig through
              settings. Surface the link inline. */}
          <Link
            href="/settings/notifications"
            className="text-sm text-stone-500 hover:text-stone-900 font-medium transition-colors inline-flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Preferences
          </Link>
          {unreadCount > 0 && (
            <form action={markAllReadAction}>
              <button
                type="submit"
                className="text-sm text-amber-700 hover:text-[amber-800] font-medium transition-colors"
              >
                Mark all as read
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        {!notifications || notifications.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-stone-400 text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {notifications.map((n) => {
              const typeInfo = TYPE_LABELS[n.type] ?? { label: n.type, colour: "bg-stone-100 text-stone-600" };
              const inner = (
                <div
                  className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                    !n.is_read ? "bg-amber-700/5" : "hover:bg-stone-50/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeInfo.colour}`}>
                        {typeInfo.label}
                      </span>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-amber-700 flex-shrink-0" />
                      )}
                    </div>
                    <p className={`text-sm ${!n.is_read ? "font-semibold text-stone-900" : "text-stone-800"}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-stone-500 mt-0.5">{n.body}</p>
                    )}
                    <p className="text-xs text-stone-400 mt-1.5">{relativeTime(n.created_at)}</p>
                  </div>
                  {n.link && (
                    <svg className="w-4 h-4 text-stone-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              );

              if (n.link) {
                return (
                  <Link key={n.id} href={n.link} className="block">
                    {inner}
                  </Link>
                );
              }
              return <div key={n.id}>{inner}</div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
