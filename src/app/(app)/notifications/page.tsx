import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { markAllAsRead } from "@/app/(app)/actions/notifications";
import { revalidatePath } from "next/cache";
import {
  BellIcon,
  Cog6ToothIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

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

const TYPE_LABELS: Record<string, { label: string; badge: string }> = {
  repair_completed: { label: "Repair", badge: "nx-badge-neutral" },
  repair_ready: { label: "Repair Ready", badge: "nx-badge-success" },
  job_completed: { label: "Bespoke Job", badge: "nx-badge-neutral" },
  sale_created: { label: "Sale", badge: "nx-badge-neutral" },
  invoice_paid: { label: "Invoice Paid", badge: "nx-badge-success" },
  account_suspended: { label: "Account", badge: "nx-badge-danger" },
  grace_period_24h: { label: "Billing", badge: "nx-badge-danger" },
  trial_ending: { label: "Trial", badge: "nx-badge-warning" },
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
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
          <div>
            <p className="text-[0.75rem] tracking-luxury uppercase text-stone-400 mb-3">
              Inbox
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-stone-900 leading-[1.05] mb-2">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <p className="text-stone-500 text-[0.9375rem]">
                <span className="tabular-nums">{unreadCount}</span> unread
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings/notifications"
              className="px-4 py-2 rounded-md text-sm font-medium border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200 inline-flex items-center gap-2"
            >
              <Cog6ToothIcon className="w-4 h-4" strokeWidth={1.5} />
              Preferences
            </Link>
            {unreadCount > 0 && (
              <form action={markAllReadAction}>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors duration-200"
                >
                  Mark all as read
                </button>
              </form>
            )}
          </div>
        </div>

        {!notifications || notifications.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl py-20 text-center">
            <BellIcon
              className="w-10 h-10 text-stone-300 mx-auto mb-6"
              strokeWidth={1.5}
            />
            <h3 className="font-serif text-2xl tracking-tight text-stone-900 mb-2">
              All caught up
            </h3>
            <p className="text-stone-500 text-sm">
              You&apos;ll see updates here when something needs your attention.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const typeInfo =
                TYPE_LABELS[n.type] ?? { label: n.type, badge: "nx-badge-neutral" };
              const inner = (
                <div
                  className={`group bg-white border rounded-2xl px-6 py-5 flex items-start gap-4 transition-all duration-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 ${
                    !n.is_read ? "border-nexpura-bronze/30" : "border-stone-200"
                  }`}
                >
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-nexpura-bronze flex-shrink-0 mt-2" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={typeInfo.badge}>{typeInfo.label}</span>
                    </div>
                    <p
                      className={`font-serif text-lg tracking-tight leading-snug ${
                        !n.is_read ? "text-stone-900" : "text-stone-700"
                      }`}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-[0.875rem] text-stone-500 mt-1.5 leading-relaxed">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[0.75rem] text-stone-400 mt-2 tabular-nums">
                      {relativeTime(n.created_at)}
                    </p>
                  </div>
                  {n.link && (
                    <ChevronRightIcon
                      className="w-4 h-4 text-stone-300 flex-shrink-0 mt-2 group-hover:text-nexpura-bronze group-hover:translate-x-0.5 transition-all duration-300"
                      strokeWidth={1.5}
                    />
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
