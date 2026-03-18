"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Plus,
  Star,
  Clock,
  UserMinus,
  Wrench,
  DollarSign,
  RefreshCw,
  Edit,
  Trash2,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { createSegment, deleteSegment, refreshSegmentCount } from "./actions";

interface Segment {
  id: string;
  name: string;
  description: string | null;
  rules: Record<string, unknown>;
  is_system: boolean;
  customer_count: number;
  created_at: string;
}

interface Props {
  segments: Segment[];
  tenantId: string;
}

const SEGMENT_ICONS: Record<string, React.ReactNode> = {
  vip: <Star className="w-5 h-5 text-amber-400" />,
  new: <Clock className="w-5 h-5 text-green-400" />,
  lapsed: <UserMinus className="w-5 h-5 text-red-400" />,
  repair: <Wrench className="w-5 h-5 text-blue-400" />,
  high_value: <DollarSign className="w-5 h-5 text-purple-400" />,
  custom: <Users className="w-5 h-5 text-stone-400" />,
};

export default function SegmentsClient({ segments, tenantId }: Props) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    rule_type: "custom" as string,
    rule_value: "",
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name) return;

    setLoading("create");

    const rules: Record<string, unknown> = { type: formData.rule_type };
    if (formData.rule_type === "new") {
      rules.days = parseInt(formData.rule_value) || 30;
    } else if (formData.rule_type === "lapsed") {
      rules.months = parseInt(formData.rule_value) || 6;
    } else if (formData.rule_type === "high_value") {
      rules.amount = parseInt(formData.rule_value) || 1000;
    } else if (formData.rule_type === "vip") {
      rules.percentile = parseInt(formData.rule_value) || 10;
    }

    const result = await createSegment({
      name: formData.name,
      description: formData.description || undefined,
      rules,
    });

    if (result.error) {
      alert(result.error);
    } else {
      setShowCreateModal(false);
      setFormData({ name: "", description: "", rule_type: "custom", rule_value: "" });
    }

    setLoading(null);
    router.refresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete segment "${name}"? This cannot be undone.`)) return;

    setLoading(id);
    const result = await deleteSegment(id);
    if (result.error) {
      alert(result.error);
    }
    setLoading(null);
    router.refresh();
  }

  async function handleRefresh(id: string) {
    setLoading(`refresh-${id}`);
    await refreshSegmentCount(id);
    setLoading(null);
    router.refresh();
  }

  function getSegmentIcon(rules: Record<string, unknown>) {
    const type = (rules.type as string) || "custom";
    return SEGMENT_ICONS[type] || SEGMENT_ICONS.custom;
  }

  function getSegmentDescription(rules: Record<string, unknown>) {
    const type = (rules.type as string) || "custom";
    switch (type) {
      case "vip":
        return `Top ${rules.percentile || 10}% by total spend`;
      case "new":
        return `Joined in last ${rules.days || 30} days`;
      case "lapsed":
        return `No purchase in ${rules.months || 6}+ months`;
      case "repair":
        return "Has active or past repairs";
      case "high_value":
        return `Single purchase over $${rules.amount || 1000}`;
      default:
        return "Custom segment";
    }
  }

  const systemSegments = segments.filter((s) => s.is_system);
  const customSegments = segments.filter((s) => !s.is_system);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/marketing"
            className="p-2 hover:bg-white/[0.05] rounded-lg text-stone-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Customer Segments</h1>
            <p className="text-stone-400 text-sm mt-1">
              Target specific groups of customers for campaigns
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Segment
        </button>
      </div>

      {/* Pre-built Segments */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-stone-300 uppercase tracking-wide mb-4">
          Pre-built Segments
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {systemSegments.map((segment) => (
            <div
              key={segment.id}
              className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center">
                  {getSegmentIcon(segment.rules)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white">{segment.name}</h3>
                  <p className="text-sm text-stone-400 mt-0.5">
                    {segment.description || getSegmentDescription(segment.rules)}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-sm text-stone-500">
                      {segment.customer_count} customer{segment.customer_count !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() => handleRefresh(segment.id)}
                      disabled={loading === `refresh-${segment.id}`}
                      className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      {loading === `refresh-${segment.id}` ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Segments */}
      <div>
        <h2 className="text-sm font-semibold text-stone-300 uppercase tracking-wide mb-4">
          Custom Segments
        </h2>
        {customSegments.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-8 text-center">
            <Users className="w-12 h-12 text-stone-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No custom segments</h3>
            <p className="text-stone-400 text-sm mb-4">
              Create custom segments to target specific groups of customers
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Segment
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {customSegments.map((segment) => (
              <div
                key={segment.id}
                className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center">
                      {getSegmentIcon(segment.rules)}
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{segment.name}</h3>
                      <p className="text-sm text-stone-400 mt-0.5">
                        {segment.description || getSegmentDescription(segment.rules)}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm text-stone-500">
                          {segment.customer_count} customer{segment.customer_count !== 1 ? "s" : ""}
                        </span>
                        <button
                          onClick={() => handleRefresh(segment.id)}
                          disabled={loading === `refresh-${segment.id}`}
                          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                        >
                          {loading === `refresh-${segment.id}` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          Refresh
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(segment.id, segment.name)}
                    disabled={loading === segment.id}
                    className="p-2 hover:bg-red-500/10 text-stone-400 hover:text-red-400 rounded-lg transition-colors"
                  >
                    {loading === segment.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-white/[0.1] rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-lg font-semibold text-white">Create Segment</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">
                  Segment Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Big Spenders"
                  className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">
                  Segment Type
                </label>
                <select
                  value={formData.rule_type}
                  onChange={(e) => setFormData({ ...formData, rule_type: e.target.value })}
                  className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                >
                  <option value="new">New Customers (by days)</option>
                  <option value="lapsed">Lapsed Customers (by months)</option>
                  <option value="high_value">High Value (by amount)</option>
                  <option value="vip">VIP (by percentile)</option>
                  <option value="repair">Repair Customers</option>
                </select>
              </div>

              {["new", "lapsed", "high_value", "vip"].includes(formData.rule_type) && (
                <div>
                  <label className="block text-sm font-medium text-stone-300 mb-1">
                    {formData.rule_type === "new" && "Joined within (days)"}
                    {formData.rule_type === "lapsed" && "Inactive for (months)"}
                    {formData.rule_type === "high_value" && "Minimum purchase ($)"}
                    {formData.rule_type === "vip" && "Top percentile (%)"}
                  </label>
                  <input
                    type="number"
                    value={formData.rule_value}
                    onChange={(e) => setFormData({ ...formData, rule_value: e.target.value })}
                    placeholder={
                      formData.rule_type === "new"
                        ? "30"
                        : formData.rule_type === "lapsed"
                        ? "6"
                        : formData.rule_type === "high_value"
                        ? "1000"
                        : "10"
                    }
                    className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-stone-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading === "create" || !formData.name}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white rounded-lg font-medium transition-colors"
                >
                  {loading === "create" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Create
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
