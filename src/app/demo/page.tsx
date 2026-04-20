"use client";

import { useState, useEffect } from "react";

// ─── Mock Data ──────────────────────────────────────────────────────────────

const RECENT_SALES = [
  { id: "6524", customer: "Josh Portlock" },
  { id: "6523", customer: "Sukhamoy Kangsha Banik" },
  { id: "6522", customer: "Jacinda Manettas" },
  { id: "6521", customer: "Alvin Buensuceso" },
  { id: "6520", customer: "Roberta Di Vico" },
];

const RECENT_REPAIRS = [
  { id: "3830", customer: "Matthew Robbins" },
  { id: "3771", customer: "Amarendra Singh" },
  { id: "3716", customer: "Kurt James Roughley" },
  { id: "2", customer: "Jack Germani" },
];

// ─── Action Card ────────────────────────────────────────────────────────────

function ActionCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href="/demo"
      className="group flex items-center gap-5 bg-white border border-stone-200 rounded-2xl px-6 py-5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400 cursor-pointer"
    >
      <div className="flex-shrink-0 text-stone-400 group-hover:text-[#8B7355] transition-colors duration-400">
        {icon}
      </div>
      <div>
        <p className="text-[0.9375rem] font-medium text-stone-900">
          {title}
        </p>
        <p className="text-[0.8125rem] text-stone-400 mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
    </a>
  );
}

// ─── Side Panel ─────────────────────────────────────────────────────────────

function SidePanel({
  title,
  items,
}: {
  title: string;
  items: { id: string; customer: string }[];
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6">
      <h3 className="font-serif text-lg text-stone-900 mb-4">{title}</h3>
      <div className="space-y-0.5">
        {items.map((item) => (
          <a
            key={item.id}
            href="/demo"
            className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-stone-50 transition-colors duration-200"
          >
            <span className="text-[0.8125rem] font-mono text-stone-400 w-10 tabular-nums">
              {item.id}
            </span>
            <span className="text-[0.875rem] text-stone-700">
              {item.customer}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────

const icons = {
  plus: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  cart: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  ),
  search: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  box: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  folder: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  userPlus: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
  ),
  mail: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  users: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  wrench: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.648 5.648a2.121 2.121 0 01-3-3l5.648-5.648m3-3L19.5 4.5m-8.08 10.67a5.068 5.068 0 01-1.54-3.62c0-1.326.527-2.6 1.46-3.54a5.068 5.068 0 013.54-1.46c1.326 0 2.6.527 3.54 1.46" />
    </svg>
  ),
  sparkles: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  ),
  clipboard: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  ),
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Under cacheComponents, `new Date()` during client-component render is
  // flagged as non-deterministic (the prerendered HTML would embed whatever
  // moment the build happens to run). We render `null` for the date/time
  // block until the post-hydration useEffect populates `now`. The rest of
  // the page renders its deterministic shell immediately.
  const d = now;

  return (
    <div className="flex gap-8 items-start">
      {/* ── Main Column ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-10">
        {/* Business name + date/time */}
        <div className="flex items-start justify-between">
          <div className="flex-1 text-center">
            <h1 className="font-serif text-[2.5rem] tracking-[0.08em] text-stone-900 font-normal leading-[1.08]">
              MARCUS & CO.
            </h1>
            <p className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mt-1">
              Fine Jewellery
            </p>
          </div>
          <div className="text-right flex-shrink-0 pt-1">
            <p className="text-[0.875rem] font-medium text-stone-900">
              {d ? d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }) : "\u00a0"}
            </p>
            <p className="text-[0.875rem] text-stone-400 tabular-nums mt-0.5">
              {d ? d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true }) : "\u00a0"}
            </p>
          </div>
        </div>

        {/* ── Sales Menu ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="font-serif text-[1.375rem] text-stone-900 mb-4">
            Sales Menu
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ActionCard title="New Sale" description="Create a sale" icon={icons.plus} />
            <ActionCard title="Quick Sale" description="Create a sale without a customer" icon={icons.cart} />
            <ActionCard title="Find Sale" description="Search for a previous sale" icon={icons.search} />
          </div>
        </section>

        {/* ── Stock Menu ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="font-serif text-[1.375rem] text-stone-900 mb-4">
            Stock Menu
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ActionCard title="Enter Stock" description="Receive stock from a supplier" icon={icons.box} />
            <ActionCard title="New Item" description="Add a new inventory item" icon={icons.folder} />
            <ActionCard title="Find Item" description="Search for a stock item" icon={icons.search} />
          </div>
        </section>

        {/* ── Customer Menu ──────────────────────────────────────────────── */}
        <section>
          <h2 className="font-serif text-[1.375rem] text-stone-900 mb-4">
            Customer Menu
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ActionCard title="New Customer" description="Create a new customer profile" icon={icons.userPlus} />
            <ActionCard title="Communications" description="View all sent communications" icon={icons.mail} />
            <ActionCard title="Find Customer" description="Search for a customer profile" icon={icons.users} />
          </div>
        </section>

        {/* ── Workshop Menu ──────────────────────────────────────────────── */}
        <section>
          <h2 className="font-serif text-[1.375rem] text-stone-900 mb-4">
            Workshop Menu
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ActionCard title="New Repair" description="Log a repair job" icon={icons.wrench} />
            <ActionCard title="Bespoke Job" description="Start a custom commission" icon={icons.sparkles} />
            <ActionCard title="Workshop View" description="See all active jobs" icon={icons.clipboard} />
          </div>
        </section>
      </div>

      {/* ── Right Sidebar ────────────────────────────────────────────────── */}
      <aside className="hidden xl:flex flex-col gap-4 w-[280px] flex-shrink-0 pt-16">
        <SidePanel title="Recent Sales" items={RECENT_SALES} />
        <SidePanel title="Recent Repairs" items={RECENT_REPAIRS} />

        {/* Ready for Pickup */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <h3 className="font-serif text-lg text-stone-900 mb-4 flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Ready for Pickup
          </h3>
          <div className="space-y-0.5">
            {[
              { number: "REP-1038", label: "Clasp Replacement", customer: "Emma Clarke" },
              { number: "REP-1040", label: "Chain Solder & Polish", customer: "David Chen" },
              { number: "BSP-0087", label: "Engagement Ring", customer: "James Taylor" },
            ].map((item) => (
              <a
                key={item.number}
                href="/demo"
                className="block py-2.5 px-2 -mx-2 rounded-xl hover:bg-stone-50 transition-colors duration-200"
              >
                <p className="text-[0.875rem] text-stone-900">{item.label}</p>
                <p className="text-[0.8125rem] text-stone-400 mt-0.5">
                  {item.number} · {item.customer}
                </p>
              </a>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
