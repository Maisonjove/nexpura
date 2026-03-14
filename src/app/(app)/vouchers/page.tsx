import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import VouchersClient from "./VouchersClient";

export const metadata = { title: "Gift Vouchers — Nexpura" };

export default async function VouchersPage() {
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
  const { data: vouchers } = await admin
    .from("gift_vouchers")
    .select("*")
    .eq("tenant_id", userData.tenant_id)
    .order("created_at", { ascending: false });

  return <VouchersClient vouchers={vouchers ?? []} />;
}
