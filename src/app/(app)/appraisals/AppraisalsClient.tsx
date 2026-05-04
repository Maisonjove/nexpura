"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PlusIcon,
  XMarkIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { createAppraisal } from "./actions";
import type { Appraisal } from "./actions";

const STATUS_BADGE: Record<string, string> = {
  draft: "nx-badge-neutral",
  in_progress: "nx-badge-warning",
  completed: "nx-badge-warning",
  issued: "nx-badge-success",
  expired: "nx-badge-danger",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  completed: "Completed",
  issued: "Issued",
  expired: "Expired",
};

const TYPE_LABELS: Record<string, string> = {
  insurance: "Insurance",
  estate: "Estate",
  retail: "Retail",
  wholesale: "Wholesale",
  damage: "Damage",
  other: "Other",
};

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

interface Props {
  appraisals: Appraisal[];
  customers: Customer[];
  tenantId: string;
}

export default function AppraisalsClient({ appraisals, customers, tenantId }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filtered = appraisals.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (typeFilter !== "all" && a.appraisal_type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !a.customer_name.toLowerCase().includes(s) &&
        !a.item_name.toLowerCase().includes(s) &&
        !(a.appraisal_number ?? "").toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  const totalValue = appraisals
    .filter((a) => a.status === "issued" && a.appraised_value)
    .reduce((sum, a) => sum + (a.appraised_value ?? 0), 0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createAppraisal(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setShowForm(false);
      setError(null);
      router.push(`/appraisals/${result.id}`);
    });
  }

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Workshop
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-stone-900 leading-[1.05] tracking-tight">
              Appraisals & Valuations
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              Professional valuations for insurance, estate, and retail purposes.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            New Appraisal
          </button>
        </div>

        {/* KPIs — horizontal stat strip over ivory with hairline dividers,
            mirroring InvoiceListClient. Bare typography, no boxed cards. */}
        <div className="mb-14 grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6 lg:divide-x lg:divide-stone-200">
          <div className="lg:px-8 lg:first:pl-0">
            <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
              Total
            </p>
            <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
              {appraisals.length}
            </p>
          </div>
          <div className="lg:px-8">
            <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
              Draft / In Progress
            </p>
            <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
              {
                appraisals.filter(
                  (a) => a.status === "draft" || a.status === "in_progress"
                ).length
              }
            </p>
          </div>
          <div className="lg:px-8">
            <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
              Issued
            </p>
            <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
              {appraisals.filter((a) => a.status === "issued").length}
            </p>
          </div>
          <div className="lg:px-8 lg:last:pr-0">
            <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
              Total Value Appraised
            </p>
            <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
              ${totalValue.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <div className="relative flex-1 min-w-[240px]">
            <MagnifyingGlassIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search appraisals..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="issued">Issued</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
          >
            <option value="all">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <SparklesIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              {appraisals.length === 0
                ? "No appraisals yet"
                : "No appraisals match these filters"}
            </h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
              {appraisals.length === 0
                ? "Create professional valuations for insurance, estate, or retail purposes."
                : "Try adjusting your search or filters to find what you're looking for."}
            </p>
            {appraisals.length === 0 ? (
              <button
                onClick={() => setShowForm(true)}
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                New Appraisal
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setTypeFilter("all");
                }}
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((a) => {
              const statusClass =
                STATUS_BADGE[a.status] ?? "nx-badge-neutral";
              const statusLabel =
                STATUS_LABEL[a.status] ??
                a.status.replace("_", " ");

              return (
                <Link
                  key={a.id}
                  href={`/appraisals/${a.id}`}
                  className="group block bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2.5">
                        {a.appraisal_number && (
                          <span className="font-mono text-xs text-stone-400 tabular-nums">
                            {a.appraisal_number}
                          </span>
                        )}
                        <span className={statusClass}>{statusLabel}</span>
                        <span className="text-[0.6875rem] font-semibold text-stone-500 uppercase tracking-luxury">
                          {TYPE_LABELS[a.appraisal_type] ?? a.appraisal_type}
                        </span>
                      </div>
                      <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
                        {a.customer_name}
                      </h3>
                      <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
                        {a.item_name}
                      </p>
                      {(a.metal || a.stone) && (
                        <p className="text-xs text-stone-400 mt-1.5">
                          {a.metal}
                          {a.metal && a.stone ? " · " : ""}
                          {a.stone}
                        </p>
                      )}
                      <div className="flex items-center gap-5 mt-4 text-xs text-stone-500 flex-wrap">
                        <span>
                          {new Date(a.appraisal_date).toLocaleDateString(
                            "en-AU",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </span>
                        {a.valid_until && (
                          <span>
                            Valid until{" "}
                            <span className="text-stone-700">
                              {new Date(a.valid_until).toLocaleDateString(
                                "en-AU",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      {a.appraised_value != null && (
                        <div className="text-right">
                          <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">
                            Value
                          </p>
                          <p className="font-serif text-2xl text-stone-900 leading-none tracking-tight tabular-nums">
                            ${a.appraised_value.toLocaleString()}
                          </p>
                        </div>
                      )}
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300">
                        View
                        <ArrowRightIcon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* New Appraisal Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto py-8">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.12)] w-full max-w-2xl my-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
              <h2 className="font-serif text-2xl text-stone-900">
                New Appraisal
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-stone-400 hover:text-stone-700 transition-colors duration-200"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Client section */}
                <div className="col-span-2">
                  <h3 className="text-[0.6875rem] font-semibold text-stone-500 uppercase tracking-luxury mb-3">
                    Client Details
                  </h3>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Customer
                  </label>
                  <select
                    name="customer_id"
                    onChange={(e) => {
                      const c = customers.find(
                        (c) => c.id === e.target.value
                      );
                      setSelectedCustomer(c ?? null);
                    }}
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  >
                    <option value="">Select or enter manually...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="customer_name"
                    required
                    defaultValue={
                      selectedCustomer
                        ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
                        : ""
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Email
                  </label>
                  <input
                    name="customer_email"
                    type="email"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Phone
                  </label>
                  <input
                    name="customer_phone"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>

                {/* Item section */}
                <div className="col-span-2 mt-2">
                  <h3 className="text-[0.6875rem] font-semibold text-stone-500 uppercase tracking-luxury mb-3">
                    Item Details
                  </h3>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Item Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="item_name"
                    required
                    placeholder="e.g. 18ct Yellow Gold Diamond Solitaire Ring"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Metal
                  </label>
                  <input
                    name="metal"
                    placeholder="18ct Yellow Gold..."
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Purity / Hallmark
                  </label>
                  <input
                    name="metal_purity"
                    placeholder="750, 925, 999..."
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Stone
                  </label>
                  <input
                    name="stone"
                    placeholder="Diamond, Ruby..."
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Stone Carat
                  </label>
                  <input
                    name="stone_carat"
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Condition
                  </label>
                  <select
                    name="condition"
                    defaultValue="good"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  >
                    <option value="excellent">Excellent</option>
                    <option value="very_good">Very Good</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Hallmarks
                  </label>
                  <input
                    name="hallmarks"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>

                {/* Appraisal section */}
                <div className="col-span-2 mt-2">
                  <h3 className="text-[0.6875rem] font-semibold text-stone-500 uppercase tracking-luxury mb-3">
                    Appraisal
                  </h3>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Type
                  </label>
                  <select
                    name="appraisal_type"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  >
                    <option value="insurance">Insurance</option>
                    <option value="estate">Estate</option>
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                    <option value="damage">Damage Assessment</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Appraisal Date
                  </label>
                  <input
                    name="appraisal_date"
                    type="date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Appraised Value (AUD)
                  </label>
                  <input
                    name="appraised_value"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Replacement Value (AUD)
                  </label>
                  <input
                    name="replacement_value"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Appraiser Name
                  </label>
                  <input
                    name="appraiser_name"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Licence / Qualifications
                  </label>
                  <input
                    name="appraiser_licence"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Fee (AUD)
                  </label>
                  <input
                    name="fee"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Valid Until
                  </label>
                  <input
                    name="valid_until"
                    type="date"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 resize-none"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-500 mt-4">{error}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-5 mt-5 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="nx-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? "Creating..." : "Create Appraisal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
