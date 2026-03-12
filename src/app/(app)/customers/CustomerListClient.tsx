"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

const TAG_OPTIONS = ["VIP", "Wholesale", "Trade", "Regular"];

const TAG_COLORS: Record<string, string> = {
  VIP: "bg-gold/10 text-gold border border-gold/30",
  Wholesale: "bg-sage/10 text-sage border border-sage/30",
  Trade: "bg-forest/10 text-forest border border-forest/30",
  Regular: "bg-platinum text-forest/60 border border-platinum",
};

function getTagColor(tag: string) {
  return TAG_COLORS[tag] || "bg-platinum text-forest/60 border border-platinum";
}

interface Props {
  customers: Customer[];
  totalCount: number;
  page: number;
  totalPages: number;
  q: string;
  tagFilter: string;
  sort: string;
}

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

  function buildUrl(params: Record<string, string | number>) {
    const url = new URLSearchParams();
    if (params.q) url.set("q", params.q as string);
    if (params.tag) url.set("tag", params.tag as string);
    if (params.sort && params.sort !== "created_at_desc") url.set("sort", params.sort as string);
    if (params.page && params.page !== 1) url.set("page", String(params.page));
    const qs = url.toString();
    return qs ? `/customers?${qs}` : "/customers";
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl({ q: search, tag: tagFilter, sort, page: 1 }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-fraunces text-2xl font-semibold text-forest">Customers</h1>
          <p className="text-forest/60 mt-1 text-sm">
            {totalCount} {totalCount === 1 ? "customer" : "customers"} total
          </p>
        </div>
        <Link
          href="/customers/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Customer
        </Link>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
            />
          </div>
          <button type="submit" className="px-4 py-2 text-sm font-medium bg-forest text-white rounded-lg hover:bg-forest/90 transition-colors">
            Search
          </button>
          {(q || tagFilter) && (
            <Link href="/customers" className="px-4 py-2 text-sm font-medium border border-platinum text-forest/60 rounded-lg hover:border-forest/30 transition-colors">
              Clear
            </Link>
          )}
        </form>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => router.push(buildUrl({ q, tag: tagFilter, sort: e.target.value, page: 1 }))}
          className="px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
        >
          <option value="created_at_desc">Newest first</option>
          <option value="created_at_asc">Oldest first</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
          <option value="updated_desc">Recently updated</option>
        </select>
      </div>

      {/* Tag filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => router.push(buildUrl({ q, sort, page: 1 }))}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            !tagFilter ? "bg-forest text-white border-forest" : "bg-white text-forest/60 border-platinum hover:border-forest/30"
          }`}
        >
          All
        </button>
        {TAG_OPTIONS.map((tag) => (
          <button
            key={tag}
            onClick={() => router.push(buildUrl({ q, tag: tagFilter === tag ? "" : tag, sort, page: 1 }))}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              tagFilter === tag
                ? "bg-sage text-white border-sage"
                : "bg-white text-forest/60 border-platinum hover:border-forest/30"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Table */}
      {customers.length === 0 ? (
        <div className="bg-white rounded-xl border border-platinum p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sage/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="font-fraunces text-lg font-semibold text-forest">
            {q || tagFilter ? "No customers found" : "Add your first customer"}
          </h3>
          <p className="text-forest/50 mt-1 text-sm">
            {q || tagFilter
              ? "Try adjusting your search or filters"
              : "Start building your customer database"}
          </p>
          {!q && !tagFilter && (
            <Link
              href="/customers/new"
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Customer
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-platinum overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-platinum bg-ivory">
                <th className="text-left px-5 py-3 text-xs font-semibold text-forest/50 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-forest/50 uppercase tracking-wide hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-forest/50 uppercase tracking-wide hidden lg:table-cell">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-forest/50 uppercase tracking-wide hidden sm:table-cell">Tags</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-forest/50 uppercase tracking-wide hidden lg:table-cell">Since</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-platinum">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-ivory/50 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-sage/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-sage">
                          {(customer.full_name || customer.email || "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <Link
                          href={`/customers/${customer.id}`}
                          className="font-medium text-forest hover:text-sage transition-colors"
                        >
                          {customer.full_name || "—"}
                        </Link>
                        {customer.is_vip && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 text-xs font-semibold rounded bg-gold/10 text-gold border border-gold/30">
                            VIP
                          </span>
                        )}
                        <p className="text-xs text-forest/40 md:hidden">{customer.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-forest/70 hidden md:table-cell">{customer.email || "—"}</td>
                  <td className="px-4 py-4 text-forest/70 hidden lg:table-cell">
                    {customer.mobile || customer.phone || "—"}
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {customer.tags?.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${getTagColor(tag)}`}
                        >
                          {tag}
                        </span>
                      ))}
                      {(customer.tags?.length || 0) > 3 && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-platinum text-forest/50">
                          +{customer.tags!.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-forest/50 text-xs hidden lg:table-cell">
                    {new Date(customer.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="p-1.5 rounded-lg hover:bg-sage/10 text-forest/40 hover:text-sage transition-colors"
                        title="View"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      <Link
                        href={`/customers/${customer.id}/edit`}
                        className="p-1.5 rounded-lg hover:bg-sage/10 text-forest/40 hover:text-sage transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-platinum flex items-center justify-between">
              <p className="text-xs text-forest/50">
                Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Link
                    href={buildUrl({ q, tag: tagFilter, sort, page: page - 1 })}
                    className="px-3 py-1.5 text-sm border border-platinum rounded-lg hover:border-sage/30 transition-colors text-forest/60 hover:text-forest"
                  >
                    Previous
                  </Link>
                )}
                <span className="px-3 py-1.5 text-sm font-medium text-forest bg-sage/10 rounded-lg">
                  {page}
                </span>
                {page < totalPages && (
                  <Link
                    href={buildUrl({ q, tag: tagFilter, sort, page: page + 1 })}
                    className="px-3 py-1.5 text-sm border border-platinum rounded-lg hover:border-sage/30 transition-colors text-forest/60 hover:text-forest"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
