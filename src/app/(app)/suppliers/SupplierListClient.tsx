"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PlusIcon,
  BuildingStorefrontIcon,
  EnvelopeIcon,
  PhoneIcon,
  GlobeAltIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  created_at: string;
}

interface Props {
  suppliers: Supplier[];
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "with_contact", label: "With contact" },
  { value: "with_email", label: "With email" },
  { value: "with_phone", label: "With phone" },
] as const;

export default function SupplierListClient({ suppliers }: Props) {
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const visible = useMemo(() => {
    switch (activeFilter) {
      case "with_contact":
        return suppliers.filter((s) => Boolean(s.contact_name));
      case "with_email":
        return suppliers.filter((s) => Boolean(s.email));
      case "with_phone":
        return suppliers.filter((s) => Boolean(s.phone));
      default:
        return suppliers;
    }
  }, [suppliers, activeFilter]);

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Inventory
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
              Suppliers
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              Manage your vendor relationships and keep contact details close at hand.
            </p>
          </div>
          <Link
            href="/suppliers/new"
            className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            Add Supplier
          </Link>
        </div>

        {/* Filter pills */}
        {suppliers.length > 0 && (
          <div className="flex items-center gap-2 mb-8 overflow-x-auto">
            {FILTERS.map((filter) => {
              const isActive = activeFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  onClick={() => setActiveFilter(filter.value)}
                  className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all duration-300 ${
                    isActive
                      ? "bg-stone-900 text-white"
                      : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Suppliers list */}
        {suppliers.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <BuildingStorefrontIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              No suppliers yet
            </h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
              Add your first supplier to manage vendor relationships and track contact details.
            </p>
            <Link
              href="/suppliers/new"
              className="nx-btn-primary inline-flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Add first supplier
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <BuildingStorefrontIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              No suppliers match this filter
            </h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
              Try a different filter to see other suppliers in your list.
            </p>
            <button
              onClick={() => setActiveFilter("all")}
              className="nx-btn-primary inline-flex items-center gap-2"
            >
              View all suppliers
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((supplier) => {
              const addedDate = supplier.created_at
                ? new Date(supplier.created_at).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : null;

              return (
                <Link
                  key={supplier.id}
                  href={`/suppliers/${supplier.id}`}
                  className="group block bg-white border border-stone-200 rounded-2xl p-6 sm:p-7 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 hover:-translate-y-0.5 transition-all duration-400"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
                        {supplier.name}
                      </h3>
                      {supplier.contact_name && (
                        <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
                          {supplier.contact_name}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm text-stone-500">
                        {supplier.email && (
                          <span className="inline-flex items-center gap-1.5">
                            <EnvelopeIcon className="w-3.5 h-3.5 text-stone-400" />
                            <span className="text-stone-700">{supplier.email}</span>
                          </span>
                        )}
                        {supplier.phone && (
                          <span className="inline-flex items-center gap-1.5 tabular-nums">
                            <PhoneIcon className="w-3.5 h-3.5 text-stone-400" />
                            <span className="text-stone-700">{supplier.phone}</span>
                          </span>
                        )}
                        {supplier.website && (
                          <span className="inline-flex items-center gap-1.5">
                            <GlobeAltIcon className="w-3.5 h-3.5 text-stone-400" />
                            <span className="text-stone-700">{supplier.website}</span>
                          </span>
                        )}
                        {!supplier.email && !supplier.phone && !supplier.website && (
                          <span className="text-stone-400 italic">No contact details on file</span>
                        )}
                      </div>

                      {addedDate && (
                        <p className="text-xs text-stone-500 mt-4">
                          Added{" "}
                          <span className="text-stone-700 tabular-nums">{addedDate}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 group-hover:text-nexpura-bronze transition-all duration-300">
                        View
                        <ArrowRightIcon className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
