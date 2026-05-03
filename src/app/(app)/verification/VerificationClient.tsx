"use client";

import { useState, useTransition, useMemo } from "react";
import { Plus, Edit2, Trash2, AlertTriangle, Calendar, ExternalLink, ShieldCheck } from "lucide-react";
import { createCredential, updateCredential, deleteCredential } from "./actions";

export interface CredentialRow {
  id: string;
  userId: string | null;
  employeeName: string;
  credentialType: string;
  issuer: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  documentUrl: string | null;
  notes: string | null;
}

interface TeamMember { id: string; full_name: string; email: string | null }

interface Props {
  credentials: CredentialRow[];
  teamMembers: TeamMember[];
  canManage: boolean;
}

const CREDENTIAL_TYPE_OPTIONS = [
  "Trade certificate",
  "Manufacturer training",
  "Diamond grading (GIA)",
  "Coloured stone grading",
  "Pearl grading",
  "Watchmaker certification",
  "First-aid certification",
  "Working with Children Check",
  "Police clearance",
  "Other",
];

function expiryStatus(date: string | null): { label: string; tone: "expired" | "soon" | "ok" | "no-expiry" } {
  if (!date) return { label: "No expiry", tone: "no-expiry" };
  const exp = new Date(date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, tone: "expired" };
  if (days <= 30) return { label: days === 0 ? "Expires today" : `${days}d remaining`, tone: "soon" };
  return { label: `${days}d remaining`, tone: "ok" };
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function VerificationClient({ credentials, teamMembers, canManage }: Props) {
  const [editing, setEditing] = useState<CredentialRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    const expired = credentials.filter((c) => expiryStatus(c.expiryDate).tone === "expired").length;
    const expiring = credentials.filter((c) => expiryStatus(c.expiryDate).tone === "soon").length;
    return { total: credentials.length, expired, expiring };
  }, [credentials]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-700" />
            Employee Credentials
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Track licences, training certifications, and expiring credentials for your team.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => { setShowAdd(true); setEditing(null); setError(null); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add credential
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total credentials", value: summary.total, tone: "stone" },
          { label: "Expiring within 30 days", value: summary.expiring, tone: "amber" },
          { label: "Expired", value: summary.expired, tone: "red" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400">{s.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${s.tone === "red" ? "text-red-600" : s.tone === "amber" ? "text-amber-700" : "text-stone-900"}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">All credentials</h2>
        </div>
        {credentials.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-stone-400">
            No credentials yet. {canManage && <button onClick={() => setShowAdd(true)} className="text-amber-700 hover:underline">Add the first one →</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">Employee</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">Credential</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">Issuer</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">Issued</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">Expiry</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">Document</th>
                  {canManage && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {credentials.map((c) => {
                  const exp = expiryStatus(c.expiryDate);
                  return (
                    <tr key={c.id} className="hover:bg-stone-50/60">
                      <td className="px-5 py-3 text-stone-900 font-medium">{c.employeeName}</td>
                      <td className="px-4 py-3 text-stone-700">{c.credentialType}</td>
                      <td className="px-4 py-3 text-stone-500">{c.issuer ?? "—"}</td>
                      <td className="px-4 py-3 text-stone-500"><Calendar className="w-3 h-3 inline mr-1 text-stone-400" />{fmtDate(c.issuedDate)}</td>
                      <td className="px-4 py-3">
                        <p className="text-stone-700">{fmtDate(c.expiryDate)}</p>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium mt-0.5 ${
                          exp.tone === "expired" ? "text-red-600" :
                          exp.tone === "soon" ? "text-amber-700" :
                          "text-stone-400"
                        }`}>
                          {(exp.tone === "expired" || exp.tone === "soon") && <AlertTriangle className="w-3 h-3" />}
                          {exp.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.documentUrl ? (
                          <a href={c.documentUrl} target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline inline-flex items-center gap-1 text-xs">
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-stone-400 text-xs">—</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => { setEditing(c); setShowAdd(false); setError(null); }}
                            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded"
                            aria-label={`Edit ${c.employeeName}'s ${c.credentialType}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!confirm(`Delete ${c.employeeName}'s ${c.credentialType}?`)) return;
                              startTransition(async () => {
                                const r = await deleteCredential(c.id);
                                if (r.error) setError(r.error);
                              });
                            }}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded ml-1"
                            aria-label={`Delete ${c.employeeName}'s ${c.credentialType}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Add / Edit modal */}
      {(showAdd || editing) && canManage && (
        <CredentialForm
          initial={editing}
          teamMembers={teamMembers}
          pending={pending}
          onCancel={() => { setShowAdd(false); setEditing(null); setError(null); }}
          onSubmit={(payload) => {
            startTransition(async () => {
              const r = editing
                ? await updateCredential(editing.id, payload)
                : await createCredential(payload);
              if (r.error) setError(r.error);
              else { setShowAdd(false); setEditing(null); setError(null); }
            });
          }}
        />
      )}
    </div>
  );
}

function CredentialForm({
  initial,
  teamMembers,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: CredentialRow | null;
  teamMembers: TeamMember[];
  pending: boolean;
  onSubmit: (p: { employee_name: string; user_id: string | null; credential_type: string; issuer: string; issued_date: string; expiry_date: string; document_url: string; notes: string }) => void;
  onCancel: () => void;
}) {
  const [employeeName, setEmployeeName] = useState(initial?.employeeName ?? "");
  const [userId, setUserId] = useState<string>(initial?.userId ?? "");
  const [credentialType, setCredentialType] = useState(initial?.credentialType ?? CREDENTIAL_TYPE_OPTIONS[0]);
  const [issuer, setIssuer] = useState(initial?.issuer ?? "");
  const [issuedDate, setIssuedDate] = useState(initial?.issuedDate ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? "");
  const [documentUrl, setDocumentUrl] = useState(initial?.documentUrl ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg text-stone-900 mb-4">{initial ? "Edit credential" : "Add credential"}</h3>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              employee_name: employeeName,
              user_id: userId || null,
              credential_type: credentialType,
              issuer,
              issued_date: issuedDate,
              expiry_date: expiryDate,
              document_url: documentUrl,
              notes,
            });
          }}
        >
          <div>
            <label className="text-xs font-medium text-stone-600">Employee name *</label>
            <input
              type="text"
              required
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600">Linked Nexpura user (optional)</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze"
            >
              <option value="">— none —</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}{m.email ? ` (${m.email})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600">Credential type *</label>
            <select
              required
              value={credentialType}
              onChange={(e) => setCredentialType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze"
            >
              {CREDENTIAL_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600">Issuer / authority</label>
            <input
              type="text"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="e.g. GIA, JAA, state authority"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-stone-600">Issued date</label>
              <input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Expiry date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600">Document URL</label>
            <input
              type="url"
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
              placeholder="https://…"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg hover:bg-stone-50">Cancel</button>
            <button type="submit" disabled={pending} className="px-4 py-1.5 text-sm font-semibold bg-nexpura-charcoal text-white rounded-lg hover:bg-nexpura-charcoal-700 disabled:opacity-50">
              {pending ? "Saving…" : initial ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
