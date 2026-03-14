import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RefundDetailClient from "./RefundDetailClient";

export const metadata = { title: "Refund — Nexpura" };

export default async function RefundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) redirect("/onboarding");

  const admin = createAdminClient();

  const { data: refund } = await admin
    .from("refunds")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!refund) redirect("/refunds");

  const { data: items } = await admin
    .from("refund_items")
    .select("*")
    .eq("refund_id", id);

  return <RefundDetailClient refund={refund} items={items ?? []} />;
}
