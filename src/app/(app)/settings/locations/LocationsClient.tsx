"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addLocation, toggleLocationActive } from "./actions";

interface Location {
  id: string;
  name: string;
  type: string;
  address_line1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  is_active: boolean;
}

interface Props {
  tenantId: string;
  initialLocations: Location[];
  planName?: string;
  maxLocations?: number | null;
  isAtLimit?: boolean;
}

export default function LocationsClient({ tenantId, initialLocations, planName, maxLocations, isAtLimit }: Props) {
  const [locations, setLocations] = useState(initialLocations);
  const [showNew, setShowNew] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    type: "showroom",
    address_line1: "",
    suburb: "",
    state: "",
    postcode: "",
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    
    startTransition(async () => {
      const result = await addLocation(form);
      
      if (result.error) {
        setError(result.error);
        return;
      }
      
      if (result.data) {
        setLocations([...locations, result.data]);
        setShowNew(false);
        setForm({ name: "", type: "showroom", address_line1: "", suburb: "", state: "", postcode: "" });
        router.refresh();
      }
    });
  }

  async function handleToggleActive(id: string, current: boolean) {
    startTransition(async () => {
      const result = await toggleLocationActive(id, current);
      
      if (!result.error) {
        setLocations(locations.map(l => l.id === id ? { ...l, is_active: !current } : l));
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-stone-400 hover:text-stone-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-semibold text-stone-900">Locations</h1>
          {isAtLimit && (
            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full uppercase tracking-tight">
              Plan Limit Reached ({maxLocations} stores)
            </span>
          )}
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          disabled={isAtLimit && !showNew}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            isAtLimit && !showNew
              ? "bg-stone-100 text-stone-400 cursor-not-allowed" 
              : "bg-amber-700 text-white hover:bg-amber-800"
          }`}
        >
          {showNew ? "Cancel" : "+ Add Location"}
        </button>
      </div>

      {isAtLimit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🏪</span>
            <div>
              <p className="text-sm font-semibold text-amber-900">Need more store locations?</p>
              <p className="text-xs text-amber-700">You&apos;ve reached the {planName} limit of {maxLocations} stores. Upgrade your plan to add more locations.</p>
            </div>
          </div>
          <Link 
            href="/billing"
            className="px-4 py-2 bg-amber-700 text-white text-xs font-bold rounded-lg hover:bg-amber-800 transition-all shadow-sm shadow-amber-900/10 whitespace-nowrap"
          >
            View Plans →
          </Link>
        </div>
      )}

      {showNew && !isAtLimit && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <form onSubmit={handleAdd} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase mb-1">Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-1 focus:ring-amber-600 outline-none"
                  placeholder="Main Showroom"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-1 focus:ring-amber-600 outline-none bg-white"
                >
                  <option value="showroom">Showroom</option>
                  <option value="workshop">Workshop</option>
                  <option value="warehouse">Warehouse</option>
                  <option value="office">Office</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase mb-1">Address</label>
              <input
                value={form.address_line1}
                onChange={e => setForm({ ...form, address_line1: e.target.value })}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-1 focus:ring-amber-600 outline-none"
                placeholder="123 Jewellery St"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <input
                placeholder="Suburb"
                value={form.suburb}
                onChange={e => setForm({ ...form, suburb: e.target.value })}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:ring-1 focus:ring-amber-600 outline-none"
              />
              <input
                placeholder="State"
                value={form.state}
                onChange={e => setForm({ ...form, state: e.target.value })}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:ring-1 focus:ring-amber-600 outline-none"
              />
              <input
                placeholder="Postcode"
                value={form.postcode}
                onChange={e => setForm({ ...form, postcode: e.target.value })}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:ring-1 focus:ring-amber-600 outline-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowNew(false); setError(null); }}
                className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 hover:bg-amber-800 transition-colors"
              >
                {isPending ? "Saving..." : "Save Location"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase">Name</th>
              <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase">Type</th>
              <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase">Address</th>
              <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase">Status</th>
              <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {locations.map(l => (
              <tr key={l.id} className="hover:bg-stone-50/50 transition-colors">
                <td className="px-6 py-4 font-medium text-stone-900">{l.name}</td>
                <td className="px-6 py-4 capitalize text-stone-600">{l.type}</td>
                <td className="px-6 py-4 text-stone-600 text-sm">
                  {[l.address_line1, l.suburb, l.state].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    l.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {l.is_active ? "Active" : "Archived"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleToggleActive(l.id, l.is_active)}
                    disabled={isPending}
                    className="text-stone-400 hover:text-stone-900 text-sm font-medium disabled:opacity-50"
                  >
                    {l.is_active ? "Archive" : "Restore"}
                  </button>
                </td>
              </tr>
            ))}
            {locations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-stone-400">
                  No locations added yet. Click &quot;+ Add Location&quot; to create your first store.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
