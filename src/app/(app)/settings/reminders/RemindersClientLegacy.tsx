"use client";

import { useState } from "react";
import { Bell, Mail, Clock, ShieldCheck, Gift, Heart, MessageSquare, Plus, X, Check, AlertCircle } from "lucide-react";
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
  birthday: Gift,
  anniversary: Heart,
  purchase_anniversary: ShieldCheck,
  layby_due: Clock,
  service_due: Bell,
  default: Bell,
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
      // Client-side destructive write. Same pattern as RemindersClient.tsx —
      // revert optimistic state on failure + error toast so UI matches server.
      const { error } = await supabase
        .from("service_reminders")
        .update({ status: newStatus })
        .eq("id", reminder.id)
        .eq("tenant_id", tenantId);
      if (error) {
        setReminders((prev) =>
          prev.map((r) => (r.id === reminder.id ? { ...r, status: reminder.status } : r))
        );
        showToast(`Failed to update: ${error.message}`);
        return;
      }
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
      // Client-side destructive write. Same pattern as RemindersClient.tsx —
      // surface error toast on failure; full optimistic-rollback would
      // require pre-edit row snapshotting (acceptable trade-off here).
      const { error } = await supabase
        .from("service_reminders")
        .update(editForm)
        .eq("id", editingId)
        .eq("tenant_id", tenantId);
      if (error) {
        showToast(`Failed to save: ${error.message}`);
        setSaving(false);
        return;
      }
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
      // Client-side destructive write. Same pattern as RemindersClient.tsx —
      // restore the deleted row on failure so local state matches server.
      const { error } = await supabase
        .from("service_reminders")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) {
        const restored = reminders.find((r) => r.id === id);
        if (restored) setReminders((prev) => [...prev, restored]);
        showToast(`Failed to delete: ${error.message}`);
        return;
      }
    }

    showToast("Reminder deleted");
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-stone-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <Check size={14} className="text-green-400" />
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Service Reminders</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Automated notifications sent to customers based on events or dates
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 transition-colors"
        >
          <Plus size={14} />
          Create Reminder
        </button>
      </div>

      {/* DB status notice */}
      {!tableExists && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-800">Database table pending setup</p>
            <p className="text-amber-700 mt-0.5">
              Changes are displayed locally but not yet persisted. Run{" "}
              <code className="bg-amber-100 px-1 rounded font-mono text-xs">node create-service-reminders.mjs</code>{" "}
              or apply the migration in your Supabase dashboard to enable full persistence.
            </p>
          </div>
        </div>
      )}

      {/* New reminder form */}
      {showNewForm && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-stone-900">New Reminder</h2>
            <button onClick={() => setShowNewForm(false)} className="text-stone-400 hover:text-stone-600">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Name</label>
              <input
                value={newForm.name || ""}
                onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/20 focus:border-amber-500"
                placeholder="Reminder name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Trigger</label>
              <select
                value={newForm.trigger_type || "birthday"}
                onChange={(e) => setNewForm((p) => ({ ...p, trigger_type: e.target.value }))}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/20 focus:border-amber-500"
              >
                <option value="birthday">Birthday</option>
                <option value="anniversary">Anniversary</option>
                <option value="purchase_anniversary">After Purchase</option>
                <option value="layby_due">Layby Due</option>
                <option value="service_due">Service Due</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Channel</label>
              <select
                value={newForm.channel || "email"}
                onChange={(e) => setNewForm((p) => ({ ...p, channel: e.target.value }))}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/20 focus:border-amber-500"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="both">Email + SMS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Subject</label>
              <input
                value={newForm.subject || ""}
                onChange={(e) => setNewForm((p) => ({ ...p, subject: e.target.value }))}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/20 focus:border-amber-500"
                placeholder="Email subject line"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Message</label>
            <textarea
              value={newForm.body || ""}
              onChange={(e) => setNewForm((p) => ({ ...p, body: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/20 focus:border-amber-500"
              placeholder="Use {first_name}, {business_name}, {amount} as variables"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 text-sm border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createReminder}
              disabled={saving || !newForm.name}
              className="px-4 py-2 text-sm bg-nexpura-charcoal text-white rounded-lg hover:bg-nexpura-charcoal-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Reminder"}
            </button>
          </div>
        </div>
      )}

      {/* Reminders list */}
      <div className="grid grid-cols-1 gap-4">
        {reminders.map((rem) => {
          const Icon = ICON_MAP[rem.trigger_type] || ICON_MAP.default;
          const isEditing = editingId === rem.id;

          return (
            <div
              key={rem.id}
              className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm hover:border-amber-600/30 transition-colors"
            >
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    value={editForm.name ?? rem.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/20 focus:border-amber-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Channel</label>
                      <select
                        value={editForm.channel ?? rem.channel}
                        onChange={(e) => setEditForm((p) => ({ ...p, channel: e.target.value }))}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/20"
                      >
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="both">Email + SMS</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Subject</label>
                      <input
                        value={editForm.subject ?? rem.subject ?? ""}
                        onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/20"
                        placeholder="Email subject"
                      />
                    </div>
                  </div>
                  <textarea
                    value={editForm.body ?? rem.body ?? ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, body: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/20"
                    placeholder="Message body"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setEditingId(null); setEditForm({}); }}
                      className="px-3 py-1.5 text-xs border border-stone-200 rounded-lg hover:bg-stone-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs bg-nexpura-charcoal text-white rounded-lg hover:bg-nexpura-charcoal-700 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      rem.status === "active" ? "bg-amber-700/10 text-amber-700" : "bg-stone-100 text-stone-400"
                    }`}
                  >
                    <Icon size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-stone-900">{rem.name}</h3>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          rem.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-stone-100 text-stone-400"
                        }`}
                      >
                        {rem.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-stone-500">
                      <span className="flex items-center gap-1">
                        <Bell size={12} /> {rem.type}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {TRIGGER_LABELS[rem.trigger_type] || rem.trigger_type}
                        {rem.trigger_value ? ` (${rem.trigger_value})` : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        {rem.channel === "sms" ? (
                          <MessageSquare size={12} />
                        ) : (
                          <Mail size={12} />
                        )}
                        {rem.channel === "both" ? "Email + SMS" : rem.channel === "sms" ? "SMS" : "Email"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => toggleStatus(rem)}
                      className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                        rem.status === "active"
                          ? "border-stone-200 text-stone-600 hover:bg-stone-50"
                          : "border-amber-300 text-amber-700 hover:bg-amber-50"
                      }`}
                    >
                      {rem.status === "active" ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(rem.id);
                        setEditForm({ name: rem.name, channel: rem.channel, subject: rem.subject, body: rem.body });
                      }}
                      className="px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteReminder(rem.id)}
                      className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
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
          <div className="text-center py-12 text-stone-500">
            <Bell size={32} className="mx-auto mb-3 text-stone-300" />
            <p className="text-sm">No reminders configured yet.</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="mt-3 text-sm text-amber-700 hover:underline"
            >
              Create your first reminder
            </button>
          </div>
        )}
      </div>

      {/* Template preview */}
      <div className="bg-white rounded-2xl border border-stone-200 p-8 space-y-6">
        <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <Mail size={20} className="text-amber-700" />
          Template Variables
        </h2>
        <p className="text-sm text-stone-500">Use these placeholders in your reminder templates — they&apos;ll be replaced with real data when sent.</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["{first_name}", "Customer's first name"],
            ["{full_name}", "Customer's full name"],
            ["{business_name}", "Your business name"],
            ["{amount}", "Relevant amount (e.g. layby balance)"],
            ["{due_date}", "Due date"],
            ["{item_description}", "Item description"],
          ].map(([variable, desc]) => (
            <div key={variable} className="flex items-center gap-2 p-3 bg-stone-50 rounded-lg border border-stone-200">
              <code className="text-xs font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{variable}</code>
              <span className="text-xs text-stone-500">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
