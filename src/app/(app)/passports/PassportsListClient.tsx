"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  CheckBadgeIcon,
  ClipboardDocumentIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

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

  const stats = [
    { label: "Total", value: total },
    { label: "Active", value: active },
    { label: "Verified", value: verified },
    { label: "Public", value: publicCount },
  ];

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Provenance
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
              Digital Passports
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              Verifiable certificates of authenticity for every piece.
            </p>
          </div>
          {!readOnly && (
            <Link
              href={`${basePath}/passports/new`}
              className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
            >
              <PlusIcon className="w-4 h-4" />
              Create Passport
            </Link>
          )}
        </div>

        {/* Stat strip */}
        {total > 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl mb-10">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-stone-200">
              {stats.map((stat) => (
                <div key={stat.label} className="px-6 py-6">
                  <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                    {stat.label}
                  </p>
                  <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight leading-none">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-wrap gap-3 items-center mb-8">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search by name, UID or owner…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="reported_stolen">Reported Stolen</option>
          </select>

          <select
            value={filterVisibility}
            onChange={(e) => setFilterVisibility(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
          >
            <option value="all">All Visibility</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>

          {(search || filterStatus !== "all" || filterVisibility !== "all") && (
            <button
              onClick={() => { setSearch(""); setFilterStatus("all"); setFilterVisibility("all"); }}
              className="text-xs text-stone-400 hover:text-stone-700 transition-colors duration-200"
            >
              Clear filters
            </button>
          )}

          <p className="text-sm text-stone-400 ml-auto tabular-nums">
            {filtered.length} of {total}
          </p>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <ShieldCheckIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              No passports found
            </h3>
            <p className="text-stone-500 text-sm mb-7 max-w-sm mx-auto leading-relaxed">
              {search || filterStatus !== "all" || filterVisibility !== "all"
                ? "Try a different search or clear your filters."
                : "Create your first digital jewellery passport to track provenance and authenticity."}
            </p>
            {!search && filterStatus === "all" && filterVisibility === "all" && !readOnly && (
              <Link
                href={`${basePath}/passports/new`}
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Create Passport
              </Link>
            )}
            {(search || filterStatus !== "all" || filterVisibility !== "all") && (
              <button
                onClick={() => { setSearch(""); setFilterStatus("all"); setFilterVisibility("all"); }}
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((passport) => {
              const isStolen = passport.status === "reported_stolen";
              const isActive = passport.status === "active";

              return (
                <div
                  key={passport.id}
                  className="group bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2.5">
                        <span className="font-mono text-xs text-stone-400 tabular-nums">
                          {passport.passport_uid}
                        </span>
                        {isActive ? (
                          <span className="nx-badge-success">Active</span>
                        ) : isStolen ? (
                          <span className="nx-badge-danger">Reported Stolen</span>
                        ) : (
                          <span className="nx-badge-neutral capitalize">
                            {passport.status.replace(/_/g, " ")}
                          </span>
                        )}
                        {passport.verified_at && (
                          <span className="nx-badge-success inline-flex items-center gap-1">
                            <CheckBadgeIcon className="w-3.5 h-3.5" />
                            Verified
                          </span>
                        )}
                        {passport.is_public ? (
                          <span className="nx-badge-info">Public</span>
                        ) : (
                          <span className="nx-badge-neutral">Private</span>
                        )}
                      </div>

                      <Link
                        href={`${basePath}/passports/${passport.id}`}
                        className="block"
                      >
                        <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight group-hover:text-nexpura-bronze transition-colors duration-300">
                          {passport.title}
                        </h3>
                      </Link>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mt-3 text-sm text-stone-500">
                        {passport.jewellery_type && (
                          <span className="capitalize">
                            {passport.jewellery_type.replace(/_/g, " ")}
                          </span>
                        )}
                        {passport.current_owner_name && (
                          <span>
                            Owner{" "}
                            <span className="text-stone-700">
                              {passport.current_owner_name}
                            </span>
                          </span>
                        )}
                        <span>
                          Created{" "}
                          <span className="text-stone-700">
                            {new Date(passport.created_at).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </span>
                        {passport.verified_at && (
                          <span>
                            Verified{" "}
                            <span className="text-stone-700">
                              {new Date(passport.verified_at).toLocaleDateString("en-AU", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="flex items-center gap-4">
                        {passport.is_public && (
                          <button
                            onClick={() => copyVerifyLink(passport.passport_uid)}
                            className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-nexpura-bronze transition-colors duration-200"
                          >
                            <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                            {copiedId === passport.passport_uid ? "Copied" : "Copy link"}
                          </button>
                        )}
                        {!readOnly && (
                          <Link
                            href={`${basePath}/passports/${passport.id}/edit`}
                            className="text-xs text-stone-400 hover:text-stone-700 transition-colors duration-200"
                          >
                            Edit
                          </Link>
                        )}
                      </div>
                      <Link
                        href={`${basePath}/passports/${passport.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300"
                      >
                        View
                        <ArrowRightIcon className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
