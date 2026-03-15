import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import RepairDetailClient from "@/app/(app)/repairs/[id]/RepairDetailClient";
import RepairPhotos from "@/app/(app)/repairs/[id]/RepairPhotos";
import { formatCurrency as fmt } from "@/lib/format-currency";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const DEFAULT_ID = "3d4480d1-47cc-407c-99d9-9462d93f7eca";

const REPAIR_WORKFLOW_STAGES = [
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
  const label = REPAIR_WORKFLOW_STAGES.find((x) => x.key === stage)?.label || stage;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

export default async function ReviewRepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = rawId || DEFAULT_ID;
  const adminClient = createAdminClient();
  const tenantCurrency = "AUD";

  function formatCurrency(n: number | null) {
    if (n == null) return null;
    return fmt(n, tenantCurrency);
  }

  const { data: repair } = await adminClient
    .from("repairs")
    .select(`*, customers(id, full_name, email, mobile)`)
    .eq("id", id)
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .single();

  if (!repair) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Repair Not Found</h1>
        <p className="text-stone-500">This repair doesn&apos;t exist in the demo data.</p>
      </div>
    );
  }

  const { data: invoiceRow } = await adminClient
    .from("invoices")
    .select("id")
    .eq("repair_id", id)
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const invoiceId = invoiceRow?.id ?? null;

  const { data: stageHistory } = await adminClient
    .from("repair_stages")
    .select("*")
    .eq("repair_id", id)
    .order("created_at", { ascending: true });

  const currentStageIndex = REPAIR_WORKFLOW_STAGES.findIndex((s) => s.key === repair.stage);
  const isTerminal = ["collected", "cancelled"].includes(repair.stage);
  const nextStage =
    !isTerminal && currentStageIndex < REPAIR_WORKFLOW_STAGES.length - 1
      ? REPAIR_WORKFLOW_STAGES[currentStageIndex + 1]
      : null;

  const isOverdue =
    repair.due_date &&
    new Date(repair.due_date) < new Date(new Date().toDateString()) &&
    !isTerminal;

  const customer = Array.isArray(repair.customers)
    ? repair.customers[0] ?? null
    : repair.customers;

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

  const readyStageEntry = repair.stage === "ready"
    ? stageHistory?.filter((s: { stage: string; created_at: string }) => s.stage === "ready").at(-1) ?? null
    : null;
  const hasContactInfo = !!(customer?.email || customer?.mobile);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/review/repairs" className="text-sm text-[#9A9A9A] hover:text-[#1a4731] transition-colors">
          ← Repairs
        </Link>
      </div>

      {repair.stage === "ready" && (
        <div className="mb-5 flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
          <span className="text-xl flex-shrink-0">✅</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-800">Ready for Collection</p>
            <p className="text-sm text-emerald-700 mt-0.5">Awaiting customer pickup</p>
          </div>
        </div>
      )}

      {balanceDue > 0 && !isTerminal && (
        <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <span className="text-xl flex-shrink-0">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800">Balance Due: {formatCurrency(balanceDue)}</p>
          </div>
        </div>
      )}

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

      <div className="grid grid-cols-5 gap-6 mb-6">
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
                    {isPast && <div className="w-3 h-3 bg-[#16A34A] rounded-full flex-shrink-0 z-10" />}
                    {isCurrent && <div className="w-4 h-4 bg-[#1a4731] rounded-full ring-4 ring-[#E8F0EB] flex-shrink-0 z-10 -ml-0.5" />}
                    {!isPast && !isCurrent && <div className="w-3 h-3 border-2 border-[#D0CCC7] rounded-full bg-white flex-shrink-0 z-10" />}
                    <span className={`text-sm ${isPast ? "text-[#9A9A9A] line-through" : isCurrent ? "text-[#1C1C1E] font-semibold" : "text-[#9A9A9A]"}`}>{stage}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

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
            { label: "Due Date", value: repair.due_date ? new Date(repair.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-2.5 border-b border-[#F5F3F0] last:border-0">
              <span className="text-xs text-[#9A9A9A] uppercase tracking-wide">{label}</span>
              <span className="text-sm text-[#1C1C1E] font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E8E6E1] shadow-sm p-6 mb-6">
        <p className="text-xs uppercase tracking-wide text-[#9A9A9A] mb-3">Notes &amp; Intake</p>
        <p className="text-sm text-[#6B6B6B] leading-relaxed">
          {repair.internal_notes || repair.condition_notes || repair.work_description || "No notes recorded"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RepairPhotos
            repairId={id}
            tenantId={TENANT_ID}
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
            customerMobile={customer?.mobile ?? null}
            isOverdue={!!isOverdue}
            invoiceId={invoiceId}
            currency={tenantCurrency}
            readOnly={true}
          />
        </div>
      </div>
    </div>
  );
}
