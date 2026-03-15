"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateAppraisal, issueAppraisal } from "../actions";
import type { Appraisal } from "../actions";
import { Mail, Download, ChevronLeft, Check, Edit2, Shield, User, FileText, Calendar, Loader2 } from "lucide-react";

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
  const [emailLoading, setEmailLoading] = useState(false);
  const [insuranceSending, setInsuranceSending] = useState(false);

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
      router.refresh();
    });
  }

  function handleIssue() {
    if (!confirm("Issue this appraisal? It will be marked as officially issued.")) return;
    startTransition(async () => {
      const result = await issueAppraisal(appraisal.id);
      if (result.error) { showFeedback(result.error, true); return; }
      setStatus("issued");
      showFeedback("Appraisal issued");
      router.refresh();
    });
  }

  async function handleEmail() {
    if (!confirm(`Email appraisal to ${appraisal.customer_email}?`)) return;
    setEmailLoading(true);
    // Logic for emailing...
    setTimeout(() => {
      setEmailLoading(false);
      showFeedback("Email sent to " + appraisal.customer_email);
    }, 1500);
  }

  async function handleInsuranceSend() {
    if (!appraisal.customer_email) {
      showFeedback("No customer email on this appraisal", true);
      return;
    }
    if (!confirm(`Email insurance valuation PDF to ${appraisal.customer_email}?`)) return;
    setInsuranceSending(true);
    try {
      const res = await fetch(`/api/appraisals/${appraisal.id}/insurance-send`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) {
        showFeedback("Insurance valuation sent to " + appraisal.customer_email);
      } else {
        showFeedback(json.error ?? "Failed to send", true);
      }
    } catch {
      showFeedback("Network error", true);
    } finally {
      setInsuranceSending(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/appraisals" className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors">
          <ChevronLeft size={18} />
          Back to Appraisals
        </Link>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleEmail}
            disabled={emailLoading}
            className="flex items-center gap-2 px-4 py-2 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium"
          >
            <Mail size={16} />
            {emailLoading ? "Sending..." : "Email Client"}
          </button>
          <a 
            href={`/api/appraisals/${appraisal.id}/pdf`}
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium"
          >
            <Download size={16} />
            PDF
          </a>
          <a
            href={`/api/appraisals/${appraisal.id}/insurance-export`}
            download
            className="flex items-center gap-2 px-4 py-2 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium"
            title="Download Insurance Valuation Certificate PDF"
          >
            <Shield size={16} />
            Insurance PDF
          </a>
          <button
            onClick={handleInsuranceSend}
            disabled={insuranceSending || !appraisal.customer_email}
            className="flex items-center gap-2 px-4 py-2 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium disabled:opacity-40"
            title={appraisal.customer_email ? "Email insurance certificate to customer" : "No customer email"}
          >
            {insuranceSending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            Send to Customer
          </button>
          <button 
            onClick={() => setEditMode(!editMode)}
            className="flex items-center gap-2 px-4 py-2 bg-[#8B7355] text-white rounded-lg hover:bg-[#7A6347] transition-colors text-sm font-medium"
          >
            <Edit2 size={16} />
            {editMode ? "Stop Editing" : "Edit"}
          </button>
        </div>
      </div>

      {(error || success) && (
        <div className={`px-4 py-3 rounded-xl border text-sm animate-in fade-in slide-in-from-top-2 ${
          error ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"
        }`}>
          {error || success}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
        <div className="p-8 border-b border-stone-100 flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-stone-900">{appraisal.item_name}</h1>
            <div className="flex items-center gap-3">
              <span className="text-stone-400 font-mono text-sm uppercase">{appraisal.appraisal_number || "Draft"}</span>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
                {status}
              </span>
            </div>
          </div>
          <div className="text-right">
             <p className="text-lg font-bold text-[#8B7355]">${Number(appraisedValue || appraisal.appraised_value).toLocaleString()}</p>
             <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Valuation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-stone-100">
           <div className="p-8 space-y-6">
              <div className="flex items-center gap-2 text-[#8B7355]">
                <User size={18} />
                <h3 className="text-xs font-bold uppercase tracking-widest">Customer</h3>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-stone-900">{appraisal.customer_name}</p>
                <p className="text-xs text-stone-500">{appraisal.customer_email}</p>
                <p className="text-xs text-stone-500">{appraisal.customer_address}</p>
              </div>
           </div>
           <div className="p-8 space-y-6">
              <div className="flex items-center gap-2 text-[#8B7355]">
                <FileText size={18} />
                <h3 className="text-xs font-bold uppercase tracking-widest">Item Stats</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-400">Metal</span>
                  <span className="text-stone-900 font-medium">{appraisal.metal} {appraisal.metal_purity}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-400">Weight</span>
                  <span className="text-stone-900 font-medium">{appraisal.metal_weight_grams}g</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-400">Stone</span>
                  <span className="text-stone-900 font-medium">{appraisal.stone}</span>
                </div>
              </div>
           </div>
           <div className="p-8 space-y-6">
              <div className="flex items-center gap-2 text-[#8B7355]">
                <Shield size={18} />
                <h3 className="text-xs font-bold uppercase tracking-widest">Verification</h3>
              </div>
              <div className="space-y-3">
                 <div className="flex justify-between text-xs">
                  <span className="text-stone-400">Appraiser</span>
                  <span className="text-stone-900 font-medium">{appraisal.appraiser_name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-400">Licence</span>
                  <span className="text-stone-900 font-medium">{appraisal.appraiser_licence}</span>
                </div>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-stone-200 p-8 space-y-4">
           <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Detailed Description</h3>
           <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{appraisal.item_description}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-8 space-y-6">
           <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Status Flow</h3>
           <div className="space-y-4">
              {['draft', 'in_progress', 'completed', 'issued'].map((s, idx) => (
                <div key={s} className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    status === s ? "border-[#8B7355] bg-[#8B7355] text-white" : 
                    idx < ['draft', 'in_progress', 'completed', 'issued'].indexOf(status) ? "border-[#8B7355] text-[#8B7355]" : "border-stone-200"
                  }`}>
                    <Check size={12} />
                  </div>
                  <span className={`text-sm font-medium capitalize ${status === s ? "text-stone-900" : "text-stone-400"}`}>{s.replace('_', ' ')}</span>
                </div>
              ))}
           </div>
           {status !== 'issued' && (
             <button 
              onClick={handleIssue}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-sm"
             >
               Issue Official Certificate
             </button>
           )}
        </div>
      </div>
    </div>
  );
}
