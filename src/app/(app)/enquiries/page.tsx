import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import EnquiriesClient from "./EnquiriesClient";

export const metadata = { title: "Enquiries — Nexpura" };

export default async function EnquiriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/onboarding");

  const tenantId = userData.tenant_id;
  const admin = createAdminClient();

  const { data: enquiries } = await admin
    .from("shop_enquiries")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (
    <EnquiriesClient enquiries={enquiries ?? []} tenantId={tenantId} />
  );
}
