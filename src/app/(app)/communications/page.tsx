import { createClient } from "@/lib/supabase/server";
import CommunicationsListClient from "./CommunicationsListClient";

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

  const { data: comms } = await supabase
    .from("communications")
    .select("id, type, subject, customer_name, customer_email, status, sent_at, created_at")
    .eq("tenant_id", tenantId ?? "")
    .order("created_at", { ascending: false });

  return <CommunicationsListClient comms={comms ?? []} />;
}
