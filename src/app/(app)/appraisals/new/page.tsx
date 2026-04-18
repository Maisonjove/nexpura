import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import NewAppraisalClient from "./NewAppraisalClient";

export const metadata = { title: "New Appraisal — Nexpura" };

export default async function NewAppraisalPage() {
  const headersList = await headers();
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  const admin = createAdminClient();
  const { data: customers } = await admin
    .from("customers")
    .select("id, first_name, last_name, email, phone")
    .eq("tenant_id", tenantId)
    .order("first_name");

  return <NewAppraisalClient customers={customers ?? []} />;
}
