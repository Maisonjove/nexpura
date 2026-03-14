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

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, customers(*)")
    .eq("id", id)
    .single();

  if (!quote) notFound();

  return <QuoteDetailClient quote={quote} />;
}
