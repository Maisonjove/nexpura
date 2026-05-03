import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SegmentsClientLegacy from "../../../marketing/segments/SegmentsClientLegacy";

export const metadata = { title: "Segments (Before) — Feedback Review" };

export default async function SegmentsBeforePage() {
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

  const { data: segments } = await admin
    .from("customer_segments")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("is_system", { ascending: false })
    .order("name");

  const formattedSegments = (segments || []).map((s) => ({
    ...s,
    rules: (s.rules as Record<string, unknown>) || {},
  }));

  return <SegmentsClientLegacy segments={formattedSegments} tenantId={tenantId} />;
}
