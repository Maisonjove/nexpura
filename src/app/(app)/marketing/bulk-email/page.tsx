import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import BulkEmailClient from "./BulkEmailClient";

export const metadata = { title: "Bulk Email — Nexpura" };

/**
 * Bulk Email — sync top-level shell + dynamic body inside Suspense.
 * Pre-fix this page used `export default async function BulkEmailPage()`
 * with a top-level await on auth + segments + customers, which under
 * cacheComponents:true throws React error #419 ("Cannot use postpone
 * outside of a Server Component") on the prerender path. The /marketing
 * hub already moved to this pattern; bulk-email had been left behind.
 */
export default function BulkEmailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
      <BulkEmailBody />
    </Suspense>
  );
}

async function BulkEmailBody() {
  const headersList = await headers();
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  const admin = createAdminClient();
  const { data: tenantRow } = await admin
    .from("tenants")
    .select("name, business_name")
    .eq("id", tenantId)
    .single();
  const businessName = tenantRow?.business_name || tenantRow?.name || "Business";

  const { data: segments } = await admin
    .from("customer_segments")
    .select("id, name, customer_count")
    .eq("tenant_id", tenantId)
    .order("name");

  const { data: customers } = await admin
    .from("customers")
    .select("id, full_name, email, tags")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .not("email", "is", null)
    .order("full_name");

  const allTags = [...new Set((customers || []).flatMap((c) => c.tags || []))].sort();

  return (
    <BulkEmailClient
      segments={segments || []}
      customers={customers || []}
      tags={allTags}
      businessName={businessName}
    />
  );
}
