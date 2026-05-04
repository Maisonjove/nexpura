import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import logger from "@/lib/logger";
import DemoRequestDetailClient, { type DemoRequestFull } from "./DemoRequestDetailClient";

export const metadata = { title: "Demo request — Nexpura admin" };

interface AuditEntry {
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  admin_user_id: string | null;
  admin_email: string | null;
}

export default async function DemoRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/demo-requests"
          className="text-xs text-stone-500 hover:text-stone-900 inline-flex items-center gap-1"
        >
          ← All demo requests
        </Link>
      </div>
      <Suspense fallback={<DetailSkeleton />}>
        <DetailBody id={id} />
      </Suspense>
    </div>
  );
}

async function DetailBody({ id }: { id: string }) {
  // Joey 2026-05-04: under `cacheComponents: true` (set globally in
  // next.config.ts), an async server component body without an
  // explicit dynamic marker is implicitly cached by the prerender
  // pipeline. Pre-fix this meant `router.refresh()` + `revalidatePath()`
  // calls from server actions (Mark Completed / Decline) successfully
  // mutated the DB and audit-logged, but the page kept rendering the
  // stale row state — Joey clicked Mark Completed three times before
  // realising the UI never reflected the underlying flip to
  // 'completed'. (admin)/layout.tsx already uses this pattern for the
  // same reason; copy here.
  await connection();

  const data = await loadDemoRequest(id);
  if (!data) notFound();
  const { request, audit } = data;

  return <DemoRequestDetailClient request={request} audit={audit} />;
}

async function loadDemoRequest(id: string): Promise<{
  request: DemoRequestFull;
  audit: AuditEntry[];
} | null> {
  try {
    const admin = createAdminClient();
    const { data: req, error } = await admin
      .from("demo_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !req) return null;

    // Audit trail: pull entries that name this demo_request_id in
    // their metadata. admin_audit_logs is platform-wide; the metadata
    // JSON contains demo_request_id for our 3 actions
    // (scheduled/completed/declined). Containment query keeps it
    // efficient with the existing GIN index on metadata.
    const { data: auditRows } = await admin
      .from("admin_audit_logs")
      .select("action, metadata, created_at, admin_user_id")
      .contains("metadata", { demo_request_id: id })
      .order("created_at", { ascending: false });

    // Resolve admin emails for the audit display.
    const userIds = Array.from(
      new Set((auditRows ?? []).map((a) => a.admin_user_id).filter((u): u is string => !!u)),
    );
    const emailMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: users } = await admin
        .from("users")
        .select("id, email")
        .in("id", userIds);
      for (const u of users ?? []) {
        if (u.id && u.email) emailMap.set(u.id as string, u.email as string);
      }
    }

    const audit: AuditEntry[] = (auditRows ?? []).map((a) => ({
      action: a.action as string,
      metadata: (a.metadata as Record<string, unknown> | null) ?? null,
      created_at: a.created_at as string,
      admin_user_id: (a.admin_user_id as string | null) ?? null,
      admin_email: a.admin_user_id ? emailMap.get(a.admin_user_id as string) ?? null : null,
    }));

    return { request: req as DemoRequestFull, audit };
  } catch (err) {
    logger.error("[admin/demo-requests/detail] load failed", { id, err });
    return null;
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <Skeleton className="h-5 w-48 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
