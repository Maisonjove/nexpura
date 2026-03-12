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
  intake: { dot: "bg-blue-400", text: "text-blue-600" },
  assessed: { dot: "bg-purple-400", text: "text-purple-600" },
  quoted: { dot: "bg-indigo-400", text: "text-indigo-600" },
  approved: { dot: "bg-green-400", text: "text-green-600" },
  in_progress: { dot: "bg-amber-400", text: "text-amber-600" },
  quality_check: { dot: "bg-orange-400", text: "text-orange-600" },
  ready: { dot: "bg-sage", text: "text-sage" },
  collected: { dot: "bg-forest", text: "text-forest" },
  cancelled: { dot: "bg-forest/30", text: "text-forest/40" },
};

const PRIORITY_MAP: Record<string, { dot: string; text: string }> = {
  low: { dot: "bg-forest/30", text: "text-forest/50" },
  normal: { dot: "bg-sage", text: "text-sage" },
  high: { dot: "bg-amber-400", text: "text-amber-600" },
  urgent: { dot: "bg-red-500", text: "text-red-600" },
};

function StageBadge({ stage }: { stage: string }) {
  const s = STAGE_MAP[stage] || { dot: "bg-forest/30", text: "text-forest/40" };
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

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/repairs"
          className="text-sm text-forest/50 hover:text-sage transition-colors"
        >
          ← Repairs
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left Panel (65%) ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <div className="bg-white border border-platinum rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <span className="text-xs font-mono text-forest/40 bg-platinum px-2 py-0.5 rounded">
                    {repair.repair_number}
                  </span>
                  <PriorityBadge priority={repair.priority} />
                  {isOverdue && (
                    <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                      ⚠ Overdue
                    </span>
                  )}
                </div>
                <h1 className="font-fraunces text-2xl font-semibold text-forest leading-tight mt-2">
                  {repair.item_type} — {repair.repair_type}
                </h1>
                {customer && (
                  <Link
                    href={`/customers/${customer.id}`}
                    className="text-sm text-forest/60 hover:text-sage transition-colors mt-1 inline-block"
                  >
                    {customer.full_name}
                  </Link>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-forest/50">
                  Repair Progress
                </span>
                <StageBadge stage={repair.stage} />
              </div>
              <div className="relative">
                <div className="h-2 bg-platinum rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sage rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  {visibleStages.map((s, i) => {
                    const idx = REPAIR_WORKFLOW_STAGES.findIndex(
                      (x) => x.key === s.key
                    );
                    const done = idx <= currentStageIndex && !isTerminal;
                    const current = s.key === repair.stage;
                    return (
                      <div
                        key={s.key}
                        className="flex flex-col items-center"
                        style={{ width: `${100 / visibleStages.length}%` }}
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${
                            current
                              ? "border-sage bg-sage scale-125"
                              : done
                              ? "border-sage bg-sage"
                              : "border-platinum bg-white"
                          }`}
                        />
                        {i % 2 === 0 && (
                          <span className="text-[9px] text-forest/30 mt-1 text-center leading-tight hidden sm:block">
                            {s.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Item Info */}
          <div className="bg-white border border-platinum rounded-xl p-6 shadow-sm">
            <h2 className="font-fraunces text-base font-semibold text-forest mb-4">
              Item Details
            </h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <dt className="text-xs font-medium text-forest/40 uppercase tracking-wider">
                  Item Type
                </dt>
                <dd className="text-sm text-forest mt-0.5 font-medium">
                  {repair.item_type}
                </dd>
              </div>
              {repair.metal_type && (
                <div>
                  <dt className="text-xs font-medium text-forest/40 uppercase tracking-wider">
                    Metal
                  </dt>
                  <dd className="text-sm text-forest mt-0.5 font-medium">
                    {repair.metal_type}
                  </dd>
                </div>
              )}
              {repair.brand && (
                <div>
                  <dt className="text-xs font-medium text-forest/40 uppercase tracking-wider">
                    Brand
                  </dt>
                  <dd className="text-sm text-forest mt-0.5 font-medium">
                    {repair.brand}
                  </dd>
                </div>
              )}
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs font-medium text-forest/40 uppercase tracking-wider">
                  Description
                </dt>
                <dd className="text-sm text-forest mt-0.5 leading-relaxed">
                  {repair.item_description}
                </dd>
              </div>
            </dl>
          </div>

          {/* Repair Specs */}
          <div className="bg-white border border-platinum rounded-xl p-6 shadow-sm">
            <h2 className="font-fraunces text-base font-semibold text-forest mb-4">
              Repair Specifications
            </h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-medium text-forest/40 uppercase tracking-wider">
                  Repair Type
                </dt>
                <dd className="text-sm text-forest mt-0.5 font-medium">
                  {repair.repair_type}
                </dd>
              </div>
              {repair.condition_notes && (
                <div className="border-t border-platinum pt-4">
                  <dt className="text-xs font-medium text-forest/40 uppercase tracking-wider mb-1">
                    Condition on Intake
                  </dt>
                  <dd className="text-sm text-forest leading-relaxed">
                    {repair.condition_notes}
                  </dd>
                </div>
              )}
              {repair.work_description && (
                <div className="border-t border-platinum pt-4">
                  <dt className="text-xs font-medium text-forest/40 uppercase tracking-wider mb-1">
                    Work Required
                  </dt>
                  <dd className="text-sm text-forest leading-relaxed">
                    {repair.work_description}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Notes */}
          {(repair.internal_notes || repair.client_notes) && (
            <div className="bg-white border border-platinum rounded-xl p-6 shadow-sm">
              <h2 className="font-fraunces text-base font-semibold text-forest mb-4">
                Notes
              </h2>
              <div className="space-y-4">
                {repair.internal_notes && (
                  <div>
                    <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-1">
                      ⚑ Internal Notes
                    </p>
                    <p className="text-sm text-forest leading-relaxed">
                      {repair.internal_notes}
                    </p>
                  </div>
                )}
                {repair.client_notes && (
                  <div className={repair.internal_notes ? "border-t border-platinum pt-4" : ""}>
                    <p className="text-xs font-medium text-forest/40 uppercase tracking-wider mb-1">
                      Client Instructions
                    </p>
                    <p className="text-sm text-forest leading-relaxed">
                      {repair.client_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stage History */}
          <div className="bg-white border border-platinum rounded-xl p-6 shadow-sm">
            <h2 className="font-fraunces text-base font-semibold text-forest mb-5">
              Stage History
            </h2>
            {stageHistory && stageHistory.length > 0 ? (
              <div className="relative pl-6">
                <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-platinum" />
                <div className="space-y-5">
                  {stageHistory.map((entry, i) => (
                    <div key={entry.id} className="relative">
                      <div
                        className={`absolute -left-[18px] w-3 h-3 rounded-full border-2 ${
                          i === stageHistory.length - 1
                            ? "border-sage bg-sage"
                            : "border-platinum bg-white"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-forest">
                            {REPAIR_WORKFLOW_STAGES.find(
                              (s) => s.key === entry.stage
                            )?.label || entry.stage}
                          </span>
                          <span className="text-xs text-forest/40">
                            {new Date(entry.created_at).toLocaleDateString(
                              "en-GB",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                        </div>
                        {entry.notes && (
                          <p className="text-sm text-forest/60 mt-0.5">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-forest/40">No stage history yet.</p>
            )}
          </div>

          {/* Intake Photos */}
          <RepairPhotos
            repairId={id}
            tenantId={tenantId}
            existingPhotos={(repair.intake_photos ?? []) as string[]}
          />
        </div>

        {/* ── Right Panel (35%) ────────────────────────────────── */}
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
          />

          {/* Edit button */}
          <Link
            href={`/repairs/${id}/edit`}
            className="w-full flex items-center justify-center gap-2 bg-white border border-forest text-forest text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-forest hover:text-white transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Edit Repair
          </Link>
        </div>
      </div>
    </div>
  );
}
