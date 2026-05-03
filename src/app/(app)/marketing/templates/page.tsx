import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import TemplatesClient from "./TemplatesClient";

export const metadata = { title: "Email Templates — Nexpura" };

export default function TemplatesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
      <TemplatesBody />
    </Suspense>
  );
}

async function TemplatesBody() {
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

  const { data: templates } = await admin
    .from("email_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("is_system", { ascending: false })
    .order("name");

  const formattedTemplates = (templates || []).map((t) => ({
    ...t,
    variables: (t.variables as string[]) || [],
  }));

  return (
    <TemplatesClient
      templates={formattedTemplates}
      tenantId={tenantId}
      businessName={businessName}
    />
  );
}
