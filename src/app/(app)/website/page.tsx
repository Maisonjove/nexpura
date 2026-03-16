import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import WebsiteBuilderClient from "./WebsiteBuilderClient";

export default async function WebsitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");

  const { data: config } = await supabase
    .from("website_config")
    .select("*")
    .eq("tenant_id", userData.tenant_id)
    .maybeSingle();

  return (
    <WebsiteBuilderClient
      initial={config}
      tenantId={userData.tenant_id}
    />
  );
}
