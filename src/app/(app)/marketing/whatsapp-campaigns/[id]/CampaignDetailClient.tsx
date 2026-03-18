"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageSquare,
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Send,
  Trash2,
} from "lucide-react";
import { createCampaignCheckout, deleteCampaign } from "../actions";

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: string;
  payment_status: string;
  recipient_type: string;
  recipient_filter: { segment_id?: string; tags?: string[]; customer_ids?: string[] };
  recipient_count: number;
  amount_cents: number;
  price_per_message_cents: number;
  stats: { sent: number; delivered: number; failed: number };
  created_at: string;
  paid_at: string | null;
  sent_at: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-stone-100 text-stone-600" },
    pending_payment: { label: "Pending Payment", className: "bg-amber-100 text-amber-700" },
    paid: { label: "Paid", className: "bg-green-100 text-green-700" },
    sending: { label: "Sending...", className: "bg-blue-100 text-blue-700" },
    sent: { label: "Sent", className: "bg-green-100 text-green-700" },
    failed: { label: "Failed", className: "bg-red-100 text-red-600" },
    canceled: { label: "Canceled", className: "bg-stone-100 text-stone-500" },
  };
  const s = map[status] || { label: status, className: "bg-stone-100 text-stone-600" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

export default function CampaignDetailClient({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalCost = (campaign.amount_cents / 100).toFixed(2);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const result = await createCampaignCheckout(campaign.id);
      if (result.error) {
        setError(result.error);
      } else if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    setDeleting(true);
    const result = await deleteCampaign(campaign.id);
    if (result.error) {
      setError(result.error);
      setDeleting(false);
    } else {
      router.push("/marketing/whatsapp-campaigns");
    }
  }

  const canPay = campaign.payment_status === "pending" || campaign.payment_status === "failed";
  const canDelete = campaign.status !== "sending" && campaign.status !== "sent" && campaign.payment_status !== "paid";

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/marketing/whatsapp-campaigns"
          className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-stone-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-stone-800">{campaign.name}</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Created {new Date(campaign.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="flex items-center gap-2 text-stone-500 text-sm mb-1">
            <Users className="w-4 h-4" /> Recipients
          </div>
          <p className="text-2xl font-semibold text-stone-800">{campaign.recipient_count}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="flex items-center gap-2 text-stone-500 text-sm mb-1">
            <DollarSign className="w-4 h-4" /> Total Cost
          </div>
          <p className="text-2xl font-semibold text-stone-800">${totalCost} AUD</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="flex items-center gap-2 text-stone-500 text-sm mb-1">
            <Send className="w-4 h-4" /> Delivered
          </div>
          <p className="text-2xl font-semibold text-stone-800">{campaign.stats.delivered}</p>
        </div>
      </div>

      {/* Message */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
        <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">Message</h2>
        <div className="bg-stone-50 rounded-lg p-4">
          <p className="text-stone-700 whitespace-pre-wrap">{campaign.message}</p>
        </div>
      </div>

      {/* Recipient details */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
        <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">Recipients</h2>
        <div className="flex items-center gap-2 text-stone-700">
          <Users className="w-4 h-4 text-stone-400" />
          <span className="capitalize">{campaign.recipient_type.replace("_", " ")}</span>
          <span className="text-stone-400">·</span>
          <span>{campaign.recipient_count} customer{campaign.recipient_count !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {canPay && (
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
            Pay & Send — ${totalCost} AUD
          </button>
        )}
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-3 border border-stone-200 text-stone-600 rounded-xl font-medium hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        )}
      </div>

      {campaign.status === "sent" && (
        <div className="mt-6 p-4 bg-green-50 border border-green-100 rounded-xl">
          <div className="flex items-center gap-2 text-green-700 font-medium">
            <CheckCircle className="w-4 h-4" />
            Campaign sent successfully
          </div>
          <p className="text-sm text-green-600 mt-1">
            {campaign.stats.delivered} delivered · {campaign.stats.failed} failed
          </p>
        </div>
      )}
    </div>
  );
}
