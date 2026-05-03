import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import CampaignFormClient from "./CampaignFormClient";

export const metadata = { title: "New Campaign — Nexpura" };

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
      <NewCampaignBody />
    </Suspense>
  );
}

async function NewCampaignBody() {
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

  const [{ data: segments }, { data: templates }, { data: customers }] = await Promise.all([
    admin
      .from("customer_segments")
      .select("id, name, customer_count")
      .eq("tenant_id", tenantId)
      .order("name"),
    admin
      .from("email_templates")
      .select("id, name, subject, body, template_type")
      .eq("tenant_id", tenantId)
      .order("name"),
    admin
      .from("customers")
      .select("tags")
      .eq("tenant_id", tenantId)
      .not("tags", "is", null),
  ]);

  const allTags = [...new Set((customers || []).flatMap((c) => c.tags || []))].sort();

  return (
    <CampaignFormClient
      segments={segments || []}
      templates={templates || []}
      tags={allTags}
      businessName={businessName}
    />
  );
}
