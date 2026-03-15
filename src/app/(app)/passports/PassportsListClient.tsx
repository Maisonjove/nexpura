"use client";

import { useState } from "react";
import Link from "next/link";

interface Passport {
  id: string;
  passport_uid: string;
  title: string;
  jewellery_type: string | null;
  current_owner_name: string | null;
  status: string;
  is_public: boolean;
  verified_at: string | null;
  created_at: string;
}

interface Props {
  passports: Passport[];
  total: number;
  active: number;
  verified: number;
  publicCount: number;
  basePath?: string;
  readOnly?: boolean;
}

export default function PassportsListClient({ passports, total, active, verified, publicCount, basePath = "", readOnly = false }: Props) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterVisibility, setFilterVisibility] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = passports.filter((p) => {
    const q = search.toLowerCase();
    if (q && !p.title.toLowerCase().includes(q) && !p.passport_uid.toLowerCase().includes(q) && !(p.current_owner_name?.toLowerCase() ?? "").includes(q)) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterVisibility === "public" && !p.is_public) return false;
    if (filterVisibility === "private" && p.is_public) return false;
    return true;
  });

  async function copyVerifyLink(uid: string) {
    const link = `${window.location.origin}/verify/${uid}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(uid);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl text-stone-900">Digital Passports</h1>
          <p className="text-sm text-gray-500 mt-1">Verifiable certificates of authenticity for every piece</p>
        </div>
        {!readOnly && (
          <Link
            href={`${basePath}/passports/new`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Passport
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: total, color: "text-stone-900" },
          { label: "Active", value: active, color: "text-[#8B7355]" },
          { label: "Verified", value: verified, color: "text-green-700" },
          { label: "Public", value: publicCount, color: "text-stone-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{stat.label}</p>
            <p className={`text-3xl font-semibold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, UID or owner…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 focus:border-[#8B7355]"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="reported_stolen">Reported Stolen</option>
        </select>

        <select
          value={filterVisibility}
          onChange={(e) => setFilterVisibility(e.target.value)}
          className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
        >
          <option value="all">All Visibility</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>

        {(search || filterStatus !== "all" || filterVisibility !== "all") && (
          <button
            onClick={() => { setSearch(""); setFilterStatus("all"); setFilterVisibility("all"); }}
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            Clear filters
          </button>
        )}

        <p className="text-sm text-stone-400 ml-auto">
          {filtered.length} of {total}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg text-stone-900">No passports found</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              {search ? "Try a different search" : "Create your first digital jewellery passport"}
            </p>
            {!search && !readOnly && (
              <Link
                href={`${basePath}/passports/new`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Passport
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-gray-50/50">
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Passport UID</th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Owner</th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                  <th className="text-right px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((passport) => (
                  <tr key={passport.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-semibold bg-stone-100 text-[#8B7355] px-2 py-1 rounded">
                        {passport.passport_uid}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium text-stone-900 max-w-48">
                      <p className="truncate">{passport.title}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-500 capitalize">
                      {passport.jewellery_type?.replace(/_/g, " ") || "—"}
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {passport.current_owner_name || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          passport.status === "active"
                            ? "bg-green-50 text-green-700"
                            : passport.status === "reported_stolen"
                            ? "bg-red-50 text-red-600"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            passport.status === "active" ? "bg-green-500" :
                            passport.status === "reported_stolen" ? "bg-red-500" : "bg-gray-400"
                          }`} />
                          {passport.status.replace(/_/g, " ")}
                        </span>
                        {!passport.is_public && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Private
                          </span>
                        )}
                        {passport.verified_at && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            ✓ Verified
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(passport.created_at).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-3">
                        {passport.is_public && (
                          <button
                            onClick={() => copyVerifyLink(passport.passport_uid)}
                            title="Copy verify link"
                            className="text-xs text-stone-400 hover:text-[#8B7355] transition-colors"
                          >
                            {copiedId === passport.passport_uid ? "✓ Copied" : "Copy Link"}
                          </button>
                        )}
                        <Link
                          href={`${basePath}/passports/${passport.id}`}
                          className="text-[#8B7355] hover:text-[#8B7355]/80 text-xs font-medium transition-colors"
                        >
                          View
                        </Link>
                        {!readOnly && (
                          <Link
                            href={`${basePath}/passports/${passport.id}/edit`}
                            className="text-gray-400 hover:text-gray-600 text-xs font-medium transition-colors"
                          >
                            Edit
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
