import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import EmailDomainClient from "./EmailDomainClient";

export const metadata = { title: "Email Settings — Nexpura" };

export default async function EmailSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  
  // Get user's tenant and role
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");

  // Get email domain info
  const { data: emailDomain } = await admin
    .from("email_domains")
    .select("*")
    .eq("tenant_id", userData.tenant_id)
    .single();

  // Get tenant info
  const { data: tenant } = await admin
    .from("tenants")
    .select("email_from_name, business_name, reply_to_email")
    .eq("id", userData.tenant_id)
    .single();

  return (
    <EmailDomainClient
      emailDomain={emailDomain ? {
        id: emailDomain.id,
        domain: emailDomain.domain,
        status: emailDomain.status,
        dnsRecords: emailDomain.dns_records,
        verifiedAt: emailDomain.verified_at,
        createdAt: emailDomain.created_at,
      } : null}
      fromName={tenant?.email_from_name || null}
      businessName={tenant?.business_name || null}
      replyToEmail={tenant?.reply_to_email || null}
      isOwner={userData.role === "owner"}
    />
  );
}
