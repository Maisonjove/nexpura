import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import QuoteDetailClient from "../QuoteDetailClient";

export const metadata = {
  title: "Quote Details | Nexpura",
};

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get tenant from authenticated user — never trust URL params
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/onboarding");

  // Scope quote to current tenant — prevents cross-tenant data leak
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, customers(*)")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!quote) notFound();

  return <QuoteDetailClient quote={quote} />;
}
