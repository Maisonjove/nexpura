import { createClient } from "@/lib/supabase/server";
import SalesListClient from "./SalesListClient";

export default async function SalesPage() {
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

  const { data: sales } = await supabase
    .from("sales")
    .select("id, sale_number, customer_name, customer_email, status, payment_method, total, amount_paid, sale_date, created_at")
    .eq("tenant_id", tenantId ?? "")
    .order("created_at", { ascending: false });

  return <SalesListClient sales={sales ?? []} />;
}
