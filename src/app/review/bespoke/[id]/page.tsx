import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import JobDetailClient from "@/app/(app)/bespoke/[id]/JobDetailClient";
import JobPhotos from "@/app/(app)/bespoke/[id]/JobPhotos";
import { formatCurrency as fmt } from "@/lib/format-currency";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const DEFAULT_ID = "4db9a53d-5300-40f6-96fb-e89ccb3ebee3";

const WORKFLOW_STAGES = [
  { key: "enquiry", label: "Enquiry" },
  { key: "consultation", label: "Consultation" },
  { key: "deposit_paid", label: "Deposit Paid" },
  { key: "stone_sourcing", label: "Stone Sourcing" },
  { key: "cad", label: "CAD" },
  { key: "approval", label: "Approval" },
  { key: "setting", label: "Setting" },
  { key: "polish", label: "Polish" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
  { key: "cancelled", label: "Cancelled" },
];

const STAGE_MAP: Record<string, { dot: string; text: string }> = {
  enquiry: { dot: "bg-stone-400", text: "text-stone-600" },
  consultation: { dot: "bg-blue-400", text: "text-blue-600" },
  deposit_paid: { dot: "bg-emerald-400", text: "text-emerald-600" },
  stone_sourcing: { dot: "bg-yellow-400", text: "text-yellow-600" },
  cad: { dot: "bg-orange-400", text: "text-orange-600" },
  approval: { dot: "bg-purple-400", text: "text-purple-600" },
  setting: { dot: "bg-amber-400", text: "text-amber-600" },
  polish: { dot: "bg-stone-400", text: "text-stone-600" },
  ready: { dot: "bg-[#8B7355]", text: "text-[#8B7355]" },
  collected: { dot: "bg-stone-900", text: "text-stone-900" },
  cancelled: { dot: "bg-stone-900/30", text: "text-stone-400" },
};

const ALL_STAGES_LABELS: Record<string, string> = {
  enquiry: "Enquiry", consultation: "Consultation", deposit_paid: "Deposit Paid",
  stone_sourcing: "Stone Sourcing", cad: "CAD", approval: "Approval",
  setting: "Setting", polish: "Polish", ready: "Ready",
  collected: "Collected", cancelled: "Cancelled",
};

function StageBadge({ stage }: { stage: string }) {
  const s = STAGE_MAP[stage] || { dot: "bg-stone-900/30", text: "text-stone-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {ALL_STAGES_LABELS[stage] || stage}
    </span>
  );
}

const PRIORITY_MAP: Record<string, { dot: string; text: string }> = {
  low: { dot: "bg-stone-900/30", text: "text-stone-500" },
  normal: { dot: "bg-[#8B7355]", text: "text-[#8B7355]" },
  high: { dot: "bg-amber-400", text: "text-amber-600" },
  urgent: { dot: "bg-red-500", text: "text-red-600" },
};

function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITY_MAP[priority] || PRIORITY_MAP.normal;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize ${p.text}`}>
      <span className={`w-2 h-2 rounded-full ${p.dot}`} />
      {priority}
    </span>
  );
}

function humanise(val: string | null | undefined) {
  if (!val) return null;
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ReviewBespokeDetailPage({
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

  const { data: job } = await adminClient
    .from("bespoke_jobs")
    .select(`*, customers(id, full_name, email, mobile)`)
    .eq("id", id)
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .single();

  if (!job) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Job Not Found</h1>
        <p className="text-stone-500">This bespoke job doesn&apos;t exist in the demo data.</p>
      </div>
    );
  }

  const { data: invoiceRow } = await adminClient
    .from("invoices")
    .select("id")
    .eq("bespoke_job_id", id)
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const invoiceId = invoiceRow?.id ?? null;

  const { data: stageHistory } = await adminClient
    .from("bespoke_job_stages")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: true });

  const currentStageIndex = WORKFLOW_STAGES.findIndex((s) => s.key === job.stage);
  const nextStage =
    job.stage !== "collected" && job.stage !== "cancelled"
      ? WORKFLOW_STAGES[Math.min(currentStageIndex + 1, WORKFLOW_STAGES.length - 1)]
      : null;

  const isOverdue =
    job.due_date &&
    new Date(job.due_date) < new Date(new Date().toDateString()) &&
    !["collected", "cancelled"].includes(job.stage);

  const specs: { label: string; value: string }[] = [];
  if (job.jewellery_type) specs.push({ label: "Type", value: humanise(job.jewellery_type) ?? "" });
  if (job.metal_type) specs.push({ label: "Metal", value: humanise(job.metal_type) ?? "" });
  if (job.metal_colour) specs.push({ label: "Metal Colour", value: humanise(job.metal_colour) ?? "" });
  if (job.metal_purity) specs.push({ label: "Purity", value: job.metal_purity });
  if (job.stone_type) specs.push({ label: "Stone", value: humanise(job.stone_type) ?? "" });
  if (job.stone_carat) specs.push({ label: "Carat", value: `${job.stone_carat}ct` });
  if (job.ring_size) specs.push({ label: "Ring Size", value: job.ring_size });

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  const depositPaidAmt = (job.deposit_received ?? false) ? (job.deposit_amount ?? 0) : 0;
  const jobTotal = job.quoted_price ?? 0;
  const jobBalanceDue = jobTotal - depositPaidAmt;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/review/bespoke" className="text-sm text-stone-500 hover:text-[#8B7355] transition-colors">
          ← Bespoke Jobs
        </Link>
      </div>

      {job.stage === "ready" && (
        <div className="mb-5 flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
          <span className="text-xl flex-shrink-0">✅</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-800">Ready for Collection</p>
            <p className="text-sm text-emerald-700 mt-0.5">Awaiting customer pickup</p>
          </div>
        </div>
      )}

      {jobBalanceDue > 0 && !["collected", "cancelled"].includes(job.stage) && (
        <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <span className="text-xl flex-shrink-0">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800">Balance Due: {formatCurrency(jobBalanceDue)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-mono text-stone-400 bg-stone-200 px-2 py-0.5 rounded">
                    {job.job_number}
                  </span>
                  <PriorityBadge priority={job.priority} />
                </div>
                <h1 className="font-semibold text-2xl text-stone-900 leading-tight">{job.title}</h1>
                {customer && (
                  <p className="text-sm text-stone-500 mt-1">{customer.full_name}</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-stone-500">Workflow Progress</span>
                <StageBadge stage={job.stage} />
              </div>
              <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8B7355] rounded-full transition-all"
                  style={{ width: `${((currentStageIndex + 1) / (WORKFLOW_STAGES.length - 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {specs.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Specifications</h2>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                {specs.map((s) => (
                  <div key={s.label}>
                    <dt className="text-xs font-medium text-stone-400 uppercase tracking-wider">{s.label}</dt>
                    <dd className="text-sm text-stone-900 mt-0.5 font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {(job.description || job.internal_notes || job.client_notes) && (
            <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Notes</h2>
              <div className="space-y-4">
                {job.description && (
                  <div>
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">Description</p>
                    <p className="text-sm text-stone-900 leading-relaxed">{job.description}</p>
                  </div>
                )}
                {job.internal_notes && (
                  <div className="border-t border-stone-200 pt-4">
                    <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-1">⚑ Internal Notes</p>
                    <p className="text-sm text-stone-900 leading-relaxed">{job.internal_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900 mb-5">Stage History</h2>
            {stageHistory && stageHistory.length > 0 ? (
              <div className="relative pl-6">
                <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-stone-200" />
                <div className="space-y-5">
                  {stageHistory.map((entry: { id: string; stage: string; created_at: string; notes?: string | null }, i: number) => (
                    <div key={entry.id} className="relative">
                      <div className={`absolute -left-[18px] w-3 h-3 rounded-full border-2 ${i === stageHistory.length - 1 ? "border-[#8B7355] bg-[#8B7355]" : "border-stone-200 bg-white"}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-stone-900">
                            {WORKFLOW_STAGES.find((s) => s.key === entry.stage)?.label || entry.stage}
                          </span>
                          <span className="text-xs text-stone-400">
                            {new Date(entry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        {entry.notes && <p className="text-sm text-stone-500 mt-0.5">{entry.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-400">No stage history yet.</p>
            )}
          </div>

          <JobPhotos
            jobId={id}
            tenantId={TENANT_ID}
            existingImages={(job.images ?? []) as string[]}
          />
        </div>

        <div className="space-y-4">
          <JobDetailClient
            jobId={id}
            currentStage={job.stage}
            nextStage={nextStage}
            dueDate={job.due_date}
            priority={job.priority}
            quotedPrice={formatCurrency(job.quoted_price)}
            depositAmount={formatCurrency(job.deposit_amount)}
            depositPaid={job.deposit_received ?? false}
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
