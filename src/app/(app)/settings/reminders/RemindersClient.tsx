"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BellIcon,
  EnvelopeIcon,
  ClockIcon,
  ShieldCheckIcon,
  GiftIcon,
  HeartIcon,
  ChatBubbleLeftRightIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { createClient } from "@/lib/supabase/client";

type Reminder = {
  id: string;
  name: string;
  type: string;
  trigger_type: string;
  trigger_value?: string | null;
  status: string;
  channel: string;
  subject?: string | null;
  body?: string | null;
};

const ICON_MAP: Record<string, React.ElementType> = {
  birthday: GiftIcon,
  anniversary: HeartIcon,
  purchase_anniversary: ShieldCheckIcon,
  layby_due: ClockIcon,
  service_due: BellIcon,
  default: BellIcon,
};

const TRIGGER_LABELS: Record<string, string> = {
  birthday: "On Birthday",
  anniversary: "On Anniversary",
  purchase_anniversary: "After Purchase",
  layby_due: "Before Layby Due Date",
  service_due: "Service Due",
};

interface RemindersClientProps {
  initialReminders: Reminder[];
  tenantId: string | null;
  tableExists: boolean;
}

export default function RemindersClient({ initialReminders, tenantId, tableExists }: RemindersClientProps) {
  const [reminders, setReminders] = useState(initialReminders);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Reminder>>({});
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<Partial<Reminder>>({
    name: "",
    type: "Event",
    trigger_type: "birthday",
    status: "active",
    channel: "email",
    subject: "",
    body: "",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const supabase = createClient();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function toggleStatus(reminder: Reminder) {
    const newStatus = reminder.status === "active" ? "inactive" : "active";

    // Optimistic update
    setReminders((prev) =>
      prev.map((r) => (r.id === reminder.id ? { ...r, status: newStatus } : r))
    );

    if (tableExists && tenantId && !reminder.id.startsWith("default-")) {
      await supabase
        .from("service_reminders")
        .update({ status: newStatus })
        .eq("id", reminder.id)
        .eq("tenant_id", tenantId);
    }

    showToast(newStatus === "active" ? "Reminder activated" : "Reminder deactivated");
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);

    setReminders((prev) =>
      prev.map((r) => (r.id === editingId ? { ...r, ...editForm } : r))
    );

    if (tableExists && tenantId && !editingId.startsWith("default-")) {
      await supabase
        .from("service_reminders")
        .update(editForm)
        .eq("id", editingId)
        .eq("tenant_id", tenantId);
    }

    setEditingId(null);
    setEditForm({});
    setSaving(false);
    showToast("Reminder updated");
  }

  async function createReminder() {
    if (!newForm.name) return;
    setSaving(true);

    const newReminder: Reminder = {
      id: `local-${Date.now()}`,
      name: newForm.name || "",
      type: newForm.type || "Event",
      trigger_type: newForm.trigger_type || "birthday",
      trigger_value: newForm.trigger_value,
      status: "active",
      channel: newForm.channel || "email",
      subject: newForm.subject,
      body: newForm.body,
    };

    if (tableExists && tenantId) {
      const { data, error } = await supabase
        .from("service_reminders")
        .insert({
          tenant_id: tenantId,
          name: newForm.name,
          type: newForm.type || "event",
          trigger_type: newForm.trigger_type || "birthday",
          trigger_value: newForm.trigger_value,
          status: "active",
          channel: newForm.channel || "email",
          subject: newForm.subject,
          body: newForm.body,
        })
        .select()
        .single();

      if (!error && data) {
        newReminder.id = data.id;
      }
    }

    setReminders((prev) => [...prev, newReminder]);
    setShowNewForm(false);
    setNewForm({ name: "", type: "Event", trigger_type: "birthday", status: "active", channel: "email" });
    setSaving(false);
    showToast("Reminder created");
  }

  async function deleteReminder(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));

    if (tableExists && tenantId && !id.startsWith("default-")) {
      await supabase
        .from("service_reminders")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);
    }

    showToast("Reminder deleted");
  }

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200";

  return (
    <div className="bg-nexpura-ivory min-h-screen">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Toast */}
        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-stone-900 text-white px-4 py-3 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.18)] text-sm font-medium flex items-center gap-2">
            <CheckIcon className="w-4 h-4 text-emerald-400" />
            {toast}
          </div>
        )}

        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div className="flex items-start gap-4">
            <Link
              href="/settings"
              className="mt-2 p-2 -ml-2 rounded-md text-stone-500 hover:text-stone-700 transition-colors duration-200"
              aria-label="Back to settings"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div>
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-4">
                Settings
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-[3.25rem] text-stone-900 leading-[1.1]">
                Service Reminders
              </h1>
              <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
                Automated notifications sent to customers based on events and dates — birthdays, anniversaries, layby due dates, and more.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            New Reminder
          </button>
        </div>

        {/* DB status notice */}
        {!tableExists && (
          <div className="flex items-start gap-3 px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm mb-10">
            <ExclamationCircleIcon className="w-5 h-5 text-stone-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-stone-900">Database table pending setup</p>
              <p className="text-stone-600 mt-1 leading-relaxed">
                Changes are displayed locally but not yet persisted. Run{" "}
                <code className="bg-white border border-stone-200 px-1.5 py-0.5 rounded font-mono text-xs text-stone-700">
                  node create-service-reminders.mjs
                </code>{" "}
                or apply the migration in your Supabase dashboard to enable full persistence.
              </p>
            </div>
          </div>
        )}

        {/* New reminder form */}
        {showNewForm && (
          <div className="nx-card mb-10 p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl text-stone-900">New Reminder</h2>
              <button
                onClick={() => setShowNewForm(false)}
                className="p-1.5 rounded-md text-stone-400 hover:text-stone-700 transition-colors duration-200"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Name</label>
                <input
                  value={newForm.name || ""}
                  onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))}
                  className={inputClass}
                  placeholder="Reminder name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Trigger</label>
                <select
                  value={newForm.trigger_type || "birthday"}
                  onChange={(e) => setNewForm((p) => ({ ...p, trigger_type: e.target.value }))}
                  className={inputClass}
                >
                  <option value="birthday">Birthday</option>
                  <option value="anniversary">Anniversary</option>
                  <option value="purchase_anniversary">After Purchase</option>
                  <option value="layby_due">Layby Due</option>
                  <option value="service_due">Service Due</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Channel</label>
                <select
                  value={newForm.channel || "email"}
                  onChange={(e) => setNewForm((p) => ({ ...p, channel: e.target.value }))}
                  className={inputClass}
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="both">Email + SMS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Subject</label>
                <input
                  value={newForm.subject || ""}
                  onChange={(e) => setNewForm((p) => ({ ...p, subject: e.target.value }))}
                  className={inputClass}
                  placeholder="Email subject line"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Message</label>
              <textarea
                value={newForm.body || ""}
                onChange={(e) => setNewForm((p) => ({ ...p, body: e.target.value }))}
                rows={3}
                className={inputClass}
                placeholder="Use {first_name}, {business_name}, {amount} as variables"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 rounded-md text-sm font-medium border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={createReminder}
                disabled={saving || !newForm.name}
                className="nx-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Creating…" : "Create Reminder"}
              </button>
            </div>
          </div>
        )}

        {/* Section label */}
        {reminders.length > 0 && (
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-luxury mb-6">
            Configured Reminders
          </h2>
        )}

        {/* Reminders list */}
        <div className="space-y-3">
          {reminders.map((rem) => {
            const Icon = ICON_MAP[rem.trigger_type] || ICON_MAP.default;
            const isEditing = editingId === rem.id;
            const isActive = rem.status === "active";

            return (
              <div
                key={rem.id}
                className="nx-card hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
              >
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">Name</label>
                      <input
                        value={editForm.name ?? rem.name}
                        onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1.5">Channel</label>
                        <select
                          value={editForm.channel ?? rem.channel}
                          onChange={(e) => setEditForm((p) => ({ ...p, channel: e.target.value }))}
                          className={inputClass}
                        >
                          <option value="email">Email</option>
                          <option value="sms">SMS</option>
                          <option value="both">Email + SMS</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1.5">Subject</label>
                        <input
                          value={editForm.subject ?? rem.subject ?? ""}
                          onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))}
                          className={inputClass}
                          placeholder="Email subject"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">Message</label>
                      <textarea
                        value={editForm.body ?? rem.body ?? ""}
                        onChange={(e) => setEditForm((p) => ({ ...p, body: e.target.value }))}
                        rows={3}
                        className={inputClass}
                        placeholder="Message body"
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditForm({});
                        }}
                        className="px-4 py-2 rounded-md text-sm font-medium border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="nx-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-5">
                    <Icon
                      className={`w-6 h-6 mt-1 shrink-0 ${
                        isActive ? "text-nexpura-bronze" : "text-stone-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                        <h3 className="font-medium text-stone-900 text-base">{rem.name}</h3>
                        <span className={isActive ? "nx-badge-success" : "nx-badge-neutral"}>
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-stone-500">
                        <span className="flex items-center gap-1.5">
                          <BellIcon className="w-3.5 h-3.5 text-stone-400" />
                          {rem.type}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <ClockIcon className="w-3.5 h-3.5 text-stone-400" />
                          {TRIGGER_LABELS[rem.trigger_type] || rem.trigger_type}
                          {rem.trigger_value ? ` (${rem.trigger_value})` : ""}
                        </span>
                        <span className="flex items-center gap-1.5">
                          {rem.channel === "sms" ? (
                            <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-stone-400" />
                          ) : (
                            <EnvelopeIcon className="w-3.5 h-3.5 text-stone-400" />
                          )}
                          {rem.channel === "both" ? "Email + SMS" : rem.channel === "sms" ? "SMS" : "Email"}
                        </span>
                      </div>
                      {rem.subject && (
                        <p className="text-sm text-stone-700 mt-3 truncate">
                          <span className="text-stone-400">Subject:</span> {rem.subject}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        onClick={() => toggleStatus(rem)}
                        className="px-3.5 py-1.5 rounded-md text-xs font-medium border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200"
                      >
                        {isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(rem.id);
                          setEditForm({
                            name: rem.name,
                            channel: rem.channel,
                            subject: rem.subject,
                            body: rem.body,
                          });
                        }}
                        className="px-3.5 py-1.5 rounded-md text-xs font-medium border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteReminder(rem.id)}
                        className="px-3.5 py-1.5 rounded-md text-xs font-medium text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors duration-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {reminders.length === 0 && (
            <div className="bg-white border border-stone-200 rounded-2xl p-16 text-center">
              <BellIcon className="w-10 h-10 text-stone-300 mx-auto mb-6" />
              <h3 className="font-serif text-2xl text-stone-900 mb-3">No reminders yet</h3>
              <p className="text-stone-500 text-sm mb-7 max-w-sm mx-auto leading-relaxed">
                Set up automated reminders to keep customers engaged on birthdays, anniversaries, and key service dates.
              </p>
              <button
                onClick={() => setShowNewForm(true)}
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Create your first reminder
              </button>
            </div>
          )}
        </div>

        {/* Template variables */}
        <div className="mt-16">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-luxury mb-6">
            Template Variables
          </h2>
          <div className="nx-card p-8">
            <div className="mb-7">
              <h3 className="font-serif text-xl text-stone-900 flex items-center gap-2.5">
                <EnvelopeIcon className="w-5 h-5 text-stone-400" />
                Personalisation tokens
              </h3>
              <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                Use these placeholders in your reminder templates — they&apos;ll be replaced with real customer data when sent.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {[
                ["{first_name}", "Customer's first name"],
                ["{full_name}", "Customer's full name"],
                ["{business_name}", "Your business name"],
                ["{amount}", "Relevant amount (e.g. layby balance)"],
                ["{due_date}", "Due date"],
                ["{item_description}", "Item description"],
              ].map(([variable, desc]) => (
                <div
                  key={variable}
                  className="flex items-center gap-3 py-2"
                >
                  <code className="bg-stone-50 border border-stone-200 px-2 py-0.5 rounded font-mono text-[0.75rem] text-stone-700 shrink-0">
                    {variable}
                  </code>
                  <span className="text-xs text-stone-600">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
