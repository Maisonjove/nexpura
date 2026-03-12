import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import SupplierDetailClient from "./SupplierDetailClient";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId ?? "")
    .single();

  if (!supplier) notFound();

  return <SupplierDetailClient supplier={supplier} />;
}
