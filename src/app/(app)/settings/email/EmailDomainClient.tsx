"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  ChevronRightIcon,
  CheckIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  TrashIcon,
  ClipboardIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  ServerIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
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
  pending: { label: "Pending Setup", badgeClass: "nx-badge-warning", icon: ClockIcon, spin: false },
  verifying: { label: "Verifying", badgeClass: "nx-badge-warning", icon: ArrowPathIcon, spin: true },
  verified: { label: "Verified", badgeClass: "nx-badge-success", icon: CheckCircleIcon, spin: false },
  failed: { label: "Failed", badgeClass: "nx-badge-danger", icon: ExclamationCircleIcon, spin: false },
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
        setMessage({ type: "success", text: "Domain added. Now add the DNS records below." });
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
        setMessage({ type: "success", text: "Domain verified. You can now send emails from your domain." });
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
    <div className="bg-nexpura-ivory min-h-screen">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start gap-4 mb-14">
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
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-[1.08] tracking-tight">
              Email Domain
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              Send emails from your own domain instead of nexpura.com for better deliverability and a more professional look.
            </p>
          </div>
        </div>

        {message && (
          <div
            role="alert"
            className={`mb-8 border-l-2 pl-4 py-1 text-sm leading-relaxed ${
              message.type === "success"
                ? "border-emerald-400 text-emerald-700"
                : "border-red-400 text-red-600"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-8 lg:space-y-10">
          {/* Sender Name Card */}
          <section className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">From Name</p>
              <h2 className="font-serif text-2xl text-stone-900 leading-tight">Sender Name</h2>
              <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                This name appears in the &ldquo;From&rdquo; field when customers receive emails from you.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Your Business Name"
                disabled={!isOwner || isPending}
                className="flex-1 px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 disabled:bg-stone-50 disabled:text-stone-400"
              />
              <button
                onClick={handleUpdateFromName}
                disabled={!isOwner || isPending || senderName === (fromName || businessName || "")}
                className="nx-btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckIcon className="w-4 h-4" />
                )}
                Save
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-3">
              Preview:{" "}
              <span className="font-medium text-stone-600">
                {senderName || "Your Business"} &lt;
                {emailDomain?.status === "verified" ? `team@${emailDomain.domain}` : "notifications@nexpura.com"}
                &gt;
              </span>
            </p>
          </section>

          {/* Reply-To Email Card - Show when NO custom domain */}
          {(!emailDomain || emailDomain.status !== "verified") && (
            <section className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">Reply-To</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="font-serif text-2xl text-stone-900 leading-tight">Reply-To Email</h2>
                  <span className="nx-badge-warning">No domain? Use this</span>
                </div>
                <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                  Don&rsquo;t have your own domain? Enter your email address here and all customer replies will go directly to your inbox.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="youremail@gmail.com"
                  disabled={!isOwner || isPending}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 disabled:bg-stone-50 disabled:text-stone-400"
                />
                <button
                  onClick={handleUpdateReplyTo}
                  disabled={!isOwner || isPending || replyTo === (replyToEmail || "")}
                  className="nx-btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckIcon className="w-4 h-4" />
                  )}
                  Save
                </button>
              </div>
              <div className="mt-5 pt-5 border-t border-stone-100">
                <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">How it works</p>
                <ul className="space-y-2 text-sm text-stone-600">
                  <li className="flex gap-3">
                    <span className="text-stone-400 shrink-0">&middot;</span>
                    <span>
                      Emails sent from:{" "}
                      <span className="font-mono text-xs text-stone-700">
                        {senderName || "Your Business"} &lt;notifications@nexpura.com&gt;
                      </span>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-stone-400 shrink-0">&middot;</span>
                    <span>
                      Customer replies go to:{" "}
                      <span className="font-mono text-xs text-stone-700">{replyTo || "your email"}</span>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-stone-400 shrink-0">&middot;</span>
                    <span>Use any email (Gmail, Outlook, Yahoo, etc.)</span>
                  </li>
                </ul>
              </div>
            </section>
          )}

          {/* Domain Card */}
          <section className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8">
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">Domain Config</p>
                <h2 className="font-serif text-2xl text-stone-900 leading-tight">Email Domain</h2>
              </div>
              {emailDomain && statusConfig && StatusIcon && (
                <span className={`${statusConfig.badgeClass} gap-1.5`}>
                  <StatusIcon className={`w-3 h-3 ${statusConfig.spin ? "animate-spin" : ""}`} />
                  {statusConfig.label}
                </span>
              )}
            </div>

            {emailDomain ? (
              <div className="space-y-6">
                {/* Current Domain */}
                <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap p-5 bg-stone-50 rounded-xl border border-stone-100">
                  <div className="flex items-center gap-4">
                    <GlobeAltIcon className="w-6 h-6 text-stone-400 shrink-0" />
                    <div>
                      <p className="font-mono text-sm text-stone-900">{emailDomain.domain}</p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {emailDomain.status === "verified"
                          ? `Verified on ${new Date(emailDomain.verifiedAt!).toLocaleDateString()}`
                          : "DNS verification required"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {emailDomain.status !== "verified" && (
                      <button
                        onClick={handleVerify}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border border-stone-200 text-stone-700 hover:border-nexpura-bronze hover:text-nexpura-bronze transition-colors duration-200 disabled:opacity-50"
                      >
                        {isPending ? (
                          <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowPathIcon className="w-3.5 h-3.5" />
                        )}
                        Check Verification
                      </button>
                    )}
                    {isOwner && (
                      <button
                        onClick={handleRemove}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-red-600 transition-colors duration-200 disabled:opacity-50"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* DNS Records */}
                {emailDomain.status !== "verified" && emailDomain.dnsRecords && emailDomain.dnsRecords.length > 0 && (
                  <div className="pt-2">
                    <button
                      onClick={() => setShowDnsRecords(!showDnsRecords)}
                      className="flex items-center gap-2 text-xs uppercase tracking-luxury text-stone-500 hover:text-stone-700 mb-5 transition-colors duration-200"
                    >
                      <ChevronRightIcon
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${showDnsRecords ? "rotate-90" : ""}`}
                      />
                      {showDnsRecords ? "Hide" : "Show"} DNS Records
                    </button>

                    {showDnsRecords && (
                      <div className="space-y-5">
                        <p className="font-serif text-xl text-stone-900 leading-tight">DNS Records</p>
                        <div className="border-l-2 border-amber-300 pl-4 py-1">
                          <p className="text-sm text-stone-700 font-medium mb-1">
                            Add these DNS records to your domain
                          </p>
                          <p className="text-sm text-stone-500 leading-relaxed">
                            Log in to your domain provider (GoDaddy, Namecheap, Cloudflare, etc.) and add the following records.
                            DNS changes can take up to 48 hours to propagate.
                          </p>
                        </div>

                        <div className="overflow-x-auto border border-stone-200 rounded-xl">
                          <table className="w-full text-sm">
                            <thead className="bg-stone-50 border-b border-stone-200">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs uppercase tracking-luxury text-stone-500 font-medium">Type</th>
                                <th className="px-4 py-3 text-left text-xs uppercase tracking-luxury text-stone-500 font-medium">Name / Host</th>
                                <th className="px-4 py-3 text-left text-xs uppercase tracking-luxury text-stone-500 font-medium">Value</th>
                                <th className="px-4 py-3 text-center text-xs uppercase tracking-luxury text-stone-500 font-medium w-24">Status</th>
                                <th className="px-4 py-3 w-16"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200">
                              {emailDomain.dnsRecords.map((record, idx) => (
                                <tr key={idx} className="hover:bg-stone-50 transition-colors duration-150">
                                  <td className="px-4 py-3 align-top">
                                    <span className="font-mono text-xs text-stone-700 bg-stone-100 px-2 py-1 rounded">
                                      {record.type}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <code className="font-mono text-xs text-stone-700 break-all">{record.name}</code>
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <code className="font-mono text-xs text-stone-700 break-all max-w-xs block">{record.value}</code>
                                  </td>
                                  <td className="px-4 py-3 text-center align-top">
                                    {record.status === "verified" ? (
                                      <CheckCircleIcon className="w-4 h-4 text-emerald-500 inline" />
                                    ) : (
                                      <ClockIcon className="w-4 h-4 text-amber-500 inline" />
                                    )}
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <button
                                      onClick={() => copyToClipboard(record.value, `${idx}`)}
                                      className="text-stone-400 hover:text-nexpura-bronze transition-colors duration-200"
                                      aria-label="Copy value"
                                    >
                                      {copiedRecord === `${idx}` ? (
                                        <CheckIcon className="w-4 h-4 text-emerald-500" />
                                      ) : (
                                        <ClipboardIcon className="w-4 h-4" />
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <a
                          href="https://resend.com/docs/dashboard/domains/introduction"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-nexpura-bronze hover:text-nexpura-bronze-hover transition-colors duration-200"
                        >
                          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                          DNS Setup Guide
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Verified Success */}
                {emailDomain.status === "verified" && (
                  <div className="border-l-2 border-emerald-400 pl-4 py-1">
                    <p className="text-sm text-stone-700 font-medium mb-1">
                      Domain verified and active
                    </p>
                    <p className="text-sm text-stone-500 leading-relaxed">
                      All emails (invoices, reminders, team invites) will now be sent from{" "}
                      <span className="font-mono text-stone-700">team@{emailDomain.domain}</span>
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Add Domain Form */
              <div className="space-y-6">
                <p className="text-sm text-stone-500 leading-relaxed">
                  Add your own domain to send professional emails from your business address instead of nexpura.com.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-mono">team@</span>
                    <input
                      type="text"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                      placeholder="yourbusiness.com"
                      disabled={!isOwner || isPending}
                      className="w-full pl-16 pr-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 disabled:bg-stone-50 disabled:text-stone-400"
                    />
                  </div>
                  <button
                    onClick={handleAddDomain}
                    disabled={!isOwner || isPending || !newDomain.trim()}
                    className="nx-btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <GlobeAltIcon className="w-4 h-4" />
                    )}
                    Add Domain
                  </button>
                </div>

                {!isOwner && (
                  <p className="text-xs text-amber-600">
                    Only the account owner can manage email domains.
                  </p>
                )}

                {/* Benefits */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-stone-100">
                  <div className="flex items-start gap-3">
                    <ShieldCheckIcon className="w-5 h-5 text-stone-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-stone-900">Better Deliverability</p>
                      <p className="text-xs text-stone-500 mt-1 leading-relaxed">Emails are less likely to end up in spam.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <EnvelopeIcon className="w-5 h-5 text-stone-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-stone-900">Professional Look</p>
                      <p className="text-xs text-stone-500 mt-1 leading-relaxed">Customers see your domain, not ours.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ServerIcon className="w-5 h-5 text-stone-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-stone-900">Brand Consistency</p>
                      <p className="text-xs text-stone-500 mt-1 leading-relaxed">Reinforce your brand identity.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* What emails use this */}
          <section className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">Usage</p>
              <h2 className="font-serif text-2xl text-stone-900 leading-tight">Emails Using This Domain</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Team Invites", desc: "When you invite staff" },
                { label: "Customer Invoices", desc: "Sent after purchases" },
                { label: "Repair Updates", desc: "Status notifications" },
                { label: "Reminders", desc: "Appointment & pickup" },
              ].map((item, idx) => (
                <div key={idx} className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                  <p className="text-sm font-medium text-stone-900">{item.label}</p>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
