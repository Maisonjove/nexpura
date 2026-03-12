"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteSupplier } from "../actions";
import SupplierForm from "../SupplierForm";

interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  supplier: Supplier;
}

export default function SupplierDetailClient({ supplier }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      await deleteSupplier(supplier.id);
    });
  }

  if (editing) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing(false)}
            className="text-forest/40 hover:text-forest transition-colors text-sm"
          >
            ← Cancel
          </button>
          <h1 className="font-fraunces text-2xl font-semibold text-forest">Edit Supplier</h1>
        </div>
        <SupplierForm mode="edit" supplier={supplier} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1">
            <Link href="/suppliers" className="text-forest/40 hover:text-forest transition-colors text-sm">
              ← Suppliers
            </Link>
          </div>
          <h1 className="font-fraunces text-2xl font-semibold text-forest">{supplier.name}</h1>
          {supplier.contact_name && (
            <p className="text-forest/60 mt-1">{supplier.contact_name}</p>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-platinum text-forest rounded-lg hover:bg-ivory transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact info */}
        <div className="bg-white border border-platinum rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="font-fraunces text-base font-semibold text-forest">Contact Information</h2>
          <div className="space-y-3">
            {supplier.email && (
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-forest/40 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href={`mailto:${supplier.email}`} className="text-sm text-sage hover:underline">
                  {supplier.email}
                </a>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-forest/40 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href={`tel:${supplier.phone}`} className="text-sm text-forest hover:text-sage transition-colors">
                  {supplier.phone}
                </a>
              </div>
            )}
            {supplier.website && (
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-forest/40 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                </svg>
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-sage hover:underline truncate"
                >
                  {supplier.website}
                </a>
              </div>
            )}
            {!supplier.email && !supplier.phone && !supplier.website && (
              <p className="text-sm text-forest/40">No contact details recorded</p>
            )}
          </div>
        </div>

        {/* Address */}
        {supplier.address && (
          <div className="bg-white border border-platinum rounded-xl p-5 shadow-sm space-y-2">
            <h2 className="font-fraunces text-base font-semibold text-forest">Address</h2>
            <p className="text-sm text-forest/70 whitespace-pre-wrap">{supplier.address}</p>
          </div>
        )}

        {/* Notes */}
        {supplier.notes && (
          <div className="bg-white border border-platinum rounded-xl p-5 shadow-sm space-y-2 lg:col-span-2">
            <h2 className="font-fraunces text-base font-semibold text-forest">Notes</h2>
            <p className="text-sm text-forest/70 whitespace-pre-wrap">{supplier.notes}</p>
          </div>
        )}
      </div>

      {/* Delete */}
      <div className="bg-white border border-platinum rounded-xl p-5 shadow-sm">
        {showDelete ? (
          <div className="space-y-3">
            <p className="text-sm text-forest/60">
              Delete <strong>{supplier.name}</strong> permanently? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isPending ? "Deleting…" : "Confirm Delete"}
              </button>
              <button
                onClick={() => setShowDelete(false)}
                className="bg-white border border-platinum text-forest text-sm font-medium px-4 py-2 rounded-lg hover:bg-ivory transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDelete(true)}
            className="text-sm text-forest/40 hover:text-red-500 transition-colors"
          >
            Delete supplier…
          </button>
        )}
      </div>
    </div>
  );
}
