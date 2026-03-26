"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Mail,
  Search,
  MoreVertical,
  Calendar,
  Send,
  Copy,
  Trash2,
  Edit,
  Eye,
} from "lucide-react";
import { deleteCampaign, duplicateCampaign, sendCampaignNow } from "./actions";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string | null;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_type: string;
  recipient_filter: Record<string, unknown>;
  stats: { sent: number; opened: number; clicked: number; bounced: number };
  created_at: string;
}

interface Segment {
  id: string;
  name: string;
  customer_count: number;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  template_type: string | null;
}

interface Props {
  campaigns: Campaign[];
  segments: Segment[];
  templates: Template[];
  tenantId: string;
}

export default function CampaignsClient({ campaigns, segments, templates, tenantId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.subject.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    draft: "bg-stone-500/20 text-stone-400",
    scheduled: "bg-blue-500/20 text-blue-400",
    sending: "bg-amber-500/20 text-amber-400",
    sent: "bg-green-500/20 text-green-400",
    cancelled: "bg-red-500/20 text-red-400",
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

  async function handleDuplicate(id: string) {
    setLoading(id);
    const result = await duplicateCampaign(id);
    if (result.error) {
      alert(result.error);
    }
    setLoading(null);
    setShowMenu(null);
    router.refresh();
  }

  async function handleSendNow(id: string) {
    if (!confirm("Send this campaign now? This cannot be undone.")) return;
    setLoading(id);
    const result = await sendCampaignNow(id);
    if (result.error) {
      alert(result.error);
    } else {
      alert(`Campaign sent! ${result.sent} emails delivered, ${result.failed} failed.`);
    }
    setLoading(null);
    setShowMenu(null);
    router.refresh();
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Campaigns</h1>
          <p className="text-stone-400 text-sm mt-1">
            Create and manage your email marketing campaigns
          </p>
        </div>
        <Link
          href="/marketing/campaigns/new"
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
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
            className="w-full pl-10 pr-4 py-2 bg-[#1A1A1A] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-[#1A1A1A] border border-white/[0.06] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="sent">Sent</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Campaigns List */}
      {filteredCampaigns.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-12 text-center">
          <Mail className="w-12 h-12 text-stone-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No campaigns found</h3>
          <p className="text-stone-400 text-sm mb-6">
            {search || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Create your first email campaign to get started"}
          </p>
          {!search && statusFilter === "all" && (
            <Link
              href="/marketing/campaigns/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Campaign
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg overflow-hidden">
          <div className="divide-y divide-white/[0.06]">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="p-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/marketing/campaigns/${campaign.id}`}
                        className="font-medium text-white hover:text-amber-400 truncate"
                      >
                        {campaign.name}
                      </Link>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          statusColors[campaign.status] || statusColors.draft
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </div>
                    <p className="text-sm text-stone-400 truncate mt-0.5">
                      {campaign.subject}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
                      {campaign.status === "sent" ? (
                        <>
                          <span>Sent {formatDate(campaign.sent_at!)}</span>
                          <span>•</span>
                          <span>{campaign.stats.sent} sent</span>
                          <span>•</span>
                          <span>
                            {campaign.stats.sent > 0
                              ? Math.round((campaign.stats.opened / campaign.stats.sent) * 100)
                              : 0}
                            % opened
                          </span>
                        </>
                      ) : campaign.status === "scheduled" ? (
                        <>
                          <Calendar className="w-3 h-3" />
                          <span>Scheduled for {formatDate(campaign.scheduled_at!)}</span>
                        </>
                      ) : (
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
                            href={`/marketing/campaigns/${campaign.id}`}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-stone-300 hover:bg-white/[0.05] hover:text-white"
                          >
                            <Eye className="w-4 h-4" />
                            View Details
                          </Link>
                          {campaign.status !== "sent" &&
                            campaign.status !== "sending" && (
                              <>
                                <Link
                                  href={`/marketing/campaigns/${campaign.id}/edit`}
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-stone-300 hover:bg-white/[0.05] hover:text-white"
                                >
                                  <Edit className="w-4 h-4" />
                                  Edit
                                </Link>
                                <button
                                  onClick={() => handleSendNow(campaign.id)}
                                  disabled={loading === campaign.id}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-400 hover:bg-white/[0.05] disabled:opacity-50"
                                >
                                  <Send className="w-4 h-4" />
                                  {loading === campaign.id ? "Sending..." : "Send Now"}
                                </button>
                              </>
                            )}
                          <button
                            onClick={() => handleDuplicate(campaign.id)}
                            disabled={loading === campaign.id}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-300 hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                          >
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </button>
                          {campaign.status !== "sending" && (
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
