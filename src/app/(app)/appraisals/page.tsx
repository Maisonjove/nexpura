import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import AppraisalsClient from "./AppraisalsClient";

export const metadata = { title: "Appraisals & Valuations — Nexpura" };

export default async function AppraisalsPage() {
  const headersList = await headers();
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  const admin = createAdminClient();
  const [{ data: appraisals }, { data: customers }] = await Promise.all([
    admin
      .from("appraisals")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    admin
      .from("customers")
      .select("id, first_name, last_name, email, phone")
      .eq("tenant_id", tenantId)
      .order("first_name"),
  ]);

  return (
    <AppraisalsClient
      appraisals={appraisals ?? []}
      customers={customers ?? []}
      tenantId={tenantId}
    />
  );
}
