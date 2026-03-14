import { createClient } from "@/lib/supabase/server";
import PassportsListClient from "./PassportsListClient";

export const metadata = { title: "Digital Passports — Nexpura" };

export default async function PassportsPage() {
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

  const { data: passports } = await supabase
    .from("passports")
    .select(
      "id, passport_uid, title, jewellery_type, current_owner_name, status, is_public, verified_at, created_at"
    )
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const safePassports = passports ?? [];
  const total = safePassports.length;
  const active = safePassports.filter((p) => p.status === "active").length;
  const verified = safePassports.filter((p) => p.verified_at !== null).length;
  const publicCount = safePassports.filter((p) => p.is_public).length;

  return (
    <PassportsListClient
      passports={safePassports}
      total={total}
      active={active}
      verified={verified}
      publicCount={publicCount}
    />
  );
}
