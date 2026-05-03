"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  UsersIcon,
  PlusIcon,
  StarIcon,
  ClockIcon,
  UserMinusIcon,
  WrenchIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
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
  vip: <StarIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />,
  new: <ClockIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />,
  lapsed: <UserMinusIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />,
  repair: <WrenchIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />,
  high_value: <CurrencyDollarIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />,
  custom: <UsersIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />,
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
    <div className="bg-nexpura-ivory min-h-screen">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div className="flex items-start gap-4">
            <Link
              href="/marketing"
              className="mt-2 text-stone-400 hover:text-nexpura-bronze transition-colors duration-300"
              aria-label="Back to marketing"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div>
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                Marketing
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight">
                Customer Segments
              </h1>
              <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
                Target specific groups of customers for campaigns and personalised outreach.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            New Segment
          </button>
        </div>

        {/* Pre-built Segments */}
        <div className="mb-14">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-luxury mb-6">
            Pre-built Segments
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {systemSegments.map((segment) => (
              <div
                key={segment.id}
                className="group nx-card hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
              >
                <div className="flex items-start gap-5">
                  <div className="shrink-0 mt-0.5">
                    {getSegmentIcon(segment.rules)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif text-xl text-stone-900 leading-tight">{segment.name}</h3>
                    <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
                      {segment.description || getSegmentDescription(segment.rules)}
                    </p>
                    <div className="flex items-center gap-5 mt-4">
                      <span className="text-sm text-stone-700">
                        {segment.customer_count} customer{segment.customer_count !== 1 ? "s" : ""}
                      </span>
                      <button
                        onClick={() => handleRefresh(segment.id)}
                        disabled={loading === `refresh-${segment.id}`}
                        className="text-xs text-nexpura-bronze hover:text-nexpura-bronze-hover flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
                      >
                        <ArrowPathIcon
                          className={`w-3.5 h-3.5 ${loading === `refresh-${segment.id}` ? "animate-spin" : ""}`}
                        />
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
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-luxury mb-6">
            Custom Segments
          </h2>
          {customSegments.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
              <UsersIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
              <h3 className="font-serif text-2xl text-stone-900 mb-3">No custom segments</h3>
              <p className="text-stone-500 text-sm mb-7 max-w-sm mx-auto leading-relaxed">
                Create custom segments to target specific groups of customers with tailored campaigns.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Create Segment
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {customSegments.map((segment) => (
                <div
                  key={segment.id}
                  className="group nx-card hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-5">
                      <div className="shrink-0 mt-0.5">
                        {getSegmentIcon(segment.rules)}
                      </div>
                      <div>
                        <h3 className="font-serif text-xl text-stone-900 leading-tight">{segment.name}</h3>
                        <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
                          {segment.description || getSegmentDescription(segment.rules)}
                        </p>
                        <div className="flex items-center gap-5 mt-4">
                          <span className="text-sm text-stone-700">
                            {segment.customer_count} customer{segment.customer_count !== 1 ? "s" : ""}
                          </span>
                          <button
                            onClick={() => handleRefresh(segment.id)}
                            disabled={loading === `refresh-${segment.id}`}
                            className="text-xs text-nexpura-bronze hover:text-nexpura-bronze-hover flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
                          >
                            <ArrowPathIcon
                              className={`w-3.5 h-3.5 ${loading === `refresh-${segment.id}` ? "animate-spin" : ""}`}
                            />
                            Refresh
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(segment.id, segment.name)}
                      disabled={loading === segment.id}
                      className="text-stone-400 hover:text-red-500 transition-colors duration-200 disabled:opacity-50"
                      aria-label={`Delete ${segment.name}`}
                    >
                      {loading === segment.id ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        <TrashIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.12)] w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
              <h2 className="font-serif text-2xl text-stone-900">Create Segment</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-stone-700 transition-colors duration-200"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Segment Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Big Spenders"
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Segment Type
                </label>
                <select
                  value={formData.rule_type}
                  onChange={(e) => setFormData({ ...formData, rule_type: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
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
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
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
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200 -mx-6 px-6 -mb-6 pb-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading === "create" || !formData.name}
                  className="nx-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === "create" ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="w-4 h-4" />
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
