import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import QuoteForm from "../QuoteForm";

export const metadata = {
  title: "New Quote | Nexpura",
};

export default async function NewQuotePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/onboarding");

  // Fetch customers for the dropdown
  const { data: customers } = await supabase
    .from("customers")
    .select("id, full_name")
    .eq("tenant_id", userData.tenant_id)
    .order("full_name");

  return (
    <div className="py-6">
      <QuoteForm 
        tenantId={userData.tenant_id} 
        customers={customers || []} 
      />
    </div>
  );
}
