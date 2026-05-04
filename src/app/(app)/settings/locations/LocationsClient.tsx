"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  BuildingStorefrontIcon,
  MapPinIcon,
  EnvelopeIcon,
  PhoneIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { addLocation, toggleLocationActive, deleteLocation } from "./actions";

interface Location {
  id: string;
  name: string;
  type: string;
  address_line1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
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
    country: "",
    phone: "",
    email: "",
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
        setForm({
          name: "",
          type: "showroom",
          address_line1: "",
          suburb: "",
          state: "",
          postcode: "",
          country: "",
          phone: "",
          email: "",
        });
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

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.\n\nNote: You can only delete locations that have no linked sales, repairs, jobs, or inventory.`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteLocation(id);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.success) {
        setLocations(locations.filter(l => l.id !== id));
        router.refresh();
      }
    });
  }

  const activeCount = locations.filter(l => l.is_active).length;
  const archivedCount = locations.length - activeCount;

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-14">
          <div className="flex items-start gap-4">
            <Link
              href="/settings"
              className="mt-2 text-stone-400 hover:text-nexpura-bronze transition-colors duration-300"
              aria-label="Back to settings"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div>
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                Settings
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
                Locations
              </h1>
              <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
                Manage your stores, workshops, and warehouses across every site.
              </p>
              {locations.length > 0 && (
                <div className="flex items-center gap-5 mt-5 text-sm text-stone-500">
                  <span className="tabular-nums">
                    <span className="text-stone-900 font-medium">{activeCount}</span> active
                  </span>
                  {archivedCount > 0 && (
                    <span className="tabular-nums">
                      <span className="text-stone-900 font-medium">{archivedCount}</span> archived
                    </span>
                  )}
                  {maxLocations && (
                    <span className="tabular-nums text-stone-400">
                      {locations.length} of {maxLocations}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowNew(!showNew)}
            disabled={(isAtLimit && !showNew) || false}
            className="nx-btn-primary inline-flex items-center gap-2 shrink-0 self-start disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {showNew ? (
              <>
                <XMarkIcon className="w-4 h-4" />
                Cancel
              </>
            ) : (
              <>
                <PlusIcon className="w-4 h-4" />
                Add location
              </>
            )}
          </button>
        </div>

        {/* Plan limit notice */}
        {isAtLimit && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-7 mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="flex items-start gap-4">
              <ExclamationTriangleIcon className="w-5 h-5 text-stone-400 shrink-0 mt-1" />
              <div>
                <h3 className="font-serif text-lg text-stone-900 tracking-tight leading-tight">
                  Need more locations?
                </h3>
                <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
                  You&apos;ve reached the {planName} limit of {maxLocations} {maxLocations === 1 ? "location" : "locations"}. Upgrade your plan to add more sites.
                </p>
              </div>
            </div>
            <Link
              href="/billing"
              className="nx-btn-primary inline-flex items-center gap-2 shrink-0 self-start whitespace-nowrap"
            >
              View plans
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Add location form */}
        {showNew && !isAtLimit && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 mb-8">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                New site
              </p>
              <h2 className="font-serif text-2xl text-stone-900 tracking-tight leading-tight">
                Add a location
              </h2>
            </div>
            <form onSubmit={handleAdd} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Store name <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                    placeholder="Main Showroom"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Type
                  </label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  >
                    <option value="showroom">Showroom</option>
                    <option value="workshop">Workshop</option>
                    <option value="warehouse">Warehouse</option>
                    <option value="office">Office</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div className="pt-2">
                <p className="text-xs uppercase tracking-luxury text-stone-500 mb-4">
                  Address
                </p>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      Street address
                    </label>
                    <input
                      value={form.address_line1}
                      onChange={e => setForm({ ...form, address_line1: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                      placeholder="123 Jewellery Street"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">
                        City / Suburb
                      </label>
                      <input
                        placeholder="Sydney"
                        value={form.suburb}
                        onChange={e => setForm({ ...form, suburb: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">
                        State / Province
                      </label>
                      <input
                        placeholder="NSW"
                        value={form.state}
                        onChange={e => setForm({ ...form, state: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">
                        Postcode / ZIP
                      </label>
                      <input
                        placeholder="2000"
                        value={form.postcode}
                        onChange={e => setForm({ ...form, postcode: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">
                        Country
                      </label>
                      <input
                        placeholder="Australia"
                        value={form.country}
                        onChange={e => setForm({ ...form, country: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="pt-2">
                <p className="text-xs uppercase tracking-luxury text-stone-500 mb-4">
                  Contact
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      Phone
                    </label>
                    <input
                      placeholder="+61 2 9000 0000"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="store@example.com"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-5 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => { setShowNew(false); setError(null); }}
                  className="px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="nx-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? "Saving..." : "Save location"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Locations list */}
        {locations.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <BuildingStorefrontIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              No locations yet
            </h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
              Add your first store, workshop, or warehouse to start tracking inventory and activity by site.
            </p>
            {!isAtLimit && (
              <button
                onClick={() => setShowNew(true)}
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Add first location
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {locations.map(l => {
              const addressParts = [l.address_line1, l.suburb, l.state, l.postcode, l.country].filter(Boolean);
              const fullAddress = addressParts.join(", ");

              return (
                <div
                  key={l.id}
                  className={`group bg-white border rounded-2xl p-6 lg:p-8 transition-all duration-400 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 hover:-translate-y-0.5 ${
                    l.is_active ? "border-stone-200" : "border-stone-200/70 bg-stone-50/40"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
                          {l.name}
                        </h3>
                        {l.is_active ? (
                          <span className="nx-badge-success">Active</span>
                        ) : (
                          <span className="nx-badge-neutral">Archived</span>
                        )}
                        {l.type && (
                          <span className="text-xs uppercase tracking-luxury text-stone-400">
                            {l.type}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <MapPinIcon className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-1" />
                          {fullAddress ? (
                            <span className="text-stone-700 leading-relaxed">{fullAddress}</span>
                          ) : (
                            <span className="text-stone-400 italic">No address on file</span>
                          )}
                        </div>

                        {(l.phone || l.email) && (
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                            {l.phone && (
                              <span className="inline-flex items-center gap-2 tabular-nums">
                                <PhoneIcon className="w-3.5 h-3.5 text-stone-400" />
                                <span className="text-stone-700">{l.phone}</span>
                              </span>
                            )}
                            {l.email && (
                              <span className="inline-flex items-center gap-2">
                                <EnvelopeIcon className="w-3.5 h-3.5 text-stone-400" />
                                <span className="text-stone-700">{l.email}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <button
                        onClick={() => handleToggleActive(l.id, l.is_active)}
                        disabled={isPending}
                        className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors duration-200 disabled:opacity-50"
                      >
                        {l.is_active ? "Archive" : "Restore"}
                      </button>
                      {!l.is_active && (
                        <button
                          onClick={() => handleDelete(l.id, l.name)}
                          disabled={isPending}
                          className="text-sm font-medium text-stone-400 hover:text-red-500 transition-colors duration-200 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
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
