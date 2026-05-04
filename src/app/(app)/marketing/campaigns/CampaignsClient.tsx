"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  CalendarIcon,
  PaperAirplaneIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  PencilSquareIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
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

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "sent", label: "Sent" },
  { value: "cancelled", label: "Cancelled" },
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "sent":
      return "nx-badge-success";
    case "sending":
    case "scheduled":
      return "nx-badge-warning";
    case "cancelled":
      return "nx-badge-danger";
    default:
      return "nx-badge-neutral";
  }
}

function statusLabel(status: string): string {
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
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

  // Aggregate stats across sent campaigns for the stat strip
  const sentCampaigns = campaigns.filter((c) => c.status === "sent");
  const totalSent = sentCampaigns.reduce((acc, c) => acc + (c.stats?.sent || 0), 0);
  const totalOpened = sentCampaigns.reduce((acc, c) => acc + (c.stats?.opened || 0), 0);
  const totalClicked = sentCampaigns.reduce((acc, c) => acc + (c.stats?.clicked || 0), 0);
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

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
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Marketing
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
              Email Campaigns
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              Create and manage your email marketing campaigns.
            </p>
          </div>
          <Link
            href="/marketing/campaigns/new"
            className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            New campaign
          </Link>
        </div>

        {/* Stat Strip */}
        {sentCampaigns.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl mb-10">
            <div className="grid grid-cols-3 divide-x divide-stone-200">
              <div className="p-6 lg:p-8">
                <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                  Sent
                </p>
                <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight">
                  {totalSent.toLocaleString()}
                </p>
              </div>
              <div className="p-6 lg:p-8">
                <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                  Open Rate
                </p>
                <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight">
                  {openRate}%
                </p>
              </div>
              <div className="p-6 lg:p-8">
                <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                  Click Rate
                </p>
                <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight">
                  {clickRate}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((opt) => {
              const active = statusFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                    active
                      ? "bg-stone-900 text-white"
                      : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Campaigns List */}
        {filteredCampaigns.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <EnvelopeIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              No campaigns found
            </h3>
            <p className="text-stone-500 text-sm mb-7 max-w-sm mx-auto leading-relaxed">
              {search || statusFilter !== "all"
                ? "Try adjusting your filters to see more campaigns."
                : "Create your first email campaign to get started."}
            </p>
            {!search && statusFilter === "all" && (
              <Link
                href="/marketing/campaigns/new"
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Create campaign
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="group bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
              >
                <div className="flex items-start gap-5">
                  <div className="shrink-0 mt-1">
                    <EnvelopeIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-3">
                      <Link
                        href={`/marketing/campaigns/${campaign.id}`}
                        className="font-serif text-xl text-stone-900 leading-tight truncate hover:text-nexpura-bronze transition-colors duration-200"
                      >
                        {campaign.name}
                      </Link>
                      <span className={statusBadgeClass(campaign.status)}>
                        {statusLabel(campaign.status)}
                      </span>
                    </div>
                    <p className="text-sm text-stone-500 truncate mt-1.5 leading-relaxed">
                      {campaign.subject}
                    </p>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-4 text-xs text-stone-500">
                      {campaign.status === "sent" && campaign.sent_at ? (
                        <>
                          <span>Sent {formatDate(campaign.sent_at)}</span>
                          <span className="text-stone-300">•</span>
                          <span className="tabular-nums">
                            {campaign.stats.sent} sent
                          </span>
                          <span className="text-stone-300">•</span>
                          <span className="tabular-nums">
                            {campaign.stats.sent > 0
                              ? Math.round(
                                  (campaign.stats.opened / campaign.stats.sent) * 100
                                )
                              : 0}
                            % opened
                          </span>
                        </>
                      ) : campaign.status === "scheduled" && campaign.scheduled_at ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          Scheduled for {formatDate(campaign.scheduled_at)}
                        </span>
                      ) : (
                        <span>Created {formatDate(campaign.created_at)}</span>
                      )}
                    </div>
                  </div>

                  <div className="relative shrink-0">
                    <button
                      onClick={() =>
                        setShowMenu(showMenu === campaign.id ? null : campaign.id)
                      }
                      className="p-2 rounded-lg text-stone-400 hover:text-nexpura-bronze hover:bg-stone-50 transition-colors duration-200"
                      aria-label="Campaign actions"
                    >
                      <EllipsisVerticalIcon className="w-5 h-5" />
                    </button>

                    {showMenu === campaign.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowMenu(null)}
                        />
                        <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-stone-200 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] z-20 py-1.5">
                          <Link
                            href={`/marketing/campaigns/${campaign.id}`}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-stone-900 transition-colors duration-150"
                          >
                            <EyeIcon className="w-4 h-4 text-stone-400" />
                            View details
                          </Link>
                          {campaign.status !== "sent" &&
                            campaign.status !== "sending" && (
                              <>
                                <Link
                                  href={`/marketing/campaigns/${campaign.id}/edit`}
                                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-stone-900 transition-colors duration-150"
                                >
                                  <PencilSquareIcon className="w-4 h-4 text-stone-400" />
                                  Edit
                                </Link>
                                <button
                                  onClick={() => handleSendNow(campaign.id)}
                                  disabled={loading === campaign.id}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-stone-900 disabled:opacity-50 transition-colors duration-150"
                                >
                                  <PaperAirplaneIcon className="w-4 h-4 text-stone-400" />
                                  {loading === campaign.id ? "Sending..." : "Send now"}
                                </button>
                              </>
                            )}
                          <button
                            onClick={() => handleDuplicate(campaign.id)}
                            disabled={loading === campaign.id}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-stone-900 disabled:opacity-50 transition-colors duration-150"
                          >
                            <DocumentDuplicateIcon className="w-4 h-4 text-stone-400" />
                            Duplicate
                          </button>
                          {campaign.status !== "sending" && (
                            <>
                              <div className="my-1 border-t border-stone-100" />
                              <button
                                onClick={() => handleDelete(campaign.id)}
                                disabled={loading === campaign.id}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-red-600 disabled:opacity-50 transition-colors duration-150"
                              >
                                <TrashIcon className="w-4 h-4 text-stone-400" />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
