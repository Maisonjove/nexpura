import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CommunicationsListClient from "./CommunicationsListClient";

export const metadata = { title: "Communications — Nexpura" };

export default async function CommunicationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id;
  const admin = createAdminClient();

  const [{ data: comms }, { data: emailLogs }] = await Promise.all([
    supabase
      .from("communications")
      .select("id, type, subject, customer_name, customer_email, status, sent_at, created_at")
      .eq("tenant_id", tenantId ?? "")
      .order("created_at", { ascending: false }),
    admin
      .from("email_logs")
      .select("id, recipient_email, recipient_name, template_type, subject, status, resend_message_id, linked_entity_type, linked_entity_id, sent_at, created_at")
      .eq("tenant_id", tenantId ?? "")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <CommunicationsListClient
      comms={comms ?? []}
      emailLogs={emailLogs ?? []}
    />
  );
}
