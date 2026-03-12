import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import EditPassportForm from "./EditPassportForm";

export default async function EditPassportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: passport, error } = await supabase
    .from("passports")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !passport) notFound();

  return <EditPassportForm passport={passport} />;
}
