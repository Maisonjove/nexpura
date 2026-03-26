"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail, Globe, ChevronRight, Check, AlertCircle,
  RefreshCw, Trash2, Loader2, Copy, CheckCircle2, Clock,
  Shield, Server, ExternalLink
} from "lucide-react";
import {
  addEmailDomain,
  verifyEmailDomain,
  removeEmailDomain,
  updateFromName,
  updateReplyToEmail,
  DnsRecord,
} from "./actions";

interface Props {
  emailDomain: {
    id: string;
    domain: string;
    status: "pending" | "verifying" | "verified" | "failed";
    dnsRecords: DnsRecord[] | null;
    verifiedAt: string | null;
    createdAt: string;
  } | null;
  fromName: string | null;
  businessName: string | null;
  replyToEmail: string | null;
  isOwner: boolean;
}

const STATUS_CONFIG = {
  pending: { label: "Pending Setup", color: "bg-amber-100 text-amber-700", icon: Clock },
  verifying: { label: "Verifying", color: "bg-blue-100 text-blue-700", icon: RefreshCw },
  verified: { label: "Verified", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-red-100 text-red-600", icon: AlertCircle },
};

export default function EmailDomainClient({ emailDomain, fromName, businessName, replyToEmail, isOwner }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newDomain, setNewDomain] = useState("");
  const [senderName, setSenderName] = useState(fromName || businessName || "");
  const [replyTo, setReplyTo] = useState(replyToEmail || "");
  const [showDnsRecords, setShowDnsRecords] = useState(false);
  const [copiedRecord, setCopiedRecord] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const statusConfig = emailDomain ? STATUS_CONFIG[emailDomain.status] : null;
  const StatusIcon = statusConfig?.icon;

  async function handleAddDomain() {
    if (!newDomain.trim()) return;
    setMessage(null);

    startTransition(async () => {
      const result = await addEmailDomain(newDomain.trim().toLowerCase());
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Domain added! Now add the DNS records below." });
        setNewDomain("");
        setShowDnsRecords(true);
        router.refresh();
      }
    });
  }

  async function handleVerify() {
    setMessage(null);

    startTransition(async () => {
      const result = await verifyEmailDomain();
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else if (result.verified) {
        setMessage({ type: "success", text: "🎉 Domain verified! You can now send emails from your domain." });
        router.refresh();
      } else {
        setMessage({ type: "error", text: "DNS records not yet verified. Please ensure all records are added correctly." });
        router.refresh();
      }
    });
  }

  async function handleRemove() {
    if (!confirm("Are you sure you want to remove this domain? Emails will be sent from nexpura.com instead.")) {
      return;
    }
    setMessage(null);

    startTransition(async () => {
      const result = await removeEmailDomain();
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Domain removed" });
        router.refresh();
      }
    });
  }

  async function handleUpdateFromName() {
    setMessage(null);

    startTransition(async () => {
      const result = await updateFromName(senderName);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Sender name updated" });
        router.refresh();
      }
    });
  }

  async function handleUpdateReplyTo() {
    setMessage(null);

    startTransition(async () => {
      const result = await updateReplyToEmail(replyTo);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Reply-to email updated. Customer replies will now go to this address." });
        router.refresh();
      }
    });
  }

  function copyToClipboard(text: string, recordId: string) {
    navigator.clipboard.writeText(text);
    setCopiedRecord(recordId);
    setTimeout(() => setCopiedRecord(null), 2000);
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-stone-500 mb-2">
          <Link href="/settings" className="hover:text-stone-700">Settings</Link>
          <ChevronRight size={14} />
          <span className="text-stone-900">Email Domain</span>
        </div>
        <h1 className="text-2xl font-semibold text-stone-900">Email Settings</h1>
        <p className="text-stone-500 text-sm mt-1">
          Send emails from your own domain instead of nexpura.com
        </p>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
          message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
        }`}>
          {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Sender Name Card */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50">
            <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
              <Mail size={14} />
              Sender Name
            </h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-stone-500 mb-4">
              This name appears in the "From" field when customers receive emails from you.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Your Business Name"
                disabled={!isOwner || isPending}
                className="flex-1 px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:bg-stone-50 disabled:text-stone-400"
              />
              <button
                onClick={handleUpdateFromName}
                disabled={!isOwner || isPending || senderName === (fromName || businessName || "")}
                className="px-4 py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : "Save"}
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-2">
              Preview: <span className="font-medium">{senderName || "Your Business"} &lt;{emailDomain?.status === "verified" ? `team@${emailDomain.domain}` : "notifications@nexpura.com"}&gt;</span>
            </p>
          </div>
        </div>

        {/* Reply-To Email Card - Show when NO custom domain */}
        {(!emailDomain || emailDomain.status !== "verified") && (
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 bg-stone-50">
              <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
                <Mail size={14} />
                Reply-To Email
                <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">No domain? Use this!</span>
              </h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-stone-500 mb-4">
                Don't have your own domain? No problem! Enter your email address here and all customer replies will go directly to your inbox.
              </p>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="youremail@gmail.com"
                  disabled={!isOwner || isPending}
                  className="flex-1 px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:bg-stone-50 disabled:text-stone-400"
                />
                <button
                  onClick={handleUpdateReplyTo}
                  disabled={!isOwner || isPending || replyTo === (replyToEmail || "")}
                  className="px-4 py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? <Loader2 size={16} className="animate-spin" /> : "Save"}
                </button>
              </div>
              <div className="mt-4 p-3 bg-stone-50 rounded-lg text-xs text-stone-600">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1 text-stone-500">
                  <li>Emails are sent from: <span className="font-mono">{senderName || "Your Business"} &lt;notifications@nexpura.com&gt;</span></li>
                  <li>When customers reply, it goes to: <span className="font-mono">{replyTo || "your email"}</span></li>
                  <li>You can use any email (Gmail, Outlook, Yahoo, etc.)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Domain Card */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
              <Globe size={14} />
              Email Domain
            </h2>
            {emailDomain && statusConfig && StatusIcon && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${statusConfig.color}`}>
                <StatusIcon size={12} className={emailDomain.status === "verifying" ? "animate-spin" : ""} />
                {statusConfig.label}
              </span>
            )}
          </div>

          <div className="p-6">
            {emailDomain ? (
              <div className="space-y-6">
                {/* Current Domain */}
                <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      emailDomain.status === "verified" ? "bg-green-100" : "bg-amber-100"
                    }`}>
                      <Globe size={20} className={
                        emailDomain.status === "verified" ? "text-green-600" : "text-amber-600"
                      } />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{emailDomain.domain}</p>
                      <p className="text-xs text-stone-500">
                        {emailDomain.status === "verified" 
                          ? `Verified on ${new Date(emailDomain.verifiedAt!).toLocaleDateString()}`
                          : "DNS verification required"
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {emailDomain.status !== "verified" && (
                      <button
                        onClick={handleVerify}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Check Verification
                      </button>
                    )}
                    {isOwner && (
                      <button
                        onClick={handleRemove}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* DNS Records */}
                {emailDomain.status !== "verified" && emailDomain.dnsRecords && emailDomain.dnsRecords.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowDnsRecords(!showDnsRecords)}
                      className="flex items-center gap-2 text-sm font-medium text-stone-700 hover:text-stone-900 mb-4"
                    >
                      <ChevronRight size={16} className={`transition-transform ${showDnsRecords ? "rotate-90" : ""}`} />
                      {showDnsRecords ? "Hide" : "Show"} DNS Records
                    </button>

                    {showDnsRecords && (
                      <div className="space-y-4">
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                          <div className="flex items-start gap-3">
                            <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                            <div className="text-sm text-amber-800">
                              <p className="font-medium mb-1">Add these DNS records to your domain</p>
                              <p className="text-amber-700">
                                Log in to your domain provider (GoDaddy, Namecheap, Cloudflare, etc.) and add the following records. 
                                DNS changes can take up to 48 hours to propagate.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-hidden border border-stone-200 rounded-xl">
                          <table className="w-full text-sm">
                            <thead className="bg-stone-50 border-b border-stone-200">
                              <tr>
                                <th className="px-4 py-3 text-left font-semibold text-stone-700">Type</th>
                                <th className="px-4 py-3 text-left font-semibold text-stone-700">Name / Host</th>
                                <th className="px-4 py-3 text-left font-semibold text-stone-700">Value</th>
                                <th className="px-4 py-3 text-center font-semibold text-stone-700 w-20">Status</th>
                                <th className="px-4 py-3 w-16"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                              {emailDomain.dnsRecords.map((record, idx) => (
                                <tr key={idx} className="hover:bg-stone-50">
                                  <td className="px-4 py-3">
                                    <span className="font-mono text-xs bg-stone-100 text-stone-700 px-2 py-1 rounded">
                                      {record.type}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <code className="text-xs text-stone-600 break-all">{record.name}</code>
                                  </td>
                                  <td className="px-4 py-3">
                                    <code className="text-xs text-stone-600 break-all max-w-xs block">{record.value}</code>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {record.status === "verified" ? (
                                      <span className="inline-flex items-center gap-1 text-green-600">
                                        <CheckCircle2 size={14} />
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-amber-600">
                                        <Clock size={14} />
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => copyToClipboard(record.value, `${idx}`)}
                                      className="text-stone-400 hover:text-stone-600 transition-colors"
                                    >
                                      {copiedRecord === `${idx}` ? (
                                        <Check size={14} className="text-green-600" />
                                      ) : (
                                        <Copy size={14} />
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-stone-500">
                          <a
                            href="https://resend.com/docs/dashboard/domains/introduction"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-amber-600 hover:text-amber-700"
                          >
                            <ExternalLink size={14} />
                            DNS Setup Guide
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Verified Success */}
                {emailDomain.status === "verified" && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="text-green-600 mt-0.5 shrink-0" />
                      <div className="text-sm text-green-800">
                        <p className="font-medium mb-1">Domain verified and active!</p>
                        <p className="text-green-700">
                          All emails (invoices, reminders, team invites) will now be sent from <strong>team@{emailDomain.domain}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Add Domain Form */
              <div className="space-y-4">
                <p className="text-sm text-stone-500">
                  Add your own domain to send professional emails from your business address instead of nexpura.com
                </p>
                
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-sm">team@</span>
                    <input
                      type="text"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                      placeholder="yourbusiness.com"
                      disabled={!isOwner || isPending}
                      className="w-full pl-16 pr-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:bg-stone-50 disabled:text-stone-400"
                    />
                  </div>
                  <button
                    onClick={handleAddDomain}
                    disabled={!isOwner || isPending || !newDomain.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                    Add Domain
                  </button>
                </div>

                {!isOwner && (
                  <p className="text-xs text-amber-600">
                    Only the account owner can manage email domains
                  </p>
                )}

                {/* Benefits */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-stone-100">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                      <Shield size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-900">Better Deliverability</p>
                      <p className="text-xs text-stone-500">Emails are less likely to end up in spam</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                      <Mail size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-900">Professional Look</p>
                      <p className="text-xs text-stone-500">Customers see your domain, not ours</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                      <Server size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-900">Brand Consistency</p>
                      <p className="text-xs text-stone-500">Reinforce your brand identity</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* What emails use this */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50">
            <h2 className="text-sm font-semibold text-stone-700">Emails Using This Domain</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Team Invites", desc: "When you invite staff" },
                { label: "Customer Invoices", desc: "Sent after purchases" },
                { label: "Repair Updates", desc: "Status notifications" },
                { label: "Reminders", desc: "Appointment & pickup" },
              ].map((item, idx) => (
                <div key={idx} className="p-3 bg-stone-50 rounded-lg">
                  <p className="text-sm font-medium text-stone-900">{item.label}</p>
                  <p className="text-xs text-stone-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
