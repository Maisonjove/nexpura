import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import QuoteDetailClient from "../QuoteDetailClient";

export const metadata = {
  title: "Quote Details | Nexpura",
};

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, headersList, supabase] = await Promise.all([
    params,
    headers(),
    createClient(),
  ]);
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  // Scope quote to current tenant — prevents cross-tenant data leak
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, customers(*)")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!quote) notFound();

  return <QuoteDetailClient quote={quote} />;
}
