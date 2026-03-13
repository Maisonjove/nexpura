"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateEnquiryStatus } from "./actions";

interface Enquiry {
  id: string;
  enquiry_type: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  appointment_type: string | null;
  item_description: string | null;
  issue_description: string | null;
  status: string;
  created_at: string;
}

interface Props {
  enquiries: Enquiry[];
  tenantId: string;
}

const TYPE_COLOURS: Record<string, string> = {
  general: "bg-blue-50 text-blue-700",
  repair: "bg-amber-50 text-amber-700",
  appointment: "bg-purple-50 text-purple-700",
};

const STATUS_COLOURS: Record<string, string> = {
  new: "bg-green-50 text-green-700",
  contacted: "bg-blue-50 text-blue-600",
  booked: "bg-purple-50 text-purple-700",
  completed: "bg-stone-100 text-stone-500",
};

export default function EnquiriesClient({ enquiries, tenantId: _tenantId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("new");
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);

  const filtered = enquiries.filter((e) => {
    if (typeFilter && e.enquiry_type !== typeFilter) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    return true;
  });

  const newCount = enquiries.filter((e) => e.status === "new").length;

  function handleStatusChange(enquiryId: string, newStatus: string) {
    startTransition(async () => {
      await updateEnquiryStatus(enquiryId, newStatus);
      router.refresh();
      if (selectedEnquiry?.id === enquiryId) {
        setSelectedEnquiry((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Enquiries</h1>
          <p className="text-stone-500 mt-1 text-sm">
            {newCount > 0 && <span className="text-green-600 font-medium">{newCount} new · </span>}
            Shop enquiries and appointment requests
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-stone-600 focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="general">General</option>
          <option value="repair">Repair</option>
          <option value="appointment">Appointment</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-stone-600 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="booked">Booked</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-stone-400 text-sm">No enquiries found</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filtered.map((enquiry) => (
              <div
                key={enquiry.id}
                className="px-5 py-4 flex items-start gap-4 cursor-pointer hover:bg-stone-50 transition-colors"
                onClick={() => setSelectedEnquiry(enquiry)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_COLOURS[enquiry.enquiry_type] || "bg-stone-100 text-stone-600"}`}>
                      {enquiry.enquiry_type}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[enquiry.status] || "bg-stone-100 text-stone-600"}`}>
                      {enquiry.status}
                    </span>
                    <span className="text-xs text-stone-400">
                      {new Date(enquiry.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <p className="font-medium text-stone-900 text-sm">{enquiry.name}</p>
                  <p className="text-xs text-stone-500">{enquiry.email} {enquiry.phone ? `· ${enquiry.phone}` : ""}</p>
                  {(enquiry.item_description || enquiry.appointment_type || enquiry.message) && (
                    <p className="text-xs text-stone-400 mt-1 truncate">
                      {enquiry.item_description || enquiry.appointment_type || enquiry.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {enquiry.status === "new" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(enquiry.id, "contacted"); }}
                      disabled={isPending}
                      className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded transition-colors"
                    >
                      Mark Contacted
                    </button>
                  )}
                  {enquiry.status !== "completed" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(enquiry.id, "completed"); }}
                      disabled={isPending}
                      className="text-xs text-stone-400 hover:text-green-600 px-2 py-1 rounded transition-colors"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEnquiry && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-semibold text-stone-900">Enquiry Details</h3>
              <button onClick={() => setSelectedEnquiry(null)} className="text-stone-400 hover:text-stone-900">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${TYPE_COLOURS[selectedEnquiry.enquiry_type] || ""}`}>
                  {selectedEnquiry.enquiry_type}
                </span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLOURS[selectedEnquiry.status] || ""}`}>
                  {selectedEnquiry.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-stone-500 mb-0.5">Name</p>
                  <p className="font-medium text-stone-900">{selectedEnquiry.name}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500 mb-0.5">Email</p>
                  <a href={`mailto:${selectedEnquiry.email}`} className="text-[#8B7355] hover:underline">{selectedEnquiry.email}</a>
                </div>
                {selectedEnquiry.phone && (
                  <div>
                    <p className="text-xs text-stone-500 mb-0.5">Phone</p>
                    <p className="font-medium text-stone-900">{selectedEnquiry.phone}</p>
                  </div>
                )}
                {selectedEnquiry.appointment_type && (
                  <div>
                    <p className="text-xs text-stone-500 mb-0.5">Appointment Type</p>
                    <p className="font-medium text-stone-900">{selectedEnquiry.appointment_type}</p>
                  </div>
                )}
                {selectedEnquiry.preferred_date && (
                  <div>
                    <p className="text-xs text-stone-500 mb-0.5">Preferred Date</p>
                    <p className="font-medium text-stone-900">{selectedEnquiry.preferred_date}</p>
                  </div>
                )}
                {selectedEnquiry.preferred_time && (
                  <div>
                    <p className="text-xs text-stone-500 mb-0.5">Preferred Time</p>
                    <p className="font-medium text-stone-900">{selectedEnquiry.preferred_time}</p>
                  </div>
                )}
              </div>

              {selectedEnquiry.item_description && (
                <div>
                  <p className="text-xs text-stone-500 mb-1">Item Description</p>
                  <p className="text-sm text-stone-900 bg-stone-50 rounded-lg p-3">{selectedEnquiry.item_description}</p>
                </div>
              )}
              {selectedEnquiry.issue_description && (
                <div>
                  <p className="text-xs text-stone-500 mb-1">Issue Description</p>
                  <p className="text-sm text-stone-900 bg-stone-50 rounded-lg p-3">{selectedEnquiry.issue_description}</p>
                </div>
              )}
              {selectedEnquiry.message && (
                <div>
                  <p className="text-xs text-stone-500 mb-1">Notes / Message</p>
                  <p className="text-sm text-stone-900 bg-stone-50 rounded-lg p-3">{selectedEnquiry.message}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-stone-500 mb-2">Update Status</p>
                <div className="flex gap-2 flex-wrap">
                  {["new", "contacted", "booked", "completed"].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(selectedEnquiry.id, s)}
                      disabled={isPending || selectedEnquiry.status === s}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                        selectedEnquiry.status === s
                          ? "bg-[#8B7355] text-white"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-50"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
