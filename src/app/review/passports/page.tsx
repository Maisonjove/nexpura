import { createAdminClient } from "@/lib/supabase/admin";
import PassportsListClient from "@/app/(app)/passports/PassportsListClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

export default async function ReviewPassportsPage() {
  const admin = createAdminClient();

  const { data: passports } = await admin
    .from("passports")
    .select("id, passport_uid, title, jewellery_type, current_owner_name, status, is_public, verified_at, created_at")
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const safe = passports ?? [];
  const active = safe.filter((p) => p.status === "active").length;
  const verified = safe.filter((p) => p.verified_at).length;
  const publicCount = safe.filter((p) => p.is_public).length;

  return (
    <PassportsListClient
      passports={safe}
      total={safe.length}
      active={active}
      verified={verified}
      publicCount={publicCount}
    />
  );
}
