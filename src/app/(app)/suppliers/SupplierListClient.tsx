"use client";

import Link from "next/link";

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

export default function SupplierListClient({ suppliers }: Props) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-fraunces text-2xl font-semibold text-forest">Suppliers</h1>
        <Link
          href="/suppliers/new"
          className="inline-flex items-center gap-2 bg-sage text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-sage/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Supplier
        </Link>
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-white border border-platinum rounded-xl p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sage/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="font-fraunces text-lg font-semibold text-forest">No suppliers yet</h3>
          <p className="text-forest/50 mt-1 text-sm">Add your first supplier to manage your vendor relationships.</p>
          <Link
            href="/suppliers/new"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors"
          >
            Add first supplier
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((supplier) => (
            <Link
              key={supplier.id}
              href={`/suppliers/${supplier.id}`}
              className="bg-white border border-platinum rounded-xl p-5 hover:border-sage/40 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-fraunces text-sm font-semibold text-sage">
                    {supplier.name[0].toUpperCase()}
                  </span>
                </div>
                <svg className="w-4 h-4 text-forest/20 group-hover:text-sage transition-colors mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <h3 className="font-medium text-forest group-hover:text-sage transition-colors">
                {supplier.name}
              </h3>
              {supplier.contact_name && (
                <p className="text-sm text-forest/50 mt-0.5">{supplier.contact_name}</p>
              )}
              <div className="mt-3 space-y-1">
                {supplier.email && (
                  <p className="text-xs text-forest/40 truncate">{supplier.email}</p>
                )}
                {supplier.phone && (
                  <p className="text-xs text-forest/40">{supplier.phone}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
