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
        <h1 className="text-2xl font-semibold text-stone-900">Suppliers</h1>
        <Link
          href="/suppliers/new"
          className="inline-flex items-center gap-2 bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Supplier
        </Link>
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-stone-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-stone-900">No suppliers yet</h3>
          <p className="text-stone-500 mt-1 text-sm">Add your first supplier to manage your vendor relationships.</p>
          <Link
            href="/suppliers/new"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 transition-colors"
          >
            Add first supplier
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Contact</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest hidden md:table-cell">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest hidden lg:table-cell">Phone</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-stone-50/50 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-amber-700">
                          {supplier.name[0].toUpperCase()}
                        </span>
                      </div>
                      <Link
                        href={`/suppliers/${supplier.id}`}
                        className="font-medium text-stone-900 group-hover:text-amber-700 transition-colors"
                      >
                        {supplier.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-stone-500">
                    {supplier.contact_name || <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-stone-500 hidden md:table-cell">
                    {supplier.email ? (
                      <a href={`mailto:${supplier.email}`} className="hover:text-amber-700 transition-colors">
                        {supplier.email}
                      </a>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-stone-500 hidden lg:table-cell">
                    {supplier.phone || <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/suppliers/${supplier.id}`}
                      className="text-xs font-medium text-stone-400 hover:text-amber-700 transition-colors"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
