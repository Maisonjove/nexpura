import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import VoucherDetailClient from "./VoucherDetailClient";

export const metadata = { title: "Voucher — Nexpura" };

export default async function VoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) redirect("/onboarding");

  const admin = createAdminClient();

  const { data: voucher } = await admin
    .from("gift_vouchers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!voucher) redirect("/vouchers");

  const { data: redemptions } = await admin
    .from("gift_voucher_redemptions")
    .select("*")
    .eq("voucher_id", id)
    .order("created_at", { ascending: false });

  return <VoucherDetailClient voucher={voucher} redemptions={redemptions ?? []} />;
}
