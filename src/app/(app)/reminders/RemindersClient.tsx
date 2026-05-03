"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  Clock,
  Gift,
  Heart,
  Package,
  ListTodo,
  CreditCard,
  Phone,
  Mail,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Calendar,
  Check,
  X,
  Moon,
} from "lucide-react";
import { snoozeReminder, dismissReminder, completeReminder } from "./actions";

/**
 * Per-row action toolbar — Group 14 audit fix. Pre-fix /reminders had
 * no list-level actions; staff had to navigate to each source page.
 * The buttons here stop pointer propagation so clicking them doesn't
 * trigger the parent <Link>'s navigation.
 *
 * - Snooze: pops a small day-picker (1d/3d/1w/30d), persists to
 *   reminder_dismissals with snoozed_until = now + N days.
 * - Dismiss: persists with dismissed_at = now and audit-logs.
 * - Complete: only meaningful for task reminders (key prefix
 *   "task:"). Hidden for other types — those use the source-page
 *   "complete" action via the ChevronRight link.
 *
 * Optimistic UI: the parent re-renders after the server action's
 * revalidatePath completes; in the interim we hide the row locally
 * via the `onActioned` callback the parent supplies.
 */
function ReminderActions({
  reminderKey,
  canComplete,
  onActioned,
}: {
  reminderKey: string;
  canComplete: boolean;
  onActioned: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [showSnooze, setShowSnooze] = useState(false);

  function handle(label: "snooze" | "dismiss" | "complete", days?: number) {
    startTransition(async () => {
      let r;
      if (label === "snooze") r = await snoozeReminder(reminderKey, days ?? 1);
      else if (label === "dismiss") r = await dismissReminder(reminderKey);
      else r = await completeReminder(reminderKey);
      if (r?.error) {
        alert(r.error);
        return;
      }
      onActioned();
    });
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {showSnooze ? (
        <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-md px-1 py-0.5">
          {[
            { label: "1d", days: 1 },
            { label: "3d", days: 3 },
            { label: "1w", days: 7 },
            { label: "30d", days: 30 },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              disabled={pending}
              onClick={(e) => { e.preventDefault(); handle("snooze", opt.days); setShowSnooze(false); }}
              className="text-xs font-mono px-1.5 py-0.5 rounded hover:bg-amber-50 text-stone-700 disabled:opacity-50"
              title={`Snooze ${opt.label}`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setShowSnooze(false); }}
            className="text-xs text-stone-400 hover:text-stone-700 px-1"
            aria-label="Cancel snooze"
          >
            ×
          </button>
        </div>
      ) : (
        <>
          {canComplete && (
            <button
              type="button"
              disabled={pending}
              onClick={(e) => { e.preventDefault(); handle("complete"); }}
              title="Mark complete"
              aria-label="Mark complete"
              className="p-1.5 rounded text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={(e) => { e.preventDefault(); setShowSnooze(true); }}
            title="Snooze"
            aria-label="Snooze"
            className="p-1.5 rounded text-stone-400 hover:text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={(e) => { e.preventDefault(); handle("dismiss"); }}
            title="Dismiss"
            aria-label="Dismiss"
            className="p-1.5 rounded text-stone-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  priority: string;
  status: string;
  related_type: string | null;
  related_id: string | null;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
}

interface ReadyRepair {
  id: string;
  repair_number: string;
  item_description: string | null;
  stage: string;
  tracking_id: string | null;
  customer: Customer | null;
}

interface ReadyBespoke {
  id: string;
  bespoke_number: string;
  description: string | null;
  stage: string;
  tracking_id: string | null;
  customer: Customer | null;
}

interface UpcomingLayby {
  id: string;
  layby_number: string;
  total_amount: number;
  amount_paid: number;
  next_payment_due: string;
  customer: Customer | null;
}

interface CustomerEvent {
  type: "birthday" | "anniversary";
  customerId: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  date: string;
  daysUntil: number;
}

interface Props {
  tasks: Task[];
  readyRepairs: ReadyRepair[];
  readyBespoke: ReadyBespoke[];
  upcomingLaybys: UpcomingLayby[];
  customerEvents: CustomerEvent[];
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return `In ${diffDays} days`;
  return date.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-stone-100 text-stone-600",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-red-50 text-red-700",
};

export default function RemindersClient({
  tasks,
  readyRepairs,
  readyBespoke,
  upcomingLaybys,
  customerEvents,
}: Props) {
  const [activeTab, setActiveTab] = useState<"all" | "tasks" | "pickups" | "laybys" | "events">("all");
  // Optimistically hide a reminder the moment its server action returns
  // (revalidatePath handles the canonical re-render but the user
  // shouldn't see a delay).
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const hideKey = (key: string) => setHiddenKeys((prev) => {
    const next = new Set(prev);
    next.add(key);
    return next;
  });
  const isHidden = (key: string) => hiddenKeys.has(key);

  const totalReminders =
    tasks.length + readyRepairs.length + readyBespoke.length + upcomingLaybys.length + customerEvents.length;

  const tabs = [
    { id: "all", label: "All", count: totalReminders },
    { id: "tasks", label: "Tasks", count: tasks.length, icon: ListTodo },
    { id: "pickups", label: "Ready for Pickup", count: readyRepairs.length + readyBespoke.length, icon: Package },
    { id: "laybys", label: "Layby Payments", count: upcomingLaybys.length, icon: CreditCard },
    { id: "events", label: "Customer Events", count: customerEvents.length, icon: Gift },
  ];

  return (
    <div className="min-h-screen bg-stone-50/50 px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-amber-100 rounded-xl">
            <Bell className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <h1 className="text-2xl font-serif text-stone-900">Reminders</h1>
            <p className="text-sm text-stone-500">
              {totalReminders === 0
                ? "You're all caught up!"
                : `${totalReminders} items need your attention`}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
            }`}
          >
            {tab.icon && <tab.icon className="w-4 h-4" />}
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? "bg-white/20" : "bg-stone-100"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {totalReminders === 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-lg font-medium text-stone-900 mb-2">All caught up!</h2>
          <p className="text-stone-500 text-sm max-w-md mx-auto">
            No pending reminders. Check back later or{" "}
            <Link href="/tasks" className="text-stone-900 underline">
              create a new task
            </Link>
            .
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Tasks Section */}
        {(activeTab === "all" || activeTab === "tasks") && tasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ListTodo className="w-5 h-5 text-stone-400" />
              <h2 className="font-medium text-stone-900">Upcoming Tasks</h2>
              <span className="text-xs text-stone-400">({tasks.length})</span>
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
              {tasks.filter((t) => !isHidden(`task:${t.id}`)).map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks?task=${task.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-stone-50 transition-colors"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      task.priority === "urgent"
                        ? "bg-red-500"
                        : task.priority === "high"
                        ? "bg-orange-500"
                        : "bg-amber-400"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-900 truncate">{task.title}</p>
                    {task.description && (
                      <p className="text-sm text-stone-500 truncate">{task.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-stone-400" />
                    <span
                      className={
                        new Date(task.due_date) < new Date() ? "text-red-600" : "text-stone-500"
                      }
                    >
                      {formatDueDate(task.due_date)}
                    </span>
                  </div>
                  <ReminderActions
                    reminderKey={`task:${task.id}`}
                    canComplete
                    onActioned={() => hideKey(`task:${task.id}`)}
                  />
                  <ChevronRight className="w-4 h-4 text-stone-300" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Ready for Pickup Section */}
        {(activeTab === "all" || activeTab === "pickups") &&
          (readyRepairs.length > 0 || readyBespoke.length > 0) && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-5 h-5 text-stone-400" />
                <h2 className="font-medium text-stone-900">Ready for Collection</h2>
                <span className="text-xs text-stone-400">
                  ({readyRepairs.length + readyBespoke.length})
                </span>
              </div>
              <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
                {readyRepairs.filter((r) => !isHidden(`repair:${r.id}`)).map((repair) => (
                  <Link
                    key={repair.id}
                    href={`/repairs/${repair.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <Package className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-900">
                        {repair.repair_number} — Repair Ready
                      </p>
                      <p className="text-sm text-stone-500 truncate">
                        {repair.item_description || "No description"}
                        {repair.customer &&
                          ` • ${repair.customer.first_name} ${repair.customer.last_name}`}
                      </p>
                    </div>
                    {repair.customer?.phone && (
                      <a
                        href={`tel:${repair.customer.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 hover:bg-stone-100 rounded-lg"
                      >
                        <Phone className="w-4 h-4 text-stone-400" />
                      </a>
                    )}
                    <ReminderActions
                      reminderKey={`repair:${repair.id}`}
                      canComplete={false}
                      onActioned={() => hideKey(`repair:${repair.id}`)}
                    />
                    <ChevronRight className="w-4 h-4 text-stone-300" />
                  </Link>
                ))}
                {readyBespoke.filter((b) => !isHidden(`bespoke:${b.id}`)).map((job) => (
                  <Link
                    key={job.id}
                    href={`/bespoke/${job.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-900">
                        {job.bespoke_number} — Bespoke Ready
                      </p>
                      <p className="text-sm text-stone-500 truncate">
                        {job.description || "Custom piece"}
                        {job.customer && ` • ${job.customer.first_name} ${job.customer.last_name}`}
                      </p>
                    </div>
                    {job.customer?.phone && (
                      <a
                        href={`tel:${job.customer.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 hover:bg-stone-100 rounded-lg"
                      >
                        <Phone className="w-4 h-4 text-stone-400" />
                      </a>
                    )}
                    <ReminderActions
                      reminderKey={`bespoke:${job.id}`}
                      canComplete={false}
                      onActioned={() => hideKey(`bespoke:${job.id}`)}
                    />
                    <ChevronRight className="w-4 h-4 text-stone-300" />
                  </Link>
                ))}
              </div>
            </section>
          )}

        {/* Layby Payments Section */}
        {(activeTab === "all" || activeTab === "laybys") && upcomingLaybys.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-5 h-5 text-stone-400" />
              <h2 className="font-medium text-stone-900">Upcoming Layby Payments</h2>
              <span className="text-xs text-stone-400">({upcomingLaybys.length})</span>
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
              {upcomingLaybys.filter((l) => !isHidden(`layby:${l.id}`)).map((layby) => {
                const remaining = layby.total_amount - layby.amount_paid;
                return (
                  <Link
                    key={layby.id}
                    href={`/laybys/${layby.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-900">{layby.layby_number}</p>
                      <p className="text-sm text-stone-500">
                        {layby.customer
                          ? `${layby.customer.first_name} ${layby.customer.last_name}`
                          : "Unknown customer"}{" "}
                        • {formatCurrency(remaining)} remaining
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-stone-900">
                        {formatDueDate(layby.next_payment_due)}
                      </p>
                      <p className="text-xs text-stone-400">Next payment</p>
                    </div>
                    <ReminderActions
                      reminderKey={`layby:${layby.id}`}
                      canComplete={false}
                      onActioned={() => hideKey(`layby:${layby.id}`)}
                    />
                    <ChevronRight className="w-4 h-4 text-stone-300" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Customer Events Section */}
        {(activeTab === "all" || activeTab === "events") && customerEvents.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-5 h-5 text-stone-400" />
              <h2 className="font-medium text-stone-900">Upcoming Customer Events</h2>
              <span className="text-xs text-stone-400">({customerEvents.length})</span>
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
              {customerEvents.filter((e) => !isHidden(`customer_${e.type}:${e.customerId}`)).map((event, idx) => (
                <Link
                  key={`${event.customerId}-${event.type}-${idx}`}
                  href={`/customers/${event.customerId}`}
                  className="flex items-center gap-4 p-4 hover:bg-stone-50 transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      event.type === "birthday" ? "bg-pink-100" : "bg-red-100"
                    }`}
                  >
                    {event.type === "birthday" ? (
                      <Gift className="w-5 h-5 text-pink-600" />
                    ) : (
                      <Heart className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-900">{event.customerName}</p>
                    <p className="text-sm text-stone-500">
                      {event.type === "birthday" ? "Birthday" : "Anniversary"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${
                        event.daysUntil === 0 ? "text-green-600" : "text-stone-900"
                      }`}
                    >
                      {event.daysUntil === 0
                        ? "Today"
                        : event.daysUntil === 1
                        ? "Tomorrow"
                        : `In ${event.daysUntil} days`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {event.phone && (
                      <a
                        href={`tel:${event.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 hover:bg-stone-100 rounded-lg"
                      >
                        <Phone className="w-4 h-4 text-stone-400" />
                      </a>
                    )}
                    {event.email && (
                      <a
                        href={`mailto:${event.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 hover:bg-stone-100 rounded-lg"
                      >
                        <Mail className="w-4 h-4 text-stone-400" />
                      </a>
                    )}
                  </div>
                  <ReminderActions
                    reminderKey={`customer_${event.type}:${event.customerId}`}
                    canComplete={false}
                    onActioned={() => hideKey(`customer_${event.type}:${event.customerId}`)}
                  />
                  <ChevronRight className="w-4 h-4 text-stone-300" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/tasks?new=true"
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-full text-sm font-medium hover:bg-stone-800 transition-colors"
        >
          <ListTodo className="w-4 h-4" />
          Create Task
        </Link>
        <Link
          href="/settings/reminders"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 text-stone-700 rounded-full text-sm font-medium hover:bg-stone-50 transition-colors"
        >
          <Calendar className="w-4 h-4" />
          Service Reminder Settings
        </Link>
      </div>
    </div>
  );
}
