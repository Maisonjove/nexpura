"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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

export default function LocationsClient({ tenantId, initialLocations }: { tenantId: string, initialLocations: Location[] }) {
  const [locations, setLocations] = useState(initialLocations);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

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
    setLoading(true);
    const { data, error } = await supabase
      .from("locations")
      .insert([{ ...form, tenant_id: tenantId }])
      .select()
      .single();

    if (!error && data) {
      setLocations([...locations, data]);
      setShowNew(false);
      setForm({ name: "", type: "showroom", address_line1: "", suburb: "", state: "", postcode: "" });
    }
    setLoading(false);
  }

  async function toggleActive(id: string, current: boolean) {
    const { error } = await supabase
      .from("locations")
      .update({ is_active: !current })
      .eq("id", id);
    
    if (!error) {
      setLocations(locations.map(l => l.id === id ? { ...l, is_active: !current } : l));
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Locations</h1>
          <p className="text-sm text-stone-500 mt-0.5">Manage your showrooms, workshops, and warehouses</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347]"
        >
          + Add Location
        </button>
      </div>

      {showNew && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase mb-1">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-1 focus:ring-[#8B7355] outline-none"
                  placeholder="Main Showroom"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-1 focus:ring-[#8B7355] outline-none bg-white"
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
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-1 focus:ring-[#8B7355] outline-none"
                placeholder="123 Jewellery St"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <input
                placeholder="Suburb"
                value={form.suburb}
                onChange={e => setForm({ ...form, suburb: e.target.value })}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:ring-1 focus:ring-[#8B7355] outline-none"
              />
              <input
                placeholder="State"
                value={form.state}
                onChange={e => setForm({ ...form, state: e.target.value })}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:ring-1 focus:ring-[#8B7355] outline-none"
              />
              <input
                placeholder="Postcode"
                value={form.postcode}
                onChange={e => setForm({ ...form, postcode: e.target.value })}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:ring-1 focus:ring-[#8B7355] outline-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Location"}
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
                  {l.address_line1}, {l.suburb} {l.state}
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
                    onClick={() => toggleActive(l.id, l.is_active)}
                    className="text-stone-400 hover:text-stone-900 text-sm font-medium"
                  >
                    {l.is_active ? "Archive" : "Restore"}
                  </button>
                </td>
              </tr>
            ))}
            {locations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-stone-400">
                  No locations added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
