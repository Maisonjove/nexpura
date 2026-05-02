import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RefundListClient from "./RefundListClient";

export const metadata = { title: "Refunds — Nexpura" };

export default function RefundsPage() {
  return (
    <Suspense fallback={null}>
      <RefundsBody />
    </Suspense>
  );
}

async function RefundsBody() {
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
  const { data: refunds } = await admin
    .from("refunds")
    .select("id, refund_number, original_sale_id, customer_name, total, refund_method, reason, status, created_at")
    .eq("tenant_id", userData.tenant_id)
    .order("created_at", { ascending: false });

  return <RefundListClient refunds={(refunds ?? []).map((r) => ({ ...r, total: Number(r.total) }))} />;
}
