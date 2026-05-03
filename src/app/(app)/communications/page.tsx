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

  const [{ data: comms }, { data: emailLogs }, { data: notifications }] = await Promise.all([
    supabase
      .from("communications")
      .select("id, type, subject, customer_name, customer_email, status, sent_at, created_at")
      .eq("tenant_id", tenantId ?? "")
      .order("created_at", { ascending: false }),
    // email_logs columns are: recipient (not recipient_email), email_type
    // (not template_type), resend_id (not resend_message_id),
    // reference_type/_id (not linked_entity_type/_id), and there is no
    // sent_at — only created_at. Pre-fix the wrong column names made the
    // PostgREST select error out, so emailLogs came back null and the
    // Sent Emails tab silently rendered "No emails logged yet" forever.
    admin
      .from("email_logs")
      .select("id, recipient, email_type, subject, status, resend_id, reference_type, reference_id, bounce_reason, created_at")
      .eq("tenant_id", tenantId ?? "")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("notifications")
      .select("id, type, title, body, link, is_read, created_at, users(full_name, email)")
      .eq("tenant_id", tenantId ?? "")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  // Normalize notifications - Supabase returns users as array from join, flatten
  const normalizedNotifications = (notifications ?? []).map((n) => ({
    ...n,
    users: Array.isArray(n.users) ? (n.users[0] ?? null) : n.users,
  }));

  return (
    <CommunicationsListClient
      comms={comms ?? []}
      emailLogs={emailLogs ?? []}
      notifications={normalizedNotifications as import("./CommunicationsListClient").NotificationLog[]}
    />
  );
}
