import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import JobDetailClient from "./JobDetailClient";
import JobPhotos from "./JobPhotos";

// All workflow stages in order
export const WORKFLOW_STAGES = [
  { key: "enquiry", label: "Enquiry" },
  { key: "quote_sent", label: "Quote Sent" },
  { key: "approved", label: "Approved" },
  { key: "deposit_paid", label: "Deposit Paid" },
  { key: "stone_sourcing", label: "Stone Sourcing" },
  { key: "cad", label: "CAD" },
  { key: "cad_approved", label: "CAD Approved" },
  { key: "casting", label: "Casting" },
  { key: "setting", label: "Setting" },
  { key: "polishing", label: "Polishing" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" },
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
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function humanise(val: string | null | undefined) {
  if (!val) return null;
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function BespokeJobDetailPage({
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

  const { data: job } = await supabase
    .from("bespoke_jobs")
    .select(
      `*, customers(id, full_name, email, mobile)`
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!job) notFound();

  const { data: stageHistory } = await supabase
    .from("bespoke_job_stages")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: true });

  const currentStageIndex = WORKFLOW_STAGES.findIndex((s) => s.key === job.stage);
  const nextStage =
    job.stage !== "completed" && job.stage !== "cancelled"
      ? WORKFLOW_STAGES[Math.min(currentStageIndex + 1, WORKFLOW_STAGES.length - 1)]
      : null;

  const isOverdue =
    job.due_date &&
    new Date(job.due_date) < new Date(new Date().toDateString()) &&
    !["completed", "cancelled"].includes(job.stage);

  // Build spec grid
  const specs: { label: string; value: string }[] = [];
  if (job.jewellery_type) specs.push({ label: "Type", value: humanise(job.jewellery_type) ?? "" });
  if (job.order_type) specs.push({ label: "Order", value: humanise(job.order_type) ?? "" });
  if (job.metal_type) specs.push({ label: "Metal", value: humanise(job.metal_type) ?? "" });
  if (job.metal_colour) specs.push({ label: "Metal Colour", value: humanise(job.metal_colour) ?? "" });
  if (job.metal_purity) specs.push({ label: "Purity", value: job.metal_purity });
  if (job.metal_weight_grams) specs.push({ label: "Weight", value: `${job.metal_weight_grams}g` });
  if (job.stone_type) specs.push({ label: "Stone", value: humanise(job.stone_type) ?? "" });
  if (job.stone_shape) specs.push({ label: "Shape", value: humanise(job.stone_shape) ?? "" });
  if (job.stone_carat) specs.push({ label: "Carat", value: `${job.stone_carat}ct` });
  if (job.stone_colour) specs.push({ label: "Colour", value: job.stone_colour });
  if (job.stone_clarity) specs.push({ label: "Clarity", value: job.stone_clarity });
  if (job.stone_origin) specs.push({ label: "Origin", value: job.stone_origin });
  if (job.stone_cert_number) specs.push({ label: "Certificate", value: job.stone_cert_number });
  if (job.ring_size) specs.push({ label: "Ring Size", value: job.ring_size });
  if (job.setting_style) specs.push({ label: "Setting", value: humanise(job.setting_style) ?? "" });

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/bespoke" className="text-sm text-stone-500 hover:text-[#8B7355] transition-colors">
          ← Bespoke Jobs
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left Panel (65%) ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Header card */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-mono text-stone-400 bg-stone-200 px-2 py-0.5 rounded">
                    {job.job_number}
                  </span>
                  <PriorityBadge priority={job.priority} />
                </div>
                <h1 className="font-semibold text-2xl font-semibold text-stone-900 leading-tight">
                  {job.title}
                </h1>
                {job.customers && (
                  <Link
                    href={`/customers/${job.customers.id}`}
                    className="text-sm text-stone-500 hover:text-[#8B7355] transition-colors mt-1 inline-block"
                  >
                    {job.customers.full_name}
                  </Link>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-stone-500">Workflow Progress</span>
                <StageBadge stage={job.stage} />
              </div>
              <div className="relative">
                {/* Track */}
                <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#8B7355] rounded-full transition-all"
                    style={{
                      width: `${((currentStageIndex + 1) / (WORKFLOW_STAGES.length - 1)) * 100}%`,
                    }}
                  />
                </div>
                {/* Stage dots */}
                <div className="flex justify-between mt-2">
                  {WORKFLOW_STAGES.filter((s) => !["cancelled"].includes(s.key)).map((s, i) => {
                    const idx = WORKFLOW_STAGES.findIndex((x) => x.key === s.key);
                    const done = idx <= currentStageIndex;
                    const current = s.key === job.stage;
                    return (
                      <div key={s.key} className="flex flex-col items-center" style={{ width: "7.14%" }}>
                        <div
                          className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${
                            current
                              ? "border-[#8B7355] bg-[#8B7355] scale-125"
                              : done
                              ? "border-[#8B7355] bg-[#8B7355]"
                              : "border-stone-200 bg-white"
                          }`}
                        />
                        {i % 3 === 0 && (
                          <span className="text-[9px] text-stone-400 mt-1 text-center leading-tight hidden sm:block">
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

          {/* Specifications */}
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

          {/* Notes */}
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
                {job.client_notes && (
                  <div className="border-t border-stone-200 pt-4">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">Client Requests</p>
                    <p className="text-sm text-stone-900 leading-relaxed">{job.client_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stage History */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900 mb-5">Stage History</h2>
            {stageHistory && stageHistory.length > 0 ? (
              <div className="relative pl-6">
                <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-stone-200" />
                <div className="space-y-5">
                  {stageHistory.map((entry, i) => (
                    <div key={entry.id} className="relative">
                      <div className={`absolute -left-[18px] w-3 h-3 rounded-full border-2 ${
                        i === stageHistory.length - 1
                          ? "border-[#8B7355] bg-[#8B7355]"
                          : "border-stone-200 bg-white"
                      }`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-stone-900">
                            {WORKFLOW_STAGES.find((s) => s.key === entry.stage)?.label || entry.stage}
                          </span>
                          <span className="text-xs text-stone-400">
                            {new Date(entry.created_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {entry.notes && (
                          <p className="text-sm text-stone-500 mt-0.5">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-400">No stage history yet.</p>
            )}
          </div>

          {/* Photos */}
          <JobPhotos
            jobId={id}
            tenantId={tenantId}
            existingImages={(job.images ?? []) as string[]}
          />
        </div>

        {/* ── Right Panel (35%) ────────────────────────────────── */}
        <div className="space-y-4">
          <JobDetailClient
            jobId={id}
            currentStage={job.stage}
            nextStage={nextStage}
            dueDate={job.due_date}
            priority={job.priority}
            quotedPrice={formatCurrency(job.quoted_price)}
            depositAmount={formatCurrency(job.deposit_amount)}
            depositPaid={job.deposit_paid}
            customerName={job.customers?.full_name ?? null}
            customerId={job.customers?.id ?? null}
            isOverdue={!!isOverdue}
          />

          {/* Edit button */}
          <Link
            href={`/bespoke/${id}/edit`}
            className="w-full flex items-center justify-center gap-2 bg-white border border-stone-900 text-stone-900 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-stone-900 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Job
          </Link>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Helper badges (server-side)
// ────────────────────────────────────────────────────────────────

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

const STAGE_MAP: Record<string, { dot: string; text: string }> = {
  enquiry: { dot: "bg-stone-400", text: "text-stone-600" },
  quote_sent: { dot: "bg-stone-400", text: "text-stone-600" },
  approved: { dot: "bg-green-400", text: "text-green-600" },
  deposit_paid: { dot: "bg-emerald-400", text: "text-emerald-600" },
  stone_sourcing: { dot: "bg-yellow-400", text: "text-yellow-600" },
  cad: { dot: "bg-orange-400", text: "text-orange-600" },
  cad_approved: { dot: "bg-orange-500", text: "text-orange-700" },
  casting: { dot: "bg-red-400", text: "text-red-600" },
  setting: { dot: "bg-amber-400", text: "text-amber-600" },
  polishing: { dot: "bg-stone-400", text: "text-stone-600" },
  ready: { dot: "bg-[#8B7355]", text: "text-[#8B7355]" },
  completed: { dot: "bg-stone-900", text: "text-stone-900" },
  cancelled: { dot: "bg-stone-900/30", text: "text-stone-400" },
};

const ALL_STAGES_LABELS: Record<string, string> = {
  enquiry: "Enquiry", quote_sent: "Quote Sent", approved: "Approved",
  deposit_paid: "Deposit Paid", stone_sourcing: "Stone Sourcing", cad: "CAD",
  cad_approved: "CAD Approved", casting: "Casting", setting: "Setting",
  polishing: "Polishing", ready: "Ready", completed: "Completed", cancelled: "Cancelled",
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
