"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAppraisal, issueAppraisal } from "./actions";
import type { Appraisal } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600",
  in_progress: "bg-blue-50 text-blue-700",
  completed: "bg-amber-50 text-amber-700",
  issued: "bg-green-50 text-green-700",
};

const TYPE_LABELS: Record<string, string> = {
  insurance: "Insurance",
  estate: "Estate",
  retail: "Retail",
  wholesale: "Wholesale",
  damage: "Damage",
  other: "Other",
};

interface Customer { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; }

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
      if (!a.customer_name.toLowerCase().includes(s) && !a.item_name.toLowerCase().includes(s) && !(a.appraisal_number ?? "").toLowerCase().includes(s)) return false;
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
      if (result.error) { setError(result.error); return; }
      setShowForm(false);
      setError(null);
      router.push(`/appraisals/${result.id}`);
    });
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Appraisals & Valuations</h1>
          <p className="text-sm text-stone-500 mt-0.5">Professional valuations for insurance, estate, and retail purposes</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-[#8B7355] text-white rounded-lg text-sm font-medium hover:bg-[#7A6347]"
        >
          + New Appraisal
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: appraisals.length, icon: "📋" },
          { label: "Draft / In Progress", value: appraisals.filter((a) => a.status === "draft" || a.status === "in_progress").length, icon: "✏️" },
          { label: "Issued", value: appraisals.filter((a) => a.status === "issued").length, icon: "✓" },
          { label: "Total Value Appraised", value: `$${totalValue.toLocaleString()}`, icon: "💎" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="text-xl mb-1">{k.icon}</div>
            <div className="text-lg font-bold text-stone-900">{k.value}</div>
            <div className="text-xs text-stone-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search appraisals…"
          className="flex-1 min-w-48 px-3 py-2 border border-stone-200 rounded-lg text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-stone-200 rounded-lg text-sm"
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
          className="px-3 py-2 border border-stone-200 rounded-lg text-sm"
        >
          <option value="all">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-4xl mb-3">💎</div>
          <p className="text-stone-600 font-medium">No appraisals yet</p>
          <p className="text-sm mt-1">Create professional valuations for insurance, estate, or retail purposes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Link
              key={a.id}
              href={`/appraisals/${a.id}`}
              className="block bg-white rounded-xl border border-stone-200 hover:border-[#8B7355]/40 hover:shadow-sm transition-all p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-stone-900">{a.item_name}</span>
                    {a.appraisal_number && <span className="text-xs text-stone-400 font-mono">{a.appraisal_number}</span>}
                    <span className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">{TYPE_LABELS[a.appraisal_type] ?? a.appraisal_type}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-stone-400 flex-wrap">
                    <span>👤 {a.customer_name}</span>
                    {a.appraised_value && <span className="font-medium text-stone-600">💰 ${a.appraised_value.toLocaleString()}</span>}
                    <span>{new Date(a.appraisal_date).toLocaleDateString("en-AU")}</span>
                    {a.valid_until && <span>Valid until {new Date(a.valid_until).toLocaleDateString("en-AU")}</span>}
                  </div>
                  {a.metal && <div className="text-xs text-stone-400 mt-0.5">{a.metal}{a.stone ? ` · ${a.stone}` : ""}</div>}
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[a.status] ?? "bg-stone-100 text-stone-600"}`}>
                  {a.status.replace("_", " ")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New Appraisal Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
              <h2 className="text-base font-semibold text-stone-900">New Appraisal</h2>
              <button onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-600">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Client section */}
                <div className="col-span-2">
                  <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Client Details</h3>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Customer</label>
                  <select
                    name="customer_id"
                    onChange={(e) => {
                      const c = customers.find((c) => c.id === e.target.value);
                      setSelectedCustomer(c ?? null);
                    }}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
                  >
                    <option value="">Select or enter manually…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Customer Name *</label>
                  <input
                    name="customer_name"
                    required
                    defaultValue={selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : ""}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Email</label>
                  <input name="customer_email" type="email" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Phone</label>
                  <input name="customer_phone" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
                </div>

                {/* Item section */}
                <div className="col-span-2 mt-2">
                  <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Item Details</h3>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-stone-600 block mb-1">Item Name *</label>
                  <input name="item_name" required className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" placeholder="e.g. 18ct Yellow Gold Diamond Solitaire Ring" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Metal</label>
                  <input name="metal" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" placeholder="18ct Yellow Gold…" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Purity / Hallmark</label>
                  <input name="metal_purity" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" placeholder="750, 925, 999…" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Stone</label>
                  <input name="stone" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" placeholder="Diamond, Ruby…" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Stone Carat</label>
                  <input name="stone_carat" type="number" step="0.01" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Condition</label>
                  <select name="condition" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm">
                    <option value="excellent">Excellent</option>
                    <option value="very_good">Very Good</option>
                    <option value="good" selected>Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Hallmarks</label>
                  <input name="hallmarks" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
                </div>

                {/* Appraisal section */}
                <div className="col-span-2 mt-2">
                  <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Appraisal</h3>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Type</label>
                  <select name="appraisal_type" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm">
                    <option value="insurance">Insurance</option>
                    <option value="estate">Estate</option>
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                    <option value="damage">Damage Assessment</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Appraisal Date</label>
                  <input name="appraisal_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Appraised Value (AUD)</label>
                  <input name="appraised_value" type="number" step="0.01" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Replacement Value (AUD)</label>
                  <input name="replacement_value" type="number" step="0.01" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Appraiser Name</label>
                  <input name="appraiser_name" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Licence / Qualifications</label>
                  <input name="appraiser_licence" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Fee (AUD)</label>
                  <input name="fee" type="number" step="0.01" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Valid Until</label>
                  <input name="valid_until" type="date" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-stone-600 block mb-1">Notes</label>
                  <textarea name="notes" rows={2} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm resize-none" />
                </div>
              </div>

              {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
              <div className="flex gap-2 mt-5">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-3 py-2 border border-stone-200 text-stone-600 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={isPending} className="flex-1 px-3 py-2 bg-[#8B7355] text-white rounded-lg text-sm font-medium disabled:opacity-60">
                  {isPending ? "Creating…" : "Create Appraisal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
