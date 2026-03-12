import { createClient } from "@/lib/supabase/server";

const CHECKLIST = [
  { label: "Create your account", done: true },
  { label: "Complete business setup", done: true },
  { label: "Add your first customer", done: false, href: "/customers" },
  { label: "Create a job or repair", done: false, href: "/jobs" },
  { label: "Issue your first invoice", done: false, href: "/invoices" },
  { label: "Invite a team member", done: false, href: "/settings" },
];

const STAT_CARDS = [
  {
    label: "Active Jobs",
    value: "0",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    change: null,
  },
  {
    label: "Open Repairs",
    value: "0",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    change: null,
  },
  {
    label: "Customers",
    value: "0",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    change: null,
  },
  {
    label: "Revenue (MTD)",
    value: "£0",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    change: null,
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("full_name, tenants(name, plan:subscriptions(plan, status, trial_ends_at))")
    .eq("id", user?.id ?? "")
    .single();

  const firstName = userData?.full_name?.split(" ")[0] || "there";
  const tenantName = (userData?.tenants as { name?: string } | null)?.name;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-platinum p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-forest/50 uppercase tracking-wider">
                {card.label}
              </span>
              <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center text-sage">
                {card.icon}
              </div>
            </div>
            <p className="font-fraunces text-2xl font-semibold text-forest">
              {card.value}
            </p>
            <p className="text-xs text-forest/40 mt-1">No data yet</p>
          </div>
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
