"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateAppraisal, issueAppraisal } from "../actions";
import type { Appraisal } from "../actions";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600",
  in_progress: "bg-blue-50 text-blue-700",
  completed: "bg-amber-50 text-amber-700",
  issued: "bg-green-50 text-green-700",
};

const TYPE_LABELS: Record<string, string> = {
  insurance: "Insurance Appraisal",
  estate: "Estate Valuation",
  retail: "Retail Appraisal",
  wholesale: "Wholesale Valuation",
  damage: "Damage Assessment",
  other: "Appraisal",
};

interface Tenant { name: string | null; email: string | null; phone: string | null; address: string | null; }

interface Props {
  appraisal: Appraisal;
  tenant: Tenant | null;
  userId: string;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-stone-100 last:border-0">
      <span className="text-sm text-stone-500 font-medium">{label}</span>
      <span className="text-sm text-stone-900 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export default function AppraisalDetailClient({ appraisal: initial, tenant, userId }: Props) {
  const router = useRouter();
  const [appraisal, setAppraisal] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editable fields
  const [notes, setNotes] = useState(appraisal.notes ?? "");
  const [methodology, setMethodology] = useState(appraisal.methodology ?? "");
  const [appraisedValue, setAppraisedValue] = useState(appraisal.appraised_value?.toString() ?? "");
  const [replacementValue, setReplacementValue] = useState(appraisal.replacement_value?.toString() ?? "");
  const [insuranceValue, setInsuranceValue] = useState(appraisal.insurance_value?.toString() ?? "");
  const [marketValue, setMarketValue] = useState(appraisal.market_value?.toString() ?? "");
  const [appraiserName, setAppraiserName] = useState(appraisal.appraiser_name ?? "");
  const [appraiserLicence, setAppraiserLicence] = useState(appraisal.appraiser_licence ?? "");
  const [appraiserQuals, setAppraiserQuals] = useState(appraisal.appraiser_qualifications ?? "");
  const [validUntil, setValidUntil] = useState(appraisal.valid_until ?? "");
  const [status, setStatus] = useState(appraisal.status);

  function showFeedback(msg: string, isError = false) {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => { setError(null); setSuccess(null); }, 3000);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateAppraisal(appraisal.id, {
        notes,
        methodology,
        appraised_value: appraisedValue ? parseFloat(appraisedValue) : null,
        replacement_value: replacementValue ? parseFloat(replacementValue) : null,
        insurance_value: insuranceValue ? parseFloat(insuranceValue) : null,
        market_value: marketValue ? parseFloat(marketValue) : null,
        appraiser_name: appraiserName || null,
        appraiser_licence: appraiserLicence || null,
        appraiser_qualifications: appraiserQuals || null,
        valid_until: validUntil || null,
        status: status as Appraisal["status"],
      });
      if (result.error) { showFeedback(result.error, true); return; }
      showFeedback("Saved successfully");
      setEditMode(false);
    });
  }

  function handleIssue() {
    if (!confirm("Issue this appraisal? It will be marked as officially issued.")) return;
    startTransition(async () => {
      const result = await issueAppraisal(appraisal.id);
      if (result.error) { showFeedback(result.error, true); return; }
      setStatus("issued");
      showFeedback("Appraisal issued");
    });
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <Link href="/appraisals" className="text-sm text-stone-400 hover:text-stone-600 mb-1 inline-block">
            ← Appraisals
          </Link>
          <h1 className="text-2xl font-semibold text-stone-900">{appraisal.item_name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {appraisal.appraisal_number && <span className="text-sm text-stone-400 font-mono">{appraisal.appraisal_number}</span>}
            <span className="text-sm text-stone-500">{TYPE_LABELS[appraisal.appraisal_type] ?? appraisal.appraisal_type}</span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[status] ?? "bg-stone-100 text-stone-600"}`}>
              {status.replace("_", " ")}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 border border-stone-200 text-stone-600 rounded-lg text-sm hover:bg-stone-50"
            >
              Edit
            </button>
          ) : (
            <>
              <button onClick={() => setEditMode(false)} className="px-3 py-2 border border-stone-200 text-stone-600 rounded-lg text-sm">Cancel</button>
              <button onClick={handleSave} disabled={isPending} className="px-4 py-2 bg-[#8B7355] text-white rounded-lg text-sm font-medium hover:bg-[#7A6347] disabled:opacity-60">
                {isPending ? "Saving…" : "Save"}
              </button>
            </>
          )}
          {status !== "issued" && (
            <button
              onClick={handleIssue}
              disabled={isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60"
            >
              ✓ Issue Appraisal
            </button>
          )}
        </div>
      </div>

      {(error || success) && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${error ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
          {error ?? success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-2 space-y-4">
          {/* Client */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">Client</h2>
            <InfoRow label="Name" value={appraisal.customer_name} />
            <InfoRow label="Email" value={appraisal.customer_email} />
            <InfoRow label="Phone" value={appraisal.customer_phone} />
            <InfoRow label="Address" value={appraisal.customer_address} />
          </div>

          {/* Item */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">Item Details</h2>
            <InfoRow label="Description" value={appraisal.item_description} />
            <InfoRow label="Metal" value={appraisal.metal} />
            <InfoRow label="Purity" value={appraisal.metal_purity} />
            <InfoRow label="Metal Weight" value={appraisal.metal_weight_grams ? `${appraisal.metal_weight_grams}g` : null} />
            <InfoRow label="Stone" value={appraisal.stone} />
            <InfoRow label="Stone Carat" value={appraisal.stone_carat ? `${appraisal.stone_carat}ct` : null} />
            <InfoRow label="Stone Colour" value={appraisal.stone_colour} />
            <InfoRow label="Stone Clarity" value={appraisal.stone_clarity} />
            <InfoRow label="Stone Cut" value={appraisal.stone_cut} />
            <InfoRow label="Certificate #" value={appraisal.stone_certificate_number} />
            <InfoRow label="Hallmarks" value={appraisal.hallmarks} />
            <InfoRow label="Maker's Marks" value={appraisal.maker_marks} />
            <InfoRow label="Condition" value={appraisal.condition} />
            <InfoRow label="Age / Period" value={appraisal.age_period} />
            <InfoRow label="Provenance" value={appraisal.provenance} />
          </div>

          {/* Methodology / Notes */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">Methodology & Notes</h2>
            {editMode ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-stone-500 block mb-1">Methodology</label>
                  <textarea
                    value={methodology}
                    onChange={(e) => setMethodology(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm resize-none"
                    placeholder="Methods used to arrive at value…"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 block mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm resize-none"
                  />
                </div>
              </div>
            ) : (
              <>
                {methodology && <div className="text-sm text-stone-700 mb-2 whitespace-pre-wrap">{methodology}</div>}
                {notes && <div className="text-sm text-stone-600 whitespace-pre-wrap">{notes}</div>}
                {!methodology && !notes && <p className="text-sm text-stone-400 italic">No notes or methodology recorded</p>}
              </>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Values */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">Valuations</h2>
            {editMode ? (
              <div className="space-y-2">
                {[
                  { label: "Appraised Value", val: appraisedValue, set: setAppraisedValue },
                  { label: "Replacement Value", val: replacementValue, set: setReplacementValue },
                  { label: "Insurance Value", val: insuranceValue, set: setInsuranceValue },
                  { label: "Market Value", val: marketValue, set: setMarketValue },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label className="text-xs text-stone-500 block mb-0.5">{label}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
                      placeholder="0.00"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: "Appraised", value: appraisal.appraised_value },
                  { label: "Replacement", value: appraisal.replacement_value },
                  { label: "Insurance", value: appraisal.insurance_value },
                  { label: "Market", value: appraisal.market_value },
                ].map(({ label, value }) => value ? (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-stone-100 last:border-0">
                    <span className="text-sm text-stone-500">{label}</span>
                    <span className="text-sm font-semibold text-stone-900">${value.toLocaleString()}</span>
                  </div>
                ) : null)}
              </div>
            )}
          </div>

          {/* Appraiser */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">Appraiser</h2>
            {editMode ? (
              <div className="space-y-2">
                <input value={appraiserName} onChange={(e) => setAppraiserName(e.target.value)} placeholder="Name" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
                <input value={appraiserQuals} onChange={(e) => setAppraiserQuals(e.target.value)} placeholder="Qualifications" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
                <input value={appraiserLicence} onChange={(e) => setAppraiserLicence(e.target.value)} placeholder="Licence #" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
              </div>
            ) : (
              <>
                {appraisal.appraiser_name && <p className="text-sm font-medium text-stone-900">{appraisal.appraiser_name}</p>}
                {appraisal.appraiser_qualifications && <p className="text-xs text-stone-500">{appraisal.appraiser_qualifications}</p>}
                {appraisal.appraiser_licence && <p className="text-xs text-stone-400">Lic: {appraisal.appraiser_licence}</p>}
                {!appraisal.appraiser_name && <p className="text-sm text-stone-400 italic">Not set</p>}
              </>
            )}
          </div>

          {/* Dates + Status */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">Status & Dates</h2>
            {editMode ? (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-stone-500 block mb-0.5">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm">
                    <option value="draft">Draft</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="issued">Issued</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-stone-500 block mb-0.5">Valid Until</label>
                  <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
                </div>
              </div>
            ) : (
              <>
                <InfoRow label="Date" value={new Date(appraisal.appraisal_date).toLocaleDateString("en-AU")} />
                <InfoRow label="Valid Until" value={appraisal.valid_until ? new Date(appraisal.valid_until).toLocaleDateString("en-AU") : null} />
                {appraisal.issued_at && <InfoRow label="Issued" value={new Date(appraisal.issued_at).toLocaleDateString("en-AU")} />}
                {appraisal.fee && <InfoRow label="Fee" value={`$${appraisal.fee.toLocaleString()}`} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
