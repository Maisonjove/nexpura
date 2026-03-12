"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import TagPill from "@/components/TagPill";

// ─── Types ────────────────────────────────────────────────────────────────────

type Customer = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  tags: string[] | null;
  is_vip: boolean | null;
  created_at: string;
  updated_at: string | null;
};

interface Props {
  customers: Customer[];
  totalCount: number;
  page: number;
  totalPages: number;
  q: string;
  tagFilter: string;
  sort: string;
}

// ─── Sample data ──────────────────────────────────────────────────────────────

const SAMPLE_CUSTOMERS = [
  { id: "c1", name: "Sarah Khoury", initials: "SK", tags: ["VIP", "Bridal"], phone: "+61 412 555 001", email: "sarah@email.com", lastPurchase: "8 Mar 2026", totalSpend: "$48,200", jobs: 4, color: "bg-[#E8F0EB] text-[#1a4731]" },
  { id: "c2", name: "David Moufarrej", initials: "DM", tags: ["VIP"], phone: "+61 413 555 002", email: "david@email.com", lastPurchase: "5 Mar 2026", totalSpend: "$31,500", jobs: 2, color: "bg-blue-50 text-blue-700" },
  { id: "c3", name: "Lina Haddad", initials: "LH", tags: ["Retail"], phone: "+61 414 555 003", email: "lina@email.com", lastPurchase: "1 Mar 2026", totalSpend: "$8,400", jobs: 1, color: "bg-purple-50 text-purple-700" },
  { id: "c4", name: "Mia Tanaka", initials: "MT", tags: ["Bridal"], phone: "+61 415 555 004", email: "mia@email.com", lastPurchase: "28 Feb 2026", totalSpend: "$22,100", jobs: 3, color: "bg-rose-50 text-rose-700" },
  { id: "c5", name: "James Obeid", initials: "JO", tags: ["Wholesale"], phone: "+61 416 555 005", email: "james@email.com", lastPurchase: "20 Feb 2026", totalSpend: "$67,800", jobs: 8, color: "bg-amber-50 text-amber-700" },
];

const AVATAR_COLORS = [
  "bg-[#E8F0EB] text-[#1a4731]",
  "bg-blue-50 text-blue-700",
  "bg-purple-50 text-purple-700",
  "bg-rose-50 text-rose-700",
  "bg-amber-50 text-amber-700",
  "bg-cyan-50 text-cyan-700",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerListClient({
  customers,
  totalCount,
  page,
  totalPages,
  q,
  tagFilter,
  sort,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [activeTab, setActiveTab] = useState(tagFilter || "all");

  const useSampleData = customers.length === 0;

  function buildUrl(params: Record<string, string | number>) {
    const url = new URLSearchParams();
    if (params.q) url.set("q", params.q as string);
    if (params.tag && params.tag !== "all") url.set("tag", params.tag as string);
    if (params.sort && params.sort !== "created_at_desc") url.set("sort", params.sort as string);
    if (params.page && params.page !== 1) url.set("page", String(params.page));
    const qs = url.toString();
    return qs ? `/customers?${qs}` : "/customers";
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl({ q: search, tag: tagFilter, sort, page: 1 }));
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    router.push(buildUrl({ q: search, tag: tab === "all" ? "" : tab, sort, page: 1 }));
  }

  const filterTabs = [
    { key: "all", label: "All" },
    { key: "VIP", label: "VIP" },
    { key: "Bridal", label: "Bridal" },
    { key: "Wholesale", label: "Wholesale" },
    { key: "Retail", label: "Retail" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold text-[#1C1C1E]">Customers</h1>
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers…"
              className="w-52 pl-8 pr-3 py-2 text-sm bg-white border border-[#E8E6E1] rounded-lg text-[#1C1C1E] placeholder-[#C0C0C0] focus:outline-none focus:border-[#1a4731]"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C0C0C0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </form>
          <Link
            href="/customers/new"
            className="inline-flex items-center gap-2 bg-[#1a4731] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#1a4731]/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Customer
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: useSampleData ? "428" : String(totalCount) },
          { label: "VIP", value: "32" },
          { label: "New this month", value: "14" },
          { label: "Avg Spend", value: "$3,200" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-[#E8E6E1] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A]">{s.label}</p>
            <p className="text-xl font-semibold mt-1 text-[#1C1C1E]">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center bg-white border border-[#E8E6E1] rounded-lg p-1 gap-0.5 w-fit">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === tab.key
                ? "bg-[#1a4731] text-white shadow-sm"
                : "text-[#6B6B6B] hover:text-[#1C1C1E]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E8E6E1] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F0EDE9]">
                {["Customer", "Tags", "Phone", "Email", "Last Purchase", "Total Spend", "Jobs", ""].map((h) => (
                  <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A] px-5 py-3 bg-[#F8F7F5]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F3F0]">
              {useSampleData
                ? SAMPLE_CUSTOMERS.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F8F7F5] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${c.color}`}>
                            {c.initials}
                          </div>
                          <span className="text-sm font-medium text-[#1C1C1E]">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {c.tags.map((tag) => <TagPill key={tag} tag={tag} />)}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-[#6B6B6B]">{c.phone}</td>
                      <td className="px-5 py-3 text-sm text-[#6B6B6B]">{c.email}</td>
                      <td className="px-5 py-3 text-sm text-[#6B6B6B]">{c.lastPurchase}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-[#1C1C1E]">{c.totalSpend}</td>
                      <td className="px-5 py-3 text-sm text-[#6B6B6B]">{c.jobs} jobs</td>
                      <td className="px-5 py-3">
                        <Link href="/customers" className="text-xs text-[#1a4731] font-semibold hover:underline">→</Link>
                      </td>
                    </tr>
                  ))
                : customers.map((customer) => {
                    const name = customer.full_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Unknown";
                    const initials = getInitials(name);
                    const avatarColor = getAvatarColor(name);
                    const tags: string[] = [
                      ...(customer.is_vip ? ["VIP"] : []),
                      ...(customer.tags || []),
                    ];
                    return (
                      <tr key={customer.id} className="hover:bg-[#F8F7F5] transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${avatarColor}`}>
                              {initials}
                            </div>
                            <span className="text-sm font-medium text-[#1C1C1E]">{name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {tags.map((tag) => <TagPill key={tag} tag={tag} />)}
                            {tags.length === 0 && <span className="text-[#C0C0C0] text-xs">—</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-[#6B6B6B]">{customer.mobile || customer.phone || "—"}</td>
                        <td className="px-5 py-3 text-sm text-[#6B6B6B]">{customer.email || "—"}</td>
                        <td className="px-5 py-3 text-sm text-[#6B6B6B]">
                          {customer.updated_at
                            ? new Date(customer.updated_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold text-[#1C1C1E]">—</td>
                        <td className="px-5 py-3 text-sm text-[#6B6B6B]">—</td>
                        <td className="px-5 py-3">
                          <Link href={`/customers/${customer.id}`} className="text-xs text-[#1a4731] font-semibold hover:underline">→</Link>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!useSampleData && totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[#F0EDE9] flex items-center justify-between">
            <p className="text-xs text-[#9A9A9A]">
              Page {page} of {totalPages} · {totalCount} customers
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildUrl({ q, tag: tagFilter, sort, page: page - 1 })}
                  className="px-3 py-1.5 text-xs font-medium text-[#6B6B6B] bg-white border border-[#E8E6E1] rounded-lg hover:bg-[#F8F7F5] transition-colors"
                >
                  ← Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildUrl({ q, tag: tagFilter, sort, page: page + 1 })}
                  className="px-3 py-1.5 text-xs font-medium text-[#6B6B6B] bg-white border border-[#E8E6E1] rounded-lg hover:bg-[#F8F7F5] transition-colors"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
