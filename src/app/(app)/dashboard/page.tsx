import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const CHECKLIST = [
  { label: "Create your account", done: true },
  { label: "Complete business setup", done: true },
  { label: "Add your first customer", done: false, href: "/customers" },
  { label: "Create a bespoke job", done: false, href: "/bespoke/new" },
  { label: "Issue your first invoice", done: false, href: "/invoices" },
  { label: "Invite a team member", done: false, href: "/settings" },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("full_name, tenant_id, tenants(name, plan:subscriptions(plan, status, trial_ends_at))")
    .eq("id", user?.id ?? "")
    .single();

  const firstName = userData?.full_name?.split(" ")[0] || "there";
  const tenantName = (userData?.tenants as { name?: string } | null)?.name;
  const tenantId = userData?.tenant_id;

  const today = new Date().toISOString().split("T")[0];

  // Active jobs count
  const { count: activeJobsCount } = await supabase
    .from("bespoke_jobs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .not("stage", "in", '("completed","cancelled")');

  // Overdue jobs count
  const { count: overdueJobsCount } = await supabase
    .from("bespoke_jobs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .not("stage", "in", '("completed","cancelled")')
    .lt("due_date", today);

  // Active repairs count
  const { count: activeRepairsCount } = await supabase
    .from("repairs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .not("stage", "in", '("collected","cancelled")');

  // Overdue repairs count
  const { count: overdueRepairsCount } = await supabase
    .from("repairs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .not("stage", "in", '("collected","cancelled")')
    .lt("due_date", today);

  // Customer count
  const { count: customerCount } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null);

  const STAT_CARDS = [
    {
      label: "Active Jobs",
      value: String(activeJobsCount ?? 0),
      href: "/bespoke",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      note: (activeJobsCount ?? 0) > 0 ? "In progress" : "No active jobs",
      urgent: false,
    },
    {
      label: "Overdue Jobs",
      value: String(overdueJobsCount ?? 0),
      href: "/bespoke",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      note: (overdueJobsCount ?? 0) > 0 ? "Needs attention" : "All on time",
      urgent: (overdueJobsCount ?? 0) > 0,
    },
    {
      label: "Active Repairs",
      value: String(activeRepairsCount ?? 0),
      href: "/repairs",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      note: (activeRepairsCount ?? 0) > 0 ? "In progress" : "No active repairs",
      urgent: false,
    },
    {
      label: "Overdue Repairs",
      value: String(overdueRepairsCount ?? 0),
      href: "/repairs",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      note: (overdueRepairsCount ?? 0) > 0 ? "Needs attention" : "All on time",
      urgent: (overdueRepairsCount ?? 0) > 0,
    },
    {
      label: "Customers",
      value: String(customerCount ?? 0),
      href: "/customers",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      note: (customerCount ?? 0) > 0 ? "Total clients" : "No customers yet",
      urgent: false,
    },
    {
      label: "Revenue (MTD)",
      value: "£0",
      href: "/invoices",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      note: "Invoicing coming soon",
      urgent: false,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="font-fraunces text-2xl font-semibold text-forest">
          Welcome back, {firstName} 👋
        </h1>
        {tenantName && (
          <p className="text-forest/60 mt-1">{tenantName}</p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {STAT_CARDS.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl border border-platinum p-5 hover:border-sage/40 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-forest/50 uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                card.urgent ? "bg-red-50 text-red-500" : "bg-sage/10 text-sage"
              }`}>
                {card.icon}
              </div>
            </div>
            <p className={`font-fraunces text-2xl font-semibold ${
              card.urgent && card.value !== "0" ? "text-red-500" : "text-forest"
            }`}>
              {card.value}
            </p>
            <p className={`text-xs mt-1 ${
              card.urgent && card.value !== "0" ? "text-red-400" : "text-forest/40"
            }`}>
              {card.note}
            </p>
          </Link>
        ))}
      </div>

      {/* Getting started checklist */}
      <div className="bg-white rounded-xl border border-platinum p-6">
        <h2 className="font-fraunces text-lg font-semibold text-forest mb-4">
          Getting started
        </h2>
        <div className="space-y-3">
          {CHECKLIST.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.done
                    ? "bg-sage"
                    : "border-2 border-platinum"
                }`}
              >
                {item.done && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span
                className={`text-sm ${
                  item.done
                    ? "line-through text-forest/40"
                    : "text-forest"
                }`}
              >
                {item.done || !item.href ? (
                  item.label
                ) : (
                  <a href={item.href} className="hover:text-sage transition-colors">
                    {item.label}
                  </a>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 h-1.5 bg-platinum rounded-full overflow-hidden">
          <div
            className="h-full bg-sage rounded-full transition-all"
            style={{
              width: `${(CHECKLIST.filter((c) => c.done).length / CHECKLIST.length) * 100}%`,
            }}
          />
        </div>
        <p className="text-xs text-forest/40 mt-2">
          {CHECKLIST.filter((c) => c.done).length} of {CHECKLIST.length} complete
        </p>
      </div>
    </div>
  );
}
