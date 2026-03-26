"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Calendar,
  Clock,
  Mail,
  Trash2,
  Edit,
  Play,
  Pause,
  FileText,
  BarChart3,
  Package,
  Wrench,
  DollarSign,
} from "lucide-react";

interface ScheduledReport {
  id: string;
  name: string;
  report_type: string;
  schedule_type: string;
  schedule_day: number | null;
  schedule_time: string | null;
  recipients: string[];
  include_csv: boolean;
  include_pdf: boolean;
  is_active: boolean;
  last_sent_at: string | null;
  next_run_at: string | null;
}

const REPORT_TYPES = [
  { value: "sales", label: "Sales Report", icon: BarChart3 },
  { value: "inventory", label: "Inventory Report", icon: Package },
  { value: "repairs", label: "Repairs Report", icon: Wrench },
  { value: "financial", label: "Financial Report", icon: DollarSign },
];

const SCHEDULE_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default function ScheduledReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    report_type: "sales",
    schedule_type: "weekly",
    schedule_day: 1,
    schedule_time: "09:00",
    recipients: "",
    include_csv: true,
    include_pdf: false,
  });

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    const supabase = createClient();
    const { data } = await supabase
      .from("scheduled_reports")
      .select("*")
      .order("created_at", { ascending: false });

    setReports(data || []);
    setLoading(false);
  }

  function resetForm() {
    setFormData({
      name: "",
      report_type: "sales",
      schedule_type: "weekly",
      schedule_day: 1,
      schedule_time: "09:00",
      recipients: "",
      include_csv: true,
      include_pdf: false,
    });
    setEditingReport(null);
  }

  function openEditModal(report: ScheduledReport) {
    setEditingReport(report);
    setFormData({
      name: report.name,
      report_type: report.report_type,
      schedule_type: report.schedule_type,
      schedule_day: report.schedule_day || 1,
      schedule_time: report.schedule_time || "09:00",
      recipients: (report.recipients || []).join(", "),
      include_csv: report.include_csv,
      include_pdf: report.include_pdf,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();

    const recipients = formData.recipients
      .split(",")
      .map((r) => r.trim())
      .filter((r) => r.includes("@"));

    const reportData = {
      name: formData.name,
      report_type: formData.report_type,
      schedule_type: formData.schedule_type,
      schedule_day: formData.schedule_type === "daily" ? null : formData.schedule_day,
      schedule_time: formData.schedule_time,
      recipients,
      include_csv: formData.include_csv,
      include_pdf: formData.include_pdf,
      next_run_at: calculateNextRun(formData.schedule_type, formData.schedule_day, formData.schedule_time),
    };

    startTransition(async () => {
      if (editingReport) {
        await supabase
          .from("scheduled_reports")
          .update(reportData)
          .eq("id", editingReport.id);
      } else {
        await supabase.from("scheduled_reports").insert(reportData);
      }

      setShowModal(false);
      resetForm();
      loadReports();
    });
  }

  async function toggleActive(id: string, isActive: boolean) {
    const supabase = createClient();
    await supabase
      .from("scheduled_reports")
      .update({ is_active: !isActive })
      .eq("id", id);
    loadReports();
  }

  async function deleteReport(id: string) {
    if (!confirm("Delete this scheduled report?")) return;
    const supabase = createClient();
    await supabase.from("scheduled_reports").delete().eq("id", id);
    loadReports();
  }

  function calculateNextRun(scheduleType: string, scheduleDay: number, scheduleTime: string): string {
    const now = new Date();
    const [hours, minutes] = scheduleTime.split(":").map(Number);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    if (scheduleType === "daily") {
      if (next <= now) next.setDate(next.getDate() + 1);
    } else if (scheduleType === "weekly") {
      const currentDay = next.getDay();
      let daysUntil = scheduleDay - currentDay;
      if (daysUntil <= 0 || (daysUntil === 0 && next <= now)) daysUntil += 7;
      next.setDate(next.getDate() + daysUntil);
    } else if (scheduleType === "monthly") {
      next.setDate(scheduleDay);
      if (next <= now) next.setMonth(next.getMonth() + 1);
    }

    return next.toISOString();
  }

  const getReportIcon = (type: string) => {
    const found = REPORT_TYPES.find((r) => r.value === type);
    return found ? found.icon : FileText;
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-stone-200 rounded w-48" />
          <div className="h-64 bg-stone-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Scheduled Reports</h1>
          <p className="text-stone-500 mt-1 text-sm">
            Automatically send reports to your team on a schedule
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Schedule
        </button>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <Calendar className="w-12 h-12 text-stone-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-stone-900 mb-2">No scheduled reports</h3>
          <p className="text-stone-500 text-sm mb-6">
            Set up automatic report delivery to keep your team informed
          </p>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Schedule
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const Icon = getReportIcon(report.report_type);
            return (
              <div
                key={report.id}
                className={`bg-white rounded-xl border border-stone-200 p-4 ${
                  !report.is_active ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-amber-700" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-stone-900">{report.name}</h3>
                      {!report.is_active && (
                        <span className="text-xs px-2 py-0.5 bg-stone-200 text-stone-600 rounded-full">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-stone-500 mt-0.5">
                      {REPORT_TYPES.find((r) => r.value === report.report_type)?.label} •{" "}
                      {report.schedule_type === "daily"
                        ? "Daily"
                        : report.schedule_type === "weekly"
                        ? `Weekly (${DAYS_OF_WEEK.find((d) => d.value === report.schedule_day)?.label})`
                        : `Monthly (${report.schedule_day}${getOrdinal(report.schedule_day || 1)})`}{" "}
                      at {report.schedule_time || "09:00"}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-stone-400">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {(report.recipients || []).length} recipient
                        {(report.recipients || []).length !== 1 ? "s" : ""}
                      </span>
                      {report.last_sent_at && (
                        <span>Last sent: {new Date(report.last_sent_at).toLocaleDateString()}</span>
                      )}
                      {report.next_run_at && report.is_active && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Next: {new Date(report.next_run_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(report.id, report.is_active)}
                      className="p-2 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-stone-900 transition-colors"
                      title={report.is_active ? "Pause" : "Resume"}
                    >
                      {report.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEditModal(report)}
                      className="p-2 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-stone-900 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteReport(report.id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-stone-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">
              {editingReport ? "Edit Scheduled Report" : "New Scheduled Report"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Report Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Weekly Sales Report"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                    Report Type
                  </label>
                  <select
                    value={formData.report_type}
                    onChange={(e) => setFormData({ ...formData, report_type: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {REPORT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                    Frequency
                  </label>
                  <select
                    value={formData.schedule_type}
                    onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {SCHEDULE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {formData.schedule_type !== "daily" && (
                  <div>
                    <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                      {formData.schedule_type === "weekly" ? "Day of Week" : "Day of Month"}
                    </label>
                    {formData.schedule_type === "weekly" ? (
                      <select
                        value={formData.schedule_day}
                        onChange={(e) =>
                          setFormData({ ...formData, schedule_day: parseInt(e.target.value) })
                        }
                        className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {DAYS_OF_WEEK.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={formData.schedule_day}
                        onChange={(e) =>
                          setFormData({ ...formData, schedule_day: parseInt(e.target.value) })
                        }
                        className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    )}
                  </div>
                )}

                <div className={formData.schedule_type === "daily" ? "col-span-2" : ""}>
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                    Time
                  </label>
                  <input
                    type="time"
                    value={formData.schedule_time}
                    onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Recipients (comma-separated emails)
                </label>
                <input
                  type="text"
                  value={formData.recipients}
                  onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="owner@shop.com, manager@shop.com"
                  required
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.include_csv}
                    onChange={(e) => setFormData({ ...formData, include_csv: e.target.checked })}
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                  <span className="text-sm text-stone-700">Include CSV attachment</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-stone-600 hover:text-stone-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {isPending ? "Saving..." : editingReport ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
