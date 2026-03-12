import { createClient } from "@/lib/supabase/server";
import SupplierListClient from "./SupplierListClient";

export default async function SuppliersPage() {
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

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, contact_name, email, phone, website, created_at")
    .eq("tenant_id", tenantId ?? "")
    .order("name", { ascending: true });

  return <SupplierListClient suppliers={suppliers ?? []} />;
}
