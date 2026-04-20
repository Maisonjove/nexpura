import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import ApprovalClient from "./ApprovalClient";

/**
 * /approve/[token] — CC-ready bespoke-job approval page.
 *
 * Same shape as /invite/[token]: a per-token client-facing approval flow
 * gated on the token row, no cookies, no auth beyond the token itself.
 *
 * Sync top-level → Suspense → async body → pure `loadJobByToken(token)`
 * loader. The loader fans out two parallel admin-client reads (the
 * bespoke_jobs row + its job_attachments) and returns the normalised
 * shape the client component expects. notFound() handling preserved.
 *
 * TODO(cacheComponents-flag): when the flag flips, the loader can be
 * wrapped with:
 *   'use cache';
 *   cacheLife('seconds');          // short TTL — approval writes invalidate
 *   cacheTag(`bespoke-approval:${token}`);
 * Plus matching revalidateTag in the approve/reject server action.
 */

interface Props {
  params: Promise<{ token: string }>;
}

export default function ApprovalPage({ params }: Props) {
  return (
    <Suspense fallback={<ApprovalSkeleton />}>
      <ApprovalBody paramsPromise={params} />
    </Suspense>
  );
}

async function ApprovalBody({ paramsPromise }: { paramsPromise: Promise<{ token: string }> }) {
  const { token } = await paramsPromise;
  const data = await loadJobByToken(token);
  if (!data) notFound();

  const { job, attachments } = data;
  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  const tenant = Array.isArray(job.tenants) ? job.tenants[0] : job.tenants;
  const milestones = Array.isArray(job.bespoke_milestones) ? job.bespoke_milestones : [];

  return (
    <ApprovalClient
      token={token}
      job={{
        id: job.id,
        job_number: job.job_number,
        title: job.title,
        description: job.description,
        jewellery_type: job.jewellery_type,
        metal_type: job.metal_type,
        metal_colour: job.metal_colour,
        metal_purity: job.metal_purity,
        stone_type: job.stone_type,
        stone_carat: job.stone_carat,
        stone_colour: job.stone_colour,
        stone_clarity: job.stone_clarity,
        ring_size: job.ring_size,
        setting_style: job.setting_style,
        quoted_price: job.quoted_price,
        deposit_amount: job.deposit_amount,
        approval_status: job.approval_status,
        approved_at: job.approved_at,
        approval_notes: job.approval_notes,
      }}
      customer={customer}
      tenant={tenant}
      milestones={milestones}
      attachments={attachments}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cacheable per-token loader. Parallel fan-out on the two admin reads.
// ─────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JobRow = any;
interface AttachmentRow {
  id: string;
  file_url: string;
  file_name: string;
  caption?: string;
}

async function loadJobByToken(
  token: string
): Promise<{ job: JobRow; attachments: AttachmentRow[] } | null> {
  const admin = createAdminClient();

  const { data: job, error } = await admin
    .from("bespoke_jobs")
    .select(`
      id, job_number, title, description, jewellery_type,
      metal_type, metal_colour, metal_purity, stone_type, stone_carat,
      stone_colour, stone_clarity, ring_size, setting_style,
      quoted_price, deposit_amount, approval_status, approved_at, approval_notes,
      customers(id, full_name, email),
      tenants(id, name, business_name, logo_url),
      bespoke_milestones(id, title, description, due_date, completed_at, order_index)
    `)
    .eq("approval_token", token)
    .single();

  if (error || !job) return null;

  const { data: attachments } = await admin
    .from("job_attachments")
    .select("id, file_url, file_name, caption")
    .eq("job_type", "bespoke")
    .eq("job_id", job.id)
    .order("created_at", { ascending: true });

  const normalised: AttachmentRow[] = (attachments ?? []).map((a) => ({
    id: a.id as string,
    file_url: a.file_url as string,
    file_name: (a.file_name as string | null) ?? "",
    caption: (a.caption as string | null) ?? undefined,
  }));

  return { job, attachments: normalised };
}

function ApprovalSkeleton() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 max-w-2xl w-full space-y-6">
        <div className="h-8 w-64 bg-stone-100 rounded animate-pulse" />
        <div className="h-4 w-96 bg-stone-100 rounded animate-pulse" />
        <div className="h-48 w-full bg-stone-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 bg-stone-100 rounded animate-pulse" />
          <div className="h-10 bg-stone-100 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
