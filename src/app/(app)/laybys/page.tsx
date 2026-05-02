import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LaybyListClient from "./LaybyListClient";

export const metadata = { title: "Laybys — Nexpura" };

export default function LaybysPage() {
  return (
    <Suspense fallback={null}>
      <LaybysBody />
    </Suspense>
  );
}

async function LaybysBody() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;
  if (!tenantId) redirect("/dashboard");

  const admin = createAdminClient();

  const { data: laybys } = await admin
    .from("sales")
    .select("id, sale_number, customer_name, total, amount_paid, deposit_amount, status, sale_date, created_at")
    .eq("tenant_id", tenantId)
    .eq("payment_method", "layby")
    .order("created_at", { ascending: false });

  const rows = (laybys ?? []).map((lb) => ({
    ...lb,
    total: Number(lb.total ?? 0),
    amount_paid: Number(lb.amount_paid ?? 0),
    deposit_amount: Number(lb.deposit_amount ?? 0),
  }));

  return <LaybyListClient rows={rows} />;
}
