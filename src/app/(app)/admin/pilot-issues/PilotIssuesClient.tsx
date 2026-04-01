"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Filter,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { createPilotIssue, updatePilotIssue, deletePilotIssue } from "./actions";
import {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  type IssueCategory,
  type IssueSeverity,
  type IssueStatus,
  type PilotIssue,
} from "./types";

interface Props {
  issues: PilotIssue[];
  tenants: { id: string; name: string }[];
  currentUserId: string;
  currentUserEmail: string | null;
}

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  pos: "POS",
  invoices_payments: "Invoices / Payments",
  repairs: "Repairs",
  bespoke: "Bespoke",
  inventory: "Inventory",
  customers_crm: "Customers / CRM",
  tasks_workshop: "Tasks / Workshop",
  intake: "Intake",
  website_storefront: "Website / Storefront",
  billing: "Billing",
  migration_import: "Migration / Import",
  ai_features: "AI Features",
  settings_printing_docs: "Settings / Printing / Docs",
  reports_eod: "Reports / EOD",
  performance: "Performance",
  security: "Security",
  ux_frontend: "UX / Frontend",
  other: "Other",
};

const SEVERITY_COLORS: Record<IssueSeverity, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-blue-100 text-blue-800 border-blue-200",
};

const STATUS_COLORS: Record<IssueStatus, string> = {
  new: "bg-purple-100 text-purple-800",
  needs_repro: "bg-pink-100 text-pink-800",
  confirmed: "bg-red-100 text-red-800",
  in_progress: "bg-amber-100 text-amber-800",
  fixed: "bg-green-100 text-green-800",
  retest_needed: "bg-cyan-100 text-cyan-800",
  closed: "bg-stone-100 text-stone-600",
  not_a_bug: "bg-stone-100 text-stone-500",
};

const STATUS_LABELS: Record<IssueStatus, string> = {
  new: "New",
  needs_repro: "Needs Repro",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  fixed: "Fixed",
  retest_needed: "Re-Test Needed",
  closed: "Closed",
  not_a_bug: "Not a Bug",
};

// Prefill data from URL params (e.g. from verification page)
interface PrefillData {
  title?: string;
  route_path?: string;
  category?: IssueCategory;
  steps_to_reproduce?: string;
  expected_result?: string;
  actual_result?: string;
}

export default function PilotIssuesClient({ issues, tenants, currentUserId, currentUserEmail }: Props) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<IssueCategory | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<IssueSeverity | "all">("all");
  const [filterStatus, setFilterStatus] = useState<IssueStatus | "all">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingIssue, setEditingIssue] = useState<PilotIssue | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copySuccess, setCopySuccess] = useState(false);
  const [prefillData, setPrefillData] = useState<PrefillData | null>(null);

  // Check for prefill params on mount
  useEffect(() => {
    if (searchParams.get("prefill") === "true") {
      const data: PrefillData = {};
      if (searchParams.get("title")) data.title = searchParams.get("title")!;
      if (searchParams.get("route_path")) data.route_path = searchParams.get("route_path")!;
      if (searchParams.get("category")) data.category = searchParams.get("category") as IssueCategory;
      if (searchParams.get("steps_to_reproduce")) data.steps_to_reproduce = searchParams.get("steps_to_reproduce")!;
      if (searchParams.get("expected_result")) data.expected_result = searchParams.get("expected_result")!;
      if (searchParams.get("actual_result")) data.actual_result = searchParams.get("actual_result")!;
      
      if (Object.keys(data).length > 0) {
        setPrefillData(data);
        setShowCreateModal(true);
      }
    }
  }, [searchParams]);

  // Filter issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !issue.title.toLowerCase().includes(q) &&
          !issue.description?.toLowerCase().includes(q) &&
          !issue.route_path?.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (filterCategory !== "all" && issue.category !== filterCategory) return false;
      if (filterSeverity !== "all" && issue.severity !== filterSeverity) return false;
      if (filterStatus !== "all" && issue.status !== filterStatus) return false;
      return true;
    });
  }, [issues, search, filterCategory, filterSeverity, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const openStatuses: IssueStatus[] = ["new", "needs_repro", "confirmed", "in_progress", "retest_needed"];
    const openIssues = issues.filter((i) => openStatuses.includes(i.status));
    const criticalOpen = openIssues.filter((i) => i.severity === "critical");
    const highOpen = openIssues.filter((i) => i.severity === "high");
    const blocking = issues.filter((i) => i.is_pilot_blocking && openStatuses.includes(i.status));

    // Fixed this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const fixedThisWeek = issues.filter(
      (i) => i.status === "fixed" && i.fixed_at && new Date(i.fixed_at) > weekAgo
    );

    // By category
    const byCategory = new Map<IssueCategory, number>();
    for (const i of openIssues) {
      byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + 1);
    }

    // By status
    const byStatus = new Map<IssueStatus, number>();
    for (const i of issues) {
      byStatus.set(i.status, (byStatus.get(i.status) ?? 0) + 1);
    }

    return {
      total: issues.length,
      open: openIssues.length,
      critical: criticalOpen.length,
      high: highOpen.length,
      blocking: blocking.length,
      fixedThisWeek: fixedThisWeek.length,
      byCategory,
      byStatus,
    };
  }, [issues]);

  // Critical blockers
  const blockers = useMemo(() => {
    const openStatuses: IssueStatus[] = ["new", "needs_repro", "confirmed", "in_progress", "retest_needed"];
    return issues.filter(
      (i) =>
        openStatuses.includes(i.status) &&
        (i.severity === "critical" || i.severity === "high" || i.is_pilot_blocking)
    );
  }, [issues]);

  // Export functions
  const formatIssueForExport = (issue: PilotIssue) => {
    return `## ${issue.title}
- **ID:** ${issue.id}
- **Severity:** ${issue.severity.toUpperCase()}
- **Status:** ${STATUS_LABELS[issue.status]}
- **Category:** ${CATEGORY_LABELS[issue.category]}
- **Route:** ${issue.route_path || "N/A"}
- **Reported by:** ${issue.reported_by || "Unknown"}
- **Tenant:** ${issue.tenant_name || "N/A"}
${issue.is_pilot_blocking ? "- **⚠️ PILOT BLOCKING**" : ""}

### Description
${issue.description || "No description"}

### Steps to Reproduce
${issue.steps_to_reproduce || "Not provided"}

### Expected Result
${issue.expected_result || "Not provided"}

### Actual Result
${issue.actual_result || "Not provided"}

${issue.fix_notes ? `### Fix Notes\n${issue.fix_notes}` : ""}
---
`;
  };

  const copyIssues = async (issuesToCopy: PilotIssue[]) => {
    const text = issuesToCopy.map(formatIssueForExport).join("\n");
    await navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const exportAsJSON = (issuesToExport: PilotIssue[]) => {
    const json = JSON.stringify(issuesToExport, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pilot-issues-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 nx-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Pilot Issues Triage</h1>
          <p className="text-sm text-stone-500 mt-1">Internal bug tracking for controlled pilot</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="nx-btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Report Issue
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard label="Total Open" value={stats.open} icon={<Bug size={20} />} color="stone" />
        <StatCard
          label="Critical"
          value={stats.critical}
          icon={<AlertTriangle size={20} />}
          color="red"
          highlight={stats.critical > 0}
        />
        <StatCard
          label="High"
          value={stats.high}
          icon={<AlertTriangle size={20} />}
          color="orange"
          highlight={stats.high > 0}
        />
        <StatCard
          label="Blocking"
          value={stats.blocking}
          icon={<XCircle size={20} />}
          color="red"
          highlight={stats.blocking > 0}
        />
        <StatCard label="Fixed This Week" value={stats.fixedThisWeek} icon={<CheckCircle2 size={20} />} color="green" />
        <StatCard label="Total Issues" value={stats.total} icon={<Clock size={20} />} color="stone" />
      </div>

      {/* Critical Blockers Section */}
      {blockers.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="text-red-600" size={20} />
            <h2 className="font-semibold text-red-900">Critical / High Priority Queue ({blockers.length})</h2>
          </div>
          <div className="space-y-2">
            {blockers.slice(0, 5).map((issue) => (
              <div
                key={issue.id}
                className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-red-100"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${SEVERITY_COLORS[issue.severity]}`}>
                    {issue.severity}
                  </span>
                  <span className="font-medium text-stone-900">{issue.title}</span>
                  {issue.is_pilot_blocking && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">BLOCKING</span>
                  )}
                </div>
                <button
                  onClick={() => setEditingIssue(issue)}
                  className="text-xs text-amber-700 hover:underline"
                >
                  View
                </button>
              </div>
            ))}
            {blockers.length > 5 && (
              <p className="text-xs text-red-600 mt-2">+ {blockers.length - 5} more critical/high issues</p>
            )}
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-stone-200 rounded-xl p-4">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={16} className="text-stone-400" />
          <input
            type="text"
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border-0 focus:ring-0 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-stone-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as IssueCategory | "all")}
            className="text-sm border-stone-200 rounded-lg"
          >
            <option value="all">All Categories</option>
            {ISSUE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as IssueSeverity | "all")}
            className="text-sm border-stone-200 rounded-lg"
          >
            <option value="all">All Severities</option>
            {ISSUE_SEVERITIES.map((sev) => (
              <option key={sev} value={sev}>
                {sev.charAt(0).toUpperCase() + sev.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as IssueStatus | "all")}
            className="text-sm border-stone-200 rounded-lg"
          >
            <option value="all">All Statuses</option>
            {ISSUE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Export Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => copyIssues(filteredIssues.filter((i) => !["closed", "not_a_bug", "fixed"].includes(i.status)))}
          className="text-xs px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1"
        >
          <Copy size={14} />
          {copySuccess ? "Copied!" : "Copy Open Issues"}
        </button>
        <button
          onClick={() => copyIssues(blockers)}
          className="text-xs px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg flex items-center gap-1"
        >
          <Copy size={14} />
          Copy Critical/High
        </button>
        <button
          onClick={() => exportAsJSON(filteredIssues)}
          className="text-xs px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1"
        >
          <Download size={14} />
          Export JSON
        </button>
        <a
          href="/admin/pilot-issues"
          className="text-xs px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1 ml-auto"
        >
          <RefreshCw size={14} />
          Refresh
        </a>
      </div>

      {/* Issues List */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <span className="text-sm font-medium text-stone-700">
            {filteredIssues.length} issue{filteredIssues.length !== 1 ? "s" : ""}
          </span>
        </div>
        {filteredIssues.length === 0 ? (
          <div className="px-6 py-12 text-center text-stone-400">
            {issues.length === 0 ? "No issues reported yet. 🎉" : "No issues match your filters."}
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className="px-4 py-3 hover:bg-stone-50 cursor-pointer flex items-center gap-4"
                onClick={() => setEditingIssue(issue)}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(issue.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    const newSet = new Set(selectedIds);
                    if (e.target.checked) newSet.add(issue.id);
                    else newSet.delete(issue.id);
                    setSelectedIds(newSet);
                  }}
                  className="rounded border-stone-300"
                />
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${SEVERITY_COLORS[issue.severity]}`}>
                  {issue.severity}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[issue.status]}`}>
                  {STATUS_LABELS[issue.status]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-stone-900 truncate">{issue.title}</div>
                  <div className="text-xs text-stone-500 flex items-center gap-2 mt-0.5">
                    <span>{CATEGORY_LABELS[issue.category]}</span>
                    {issue.route_path && (
                      <>
                        <span>•</span>
                        <span className="font-mono">{issue.route_path}</span>
                      </>
                    )}
                    {issue.tenant_name && (
                      <>
                        <span>•</span>
                        <span>{issue.tenant_name}</span>
                      </>
                    )}
                  </div>
                </div>
                {issue.assigned_to && (
                  <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                    → {issue.assigned_to}
                  </span>
                )}
                {issue.is_pilot_blocking && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">BLOCKING</span>
                )}
                <span className="text-xs text-stone-400">
                  {new Date(issue.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <IssueModal
          tenants={tenants}
          currentUserEmail={currentUserEmail}
          prefill={prefillData ?? undefined}
          onClose={() => {
            setShowCreateModal(false);
            setPrefillData(null);
          }}
          onSave={async (data) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await createPilotIssue(data as any);
            if (!result.error) {
              setShowCreateModal(false);
              setPrefillData(null);
            }
            return result;
          }}
        />
      )}

      {/* Edit Modal */}
      {editingIssue && (
        <IssueModal
          issue={editingIssue}
          tenants={tenants}
          currentUserEmail={currentUserEmail}
          onClose={() => setEditingIssue(null)}
          onSave={async (data) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await updatePilotIssue({ id: editingIssue.id, ...data } as any);
            if (!result.error) {
              setEditingIssue(null);
            }
            return result;
          }}
          onDelete={async () => {
            if (confirm("Delete this issue?")) {
              await deletePilotIssue(editingIssue.id);
              setEditingIssue(null);
            }
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  highlight?: boolean;
}) {
  const bgColors: Record<string, string> = {
    stone: "bg-stone-50",
    red: "bg-red-50",
    orange: "bg-orange-50",
    green: "bg-green-50",
  };
  const textColors: Record<string, string> = {
    stone: "text-stone-600",
    red: "text-red-600",
    orange: "text-orange-600",
    green: "text-green-600",
  };
  return (
    <div className={`rounded-xl p-4 ${bgColors[color]} ${highlight ? "ring-2 ring-red-400" : ""}`}>
      <div className={`flex items-center gap-2 ${textColors[color]}`}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-2xl font-bold mt-1 ${textColors[color]}`}>{value}</div>
    </div>
  );
}

function IssueModal({
  issue,
  tenants,
  currentUserEmail,
  onClose,
  onSave,
  onDelete,
  prefill,
}: {
  issue?: PilotIssue;
  tenants: { id: string; name: string }[];
  currentUserEmail: string | null;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<{ error?: string }>;
  onDelete?: () => void;
  prefill?: PrefillData;
}) {
  const [title, setTitle] = useState(issue?.title ?? prefill?.title ?? "");
  const [description, setDescription] = useState(issue?.description ?? "");
  const [routePath, setRoutePath] = useState(issue?.route_path ?? prefill?.route_path ?? "");
  const [category, setCategory] = useState<IssueCategory>(issue?.category ?? prefill?.category ?? "other");
  const [severity, setSeverity] = useState<IssueSeverity>(issue?.severity ?? "medium");
  const [status, setStatus] = useState<IssueStatus>(issue?.status ?? "new");
  const [isBlocking, setIsBlocking] = useState(issue?.is_pilot_blocking ?? false);
  const [reportedBy, setReportedBy] = useState(issue?.reported_by ?? currentUserEmail ?? "");
  const [tenantId, setTenantId] = useState(issue?.tenant_id ?? "");
  const [stepsToReproduce, setStepsToReproduce] = useState(issue?.steps_to_reproduce ?? prefill?.steps_to_reproduce ?? "");
  const [expectedResult, setExpectedResult] = useState(issue?.expected_result ?? prefill?.expected_result ?? "");
  const [actualResult, setActualResult] = useState(issue?.actual_result ?? prefill?.actual_result ?? "");
  const [fixNotes, setFixNotes] = useState(issue?.fix_notes ?? "");
  const [fixedInCommit, setFixedInCommit] = useState(issue?.fixed_in_commit ?? "");
  const [assignedTo, setAssignedTo] = useState(issue?.assigned_to ?? "");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachments, setAttachments] = useState<string[]>(issue?.attachments ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");
    const tenant = tenants.find((t) => t.id === tenantId);
    const result = await onSave({
      title,
      description,
      route_path: routePath,
      category,
      severity,
      status,
      is_pilot_blocking: isBlocking,
      reported_by: reportedBy,
      tenant_id: tenantId || undefined,
      tenant_name: tenant?.name,
      steps_to_reproduce: stepsToReproduce,
      expected_result: expectedResult,
      actual_result: actualResult,
      fix_notes: fixNotes,
      fixed_in_commit: fixedInCommit,
      assigned_to: assignedTo || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{issue ? "Edit Issue" : "Report New Issue"}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            ×
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border-stone-200 rounded-lg"
              placeholder="Brief description of the issue"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as IssueCategory)}
                className="w-full border-stone-200 rounded-lg"
              >
                {ISSUE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
                className="w-full border-stone-200 rounded-lg"
              >
                {ISSUE_SEVERITIES.map((sev) => (
                  <option key={sev} value={sev}>
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {issue && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as IssueStatus)}
                  className="w-full border-stone-200 rounded-lg"
                >
                  {ISSUE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isBlocking}
                    onChange={(e) => setIsBlocking(e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  <span className="text-sm font-medium text-red-700">Pilot Blocking</span>
                </label>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Route / Page</label>
              <input
                type="text"
                value={routePath}
                onChange={(e) => setRoutePath(e.target.value)}
                className="w-full border-stone-200 rounded-lg font-mono text-sm"
                placeholder="/pos, /repairs/[id]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Pilot Tenant</label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full border-stone-200 rounded-lg"
              >
                <option value="">— None —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Reported By</label>
              <input
                type="text"
                value={reportedBy}
                onChange={(e) => setReportedBy(e.target.value)}
                className="w-full border-stone-200 rounded-lg"
                placeholder="Name or email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Assigned To</label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full border-stone-200 rounded-lg"
                placeholder="Name or email of assignee"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border-stone-200 rounded-lg"
              placeholder="Detailed description of the issue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Steps to Reproduce</label>
            <textarea
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              rows={3}
              className="w-full border-stone-200 rounded-lg"
              placeholder="1. Go to /pos&#10;2. Add item to cart&#10;3. Click checkout"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Expected Result</label>
              <textarea
                value={expectedResult}
                onChange={(e) => setExpectedResult(e.target.value)}
                rows={2}
                className="w-full border-stone-200 rounded-lg"
                placeholder="What should have happened"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Actual Result</label>
              <textarea
                value={actualResult}
                onChange={(e) => setActualResult(e.target.value)}
                rows={2}
                className="w-full border-stone-200 rounded-lg"
                placeholder="What actually happened"
              />
            </div>
          </div>

          {issue && (
            <>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Fix Notes</label>
                <textarea
                  value={fixNotes}
                  onChange={(e) => setFixNotes(e.target.value)}
                  rows={2}
                  className="w-full border-stone-200 rounded-lg"
                  placeholder="How the issue was fixed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Fixed in Commit</label>
                <input
                  type="text"
                  value={fixedInCommit}
                  onChange={(e) => setFixedInCommit(e.target.value)}
                  className="w-full border-stone-200 rounded-lg font-mono text-sm"
                  placeholder="abc1234"
                />
              </div>
            </>
          )}

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Screenshots / Attachments</label>
            <div className="flex gap-2 mb-2">
              <input
                type="url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                className="flex-1 border-stone-200 rounded-lg text-sm"
                placeholder="Paste image URL (e.g. from Imgur, Cloudinary, etc.)"
              />
              <button
                type="button"
                onClick={() => {
                  if (attachmentUrl.trim()) {
                    setAttachments([...attachments, attachmentUrl.trim()]);
                    setAttachmentUrl("");
                  }
                }}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm"
              >
                Add
              </button>
            </div>
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-sm text-blue-600 hover:underline truncate"
                    >
                      {url}
                    </a>
                    <button
                      type="button"
                      onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-stone-400 mt-1">Upload screenshots to Imgur, Cloudinary, or any image host and paste URLs here.</p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-stone-200 flex items-center justify-between bg-stone-50">
          {issue && onDelete ? (
            <button onClick={onDelete} className="text-sm text-red-600 hover:underline">
              Delete Issue
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="nx-btn-primary">
              {saving ? "Saving..." : issue ? "Update Issue" : "Create Issue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
