import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SegmentsClient from "./SegmentsClient";

export const metadata = { title: "Customer Segments — Nexpura" };

export default async function SegmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id ?? "";

  // Fetch segments
  const { data: segments } = await admin
    .from("customer_segments")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("is_system", { ascending: false })
    .order("name");

  // Format segments with proper typing
  const formattedSegments = (segments || []).map((s) => ({
    ...s,
    rules: (s.rules as Record<string, unknown>) || {},
  }));

  return <SegmentsClient segments={formattedSegments} tenantId={tenantId} />;
}
