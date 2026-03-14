import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import RepairDetailClient from "./RepairDetailClient";
import RepairPhotos from "./RepairPhotos";

// All workflow stages in order
export const REPAIR_WORKFLOW_STAGES = [
  { key: "intake", label: "Intake" },
  { key: "assessed", label: "Assessed" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In Progress" },
  { key: "quality_check", label: "Quality Check" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
  { key: "cancelled", label: "Cancelled" },
];

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(n: number | null) {
  if (n == null) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
}

const STAGE_MAP: Record<string, { dot: string; text: string }> = {
  intake: { dot: "bg-stone-400", text: "text-stone-600" },
  assessed: { dot: "bg-stone-400", text: "text-stone-600" },
  quoted: { dot: "bg-stone-400", text: "text-stone-600" },
  approved: { dot: "bg-green-400", text: "text-green-600" },
  in_progress: { dot: "bg-amber-400", text: "text-amber-600" },
  quality_check: { dot: "bg-orange-400", text: "text-orange-600" },
  ready: { dot: "bg-[#8B7355]", text: "text-[#8B7355]" },
  collected: { dot: "bg-stone-900", text: "text-stone-900" },
  cancelled: { dot: "bg-stone-900/30", text: "text-stone-400" },
};

const PRIORITY_MAP: Record<string, { dot: string; text: string }> = {
  low: { dot: "bg-stone-900/30", text: "text-stone-500" },
  normal: { dot: "bg-[#8B7355]", text: "text-[#8B7355]" },
  high: { dot: "bg-amber-400", text: "text-amber-600" },
  urgent: { dot: "bg-red-500", text: "text-red-600" },
};

function StageBadge({ stage }: { stage: string }) {
  const s = STAGE_MAP[stage] || { dot: "bg-stone-900/30", text: "text-stone-400" };
  const label =
    REPAIR_WORKFLOW_STAGES.find((x) => x.key === stage)?.label || stage;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.text}`}
    >
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITY_MAP[priority] || PRIORITY_MAP.normal;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize ${p.text}`}
    >
      <span className={`w-2 h-2 rounded-full ${p.dot}`} />
      {priority}
    </span>
  );
}

export default async function RepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Get current user's tenant_id
  const { data: { user } } = await supabase.auth.getUser();
  const { data: userData } = user
    ? await supabase.from("users").select("tenant_id").eq("id", user.id).single()
    : { data: null };
  const tenantId = userData?.tenant_id ?? "";

  const { data: repair } = await supabase
    .from("repairs")
    .select(`*, customers(id, full_name, email, mobile)`)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!repair) notFound();

  const { data: invoiceRow } = await supabase
    .from("invoices")
    .select("id")
    .eq("repair_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const invoiceId = invoiceRow?.id ?? null;

  const { data: stageHistory } = await supabase
    .from("repair_stages")
    .select("*")
    .eq("repair_id", id)
    .order("created_at", { ascending: true });

  const currentStageIndex = REPAIR_WORKFLOW_STAGES.findIndex(
    (s) => s.key === repair.stage
  );

  const isTerminal = ["collected", "cancelled"].includes(repair.stage);

  const nextStage =
    !isTerminal && currentStageIndex < REPAIR_WORKFLOW_STAGES.length - 1
      ? REPAIR_WORKFLOW_STAGES[currentStageIndex + 1]
      : null;

  const isOverdue =
    repair.due_date &&
    new Date(repair.due_date) < new Date(new Date().toDateString()) &&
    !isTerminal;

  // Progress: exclude cancelled from visual bar
  const visibleStages = REPAIR_WORKFLOW_STAGES.filter(
    (s) => s.key !== "cancelled"
  );
  const visibleIndex = visibleStages.findIndex((s) => s.key === repair.stage);
  const progressPct =
    repair.stage === "cancelled"
      ? 0
      : ((visibleIndex + 1) / visibleStages.length) * 100;

  const customer = Array.isArray(repair.customers)
    ? repair.customers[0] ?? null
    : repair.customers;

  // Stage timeline for new design
  const TIMELINE_STAGES = ["Received", "Awaiting Approval", "In Workshop", "Waiting Parts", "Completed", "Ready for Pickup", "Collected"];
  const stageKeyMap: Record<string, number> = {
    intake: 0, assessed: 0, quoted: 1, approved: 2,
    in_progress: 2, quality_check: 3, ready: 4, collected: 6, cancelled: -1,
  };
  const currentTimelineIdx = stageKeyMap[repair.stage] ?? 0;

  const depositPaid = repair.deposit_paid;
  const quotedPriceNum = repair.quoted_price ?? 0;
  const depositNum = repair.deposit_amount ?? 0;
  const balanceDue = quotedPriceNum - (depositPaid ? depositNum : 0);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/repairs" className="text-sm text-[#9A9A9A] hover:text-[#1a4731] transition-colors">
          ← Repairs
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex items-start gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-light text-[#1C1C1E] font-mono">REP-{repair.id.slice(-4).toUpperCase()}</h1>
            <StageBadge stage={repair.stage} />
          </div>
          <p className="text-lg text-[#6B6B6B] mt-1">
            {customer?.full_name ?? "Unknown Customer"} · {repair.item_description || `${repair.item_type} — ${repair.repair_type}`}
          </p>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-5 gap-6 mb-6">
        {/* LEFT: Stage Timeline */}
        <div className="col-span-2 bg-white rounded-xl border border-[#E8E6E1] shadow-sm p-6">
          <p className="text-xs uppercase tracking-wide text-[#9A9A9A] mb-4">Workshop Progress</p>
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-[#E8E6E1]" />
            <div className="space-y-5">
              {TIMELINE_STAGES.map((stage, idx) => {
                const isPast = idx < currentTimelineIdx;
                const isCurrent = idx === currentTimelineIdx;
                return (
                  <div key={stage} className="flex items-center gap-3 relative">
                    {isPast && (
                      <div className="w-3 h-3 bg-[#16A34A] rounded-full flex-shrink-0 z-10" />
                    )}
                    {isCurrent && (
                      <div className="w-4 h-4 bg-[#1a4731] rounded-full ring-4 ring-[#E8F0EB] flex-shrink-0 z-10 -ml-0.5" />
                    )}
                    {!isPast && !isCurrent && (
                      <div className="w-3 h-3 border-2 border-[#D0CCC7] rounded-full bg-white flex-shrink-0 z-10" />
                    )}
                    <span className={`text-sm ${
                      isPast ? "text-[#9A9A9A] line-through" :
                      isCurrent ? "text-[#1C1C1E] font-semibold" :
                      "text-[#9A9A9A]"
                    }`}>{stage}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Job Details */}
        <div className="col-span-3 bg-white rounded-xl border border-[#E8E6E1] shadow-sm p-6">
          <p className="text-xs uppercase tracking-wide text-[#9A9A9A] mb-4">Job Details</p>
          {[
            { label: "Customer Name", value: customer?.full_name ?? "—" },
            { label: "Phone", value: customer?.mobile ?? "—" },
            { label: "Item Description", value: repair.item_description || repair.item_type },
            { label: "Issue", value: repair.repair_type },
            { label: "Quoted Price", value: repair.quoted_price != null ? formatCurrency(repair.quoted_price) : "—" },
            { label: "Deposit Paid", value: repair.deposit_amount != null ? `${formatCurrency(repair.deposit_amount)} ${repair.deposit_paid ? "(Paid)" : "(Pending)"}` : "—" },
            { label: "Balance Due", value: balanceDue > 0 ? formatCurrency(balanceDue) : "—" },
            { label: "Assigned To", value: (repair as { assigned_to?: string }).assigned_to ?? "—" },
            { label: "Due Date", value: repair.due_date ? new Date(repair.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-2.5 border-b border-[#F5F3F0] last:border-0">
              <span className="text-xs text-[#9A9A9A] uppercase tracking-wide">{label}</span>
              <span className="text-sm text-[#1C1C1E] font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Notes card */}
      <div className="bg-white rounded-xl border border-[#E8E6E1] shadow-sm p-6 mb-6">
        <p className="text-xs uppercase tracking-wide text-[#9A9A9A] mb-3">Notes &amp; Intake</p>
        <p className="text-sm text-[#6B6B6B] leading-relaxed">
          {repair.internal_notes || repair.condition_notes || repair.work_description || "No notes recorded"}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        <button className="px-5 py-2.5 bg-[#1a4731] text-white text-sm font-medium rounded-lg hover:bg-[#1a4731]/90 transition-colors">Mark as Ready</button>
        <button className="px-5 py-2.5 border border-[#E8E6E1] text-sm font-medium rounded-lg hover:bg-[#F8F7F5] transition-colors">Send Update</button>
        <button className="px-5 py-2.5 border border-[#E8E6E1] text-sm font-medium rounded-lg hover:bg-[#F8F7F5] transition-colors">Print Ticket</button>
        <button className="px-5 py-2.5 text-sm font-medium text-[#6B6B6B] rounded-lg hover:bg-[#F8F7F5] transition-colors">Add Note</button>
      </div>

      {/* Actions panel + photos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RepairPhotos
            repairId={id}
            tenantId={tenantId}
            existingPhotos={(repair.intake_photos ?? []) as string[]}
          />
        </div>
        <div className="space-y-4">
          <RepairDetailClient
            repairId={id}
            currentStage={repair.stage}
            nextStage={nextStage}
            dueDate={repair.due_date}
            priority={repair.priority}
            quotedPrice={formatCurrency(repair.quoted_price)}
            quotedPriceRaw={repair.quoted_price ?? null}
            finalPrice={formatCurrency(repair.final_price)}
            depositAmount={formatCurrency(repair.deposit_amount)}
            depositPaid={repair.deposit_paid}
            customerName={customer?.full_name ?? null}
            customerId={customer?.id ?? null}
            customerEmail={customer?.email ?? null}
            isOverdue={!!isOverdue}
            invoiceId={invoiceId}
          />
          <Link
            href={`/repairs/${id}/edit`}
            className="w-full flex items-center justify-center gap-2 bg-white border border-[#E8E6E1] text-[#1C1C1E] text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-[#F8F7F5] transition-all"
          >
            Edit Repair
          </Link>
        </div>
      </div>
    </div>
  );
}
