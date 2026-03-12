import { createClient } from "@/lib/supabase/server";
import BespokeJobForm from "../BespokeJobForm";

export default async function NewBespokeJobPage() {
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

  // Fetch customers for the dropdown
  const { data: customers } = await supabase
    .from("customers")
    .select("id, full_name")
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <a href="/bespoke" className="text-sm text-forest/50 hover:text-sage transition-colors">
          ← Bespoke Jobs
        </a>
        <h1 className="font-fraunces text-2xl font-semibold text-forest mt-2">New Bespoke Job</h1>
      </div>
      <BespokeJobForm customers={customers || []} mode="create" />
    </div>
  );
}
