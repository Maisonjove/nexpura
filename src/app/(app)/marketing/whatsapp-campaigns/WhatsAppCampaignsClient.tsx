"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  MessageSquare,
  Search,
  MoreVertical,
  Trash2,
  Eye,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { deleteCampaign, retryCampaignPayment } from "./actions";

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: string;
  payment_status: string;
  stripe_session_id: string | null;
  recipient_type: string;
  recipient_filter: Record<string, unknown>;
  recipient_count: number;
  amount_cents: number;
  price_per_message_cents: number;
  stats: { sent: number; delivered: number; failed: number };
  scheduled_at: string | null;
  paid_at: string | null;
  sent_at: string | null;
  created_at: string;
}

interface Segment {
  id: string;
  name: string;
  customer_count: number;
}

interface Props {
  campaigns: Campaign[];
  segments: Segment[];
  tenantId: string;
  totalCustomersWithPhone: number;
  paymentSuccess: boolean;
  paymentCanceled: boolean;
  stripeSessionId?: string;
}

export default function WhatsAppCampaignsClient({
  campaigns,
  segments,
  tenantId,
  totalCustomersWithPhone,
  paymentSuccess,
  paymentCanceled,
  stripeSessionId,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Show payment status notification
  useEffect(() => {
    if (paymentSuccess) {
      setNotification({
        type: "success",
        message: "Payment successful! Your campaign is being sent.",
      });
      // Clean URL
      window.history.replaceState({}, "", "/marketing/whatsapp-campaigns");
    } else if (paymentCanceled) {
      setNotification({
        type: "error",
        message: "Payment was cancelled. Your campaign was not sent.",
      });
      window.history.replaceState({}, "", "/marketing/whatsapp-campaigns");
    }
  }, [paymentSuccess, paymentCanceled]);

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.message.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    draft: { bg: "bg-stone-500/20", text: "text-stone-400", icon: <Clock className="w-3 h-3" /> },
    pending_payment: { bg: "bg-amber-500/20", text: "text-amber-400", icon: <CreditCard className="w-3 h-3" /> },
    paid: { bg: "bg-blue-500/20", text: "text-blue-400", icon: <CheckCircle className="w-3 h-3" /> },
    sending: { bg: "bg-purple-500/20", text: "text-purple-400", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    sent: { bg: "bg-green-500/20", text: "text-green-400", icon: <CheckCircle className="w-3 h-3" /> },
    failed: { bg: "bg-red-500/20", text: "text-red-400", icon: <XCircle className="w-3 h-3" /> },
    cancelled: { bg: "bg-stone-500/20", text: "text-stone-400", icon: <XCircle className="w-3 h-3" /> },
  };

  async function handleDelete(id: string) {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    setLoading(id);
    const result = await deleteCampaign(id);
    if (result.error) {
      alert(result.error);
    }
    setLoading(null);
    setShowMenu(null);
    router.refresh();
  }

  async function handleRetryPayment(id: string) {
    setLoading(id);
    const result = await retryCampaignPayment(id);
    if (result.error) {
      alert(result.error);
    } else if (result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
    }
    setLoading(null);
    setShowMenu(null);
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatCurrency(cents: number) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(cents / 100);
  }

  const PRICE_PER_MESSAGE = 0.16;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Notification Banner */}
      {notification && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            notification.type === "success"
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-auto text-current hover:opacity-70"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">WhatsApp Campaigns</h1>
          <p className="text-stone-400 text-sm mt-1">
            Send marketing messages to your customers via WhatsApp
          </p>
        </div>
        <Link
          href="/marketing/whatsapp-campaigns/new"
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {/* Pricing Info */}
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
          <MessageSquare className="w-6 h-6 text-green-400" />
        </div>
        <div className="flex-1">
          <p className="text-green-400 font-medium">WhatsApp Marketing Messages</p>
          <p className="text-stone-400 text-sm">
            ${PRICE_PER_MESSAGE.toFixed(2)} AUD per message • You have {totalCustomersWithPhone.toLocaleString()} customers with phone numbers
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">
            ${PRICE_PER_MESSAGE.toFixed(2)}
          </p>
          <p className="text-xs text-stone-500">per message</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#1A1A1A] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-green-500/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-[#1A1A1A] border border-white/[0.06] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500/40"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="paid">Paid</option>
          <option value="sending">Sending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Campaigns List */}
      {filteredCampaigns.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-12 text-center">
          <MessageSquare className="w-12 h-12 text-stone-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No campaigns found</h3>
          <p className="text-stone-400 text-sm mb-6">
            {search || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Create your first WhatsApp campaign to reach your customers"}
          </p>
          {!search && statusFilter === "all" && (
            <Link
              href="/marketing/whatsapp-campaigns/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Campaign
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg overflow-hidden">
          <div className="divide-y divide-white/[0.06]">
            {filteredCampaigns.map((campaign) => {
              const status = statusConfig[campaign.status] || statusConfig.draft;

              return (
                <div
                  key={campaign.id}
                  className="p-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-5 h-5 text-green-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-white truncate">
                          {campaign.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}
                        >
                          {status.icon}
                          {campaign.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm text-stone-400 truncate mt-0.5">
                        {campaign.message.substring(0, 60)}...
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {campaign.recipient_count.toLocaleString()} recipients
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {formatCurrency(campaign.amount_cents)}
                        </span>
                        {campaign.status === "sent" && (
                          <>
                            <span>Sent {formatDate(campaign.sent_at!)}</span>
                            <span>•</span>
                            <span className="text-green-400">
                              {campaign.stats.delivered} delivered
                            </span>
                            {campaign.stats.failed > 0 && (
                              <span className="text-red-400">
                                {campaign.stats.failed} failed
                              </span>
                            )}
                          </>
                        )}
                        {campaign.status === "draft" && (
                          <span>Created {formatDate(campaign.created_at)}</span>
                        )}
                      </div>
                    </div>

                    <div className="relative">
                      <button
                        onClick={() =>
                          setShowMenu(showMenu === campaign.id ? null : campaign.id)
                        }
                        className="p-2 hover:bg-white/[0.05] rounded-lg text-stone-400 hover:text-white transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {showMenu === campaign.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowMenu(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-48 bg-[#252525] border border-white/[0.1] rounded-lg shadow-xl z-20 py-1">
                            <Link
                              href={`/marketing/whatsapp-campaigns/${campaign.id}`}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-stone-300 hover:bg-white/[0.05] hover:text-white"
                            >
                              <Eye className="w-4 h-4" />
                              View Details
                            </Link>
                            
                            {campaign.status === "pending_payment" && (
                              <button
                                onClick={() => handleRetryPayment(campaign.id)}
                                disabled={loading === campaign.id}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-400 hover:bg-white/[0.05] disabled:opacity-50"
                              >
                                <CreditCard className="w-4 h-4" />
                                {loading === campaign.id ? "Loading..." : "Complete Payment"}
                              </button>
                            )}

                            {(campaign.status === "draft" || campaign.status === "pending_payment" || campaign.status === "failed") && (
                              <button
                                onClick={() => handleDelete(campaign.id)}
                                disabled={loading === campaign.id}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/[0.05] disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
