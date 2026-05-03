import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import VerificationClient, { type CredentialRow } from "./VerificationClient";

// Layout already supplies metadata = "Verification — Nexpura"
// (added in the Group 14 first-pass PR #110).

export default async function VerificationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  const tenantId = userData?.tenant_id;
  const role = (userData as { role?: string })?.role ?? "staff";
  if (!tenantId) redirect("/onboarding");

  const [{ data: credentials }, { data: teamMembers }] = await Promise.all([
    admin
      .from("employee_credentials")
      .select("id, user_id, employee_name, credential_type, issuer, issued_date, expiry_date, document_url, notes, created_at")
      .eq("tenant_id", tenantId)
      .order("expiry_date", { ascending: true, nullsFirst: false }),
    admin
      .from("users")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .order("full_name"),
  ]);

  const rows: CredentialRow[] = (credentials ?? []).map((c) => ({
    id: c.id as string,
    userId: (c.user_id as string | null) ?? null,
    employeeName: c.employee_name as string,
    credentialType: c.credential_type as string,
    issuer: (c.issuer as string | null) ?? null,
    issuedDate: (c.issued_date as string | null) ?? null,
    expiryDate: (c.expiry_date as string | null) ?? null,
    documentUrl: (c.document_url as string | null) ?? null,
    notes: (c.notes as string | null) ?? null,
  }));

  return (
    <VerificationClient
      credentials={rows}
      teamMembers={(teamMembers ?? []) as Array<{ id: string; full_name: string; email: string | null }>}
      canManage={["owner", "admin", "manager"].includes(role)}
    />
  );
}
