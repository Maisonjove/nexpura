import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEODSummary, getPastReconciliations } from "./actions";
import EODClient from "./EODClient";

export const metadata = { title: "End of Day — Nexpura" };

export default async function EODPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [summaryResult, historyResult] = await Promise.all([
    getEODSummary(),
    getPastReconciliations(),
  ]);

  if (!summaryResult.data) redirect("/dashboard");

  return (
    <EODClient
      todaySummary={summaryResult.data}
      pastRecords={historyResult.data ?? []}
    />
  );
}
