import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import NewMemoClient from "./NewMemoClient";

export const metadata = { title: "New Memo/Consignment — Nexpura" };

interface PageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function NewMemoPage({ searchParams }: PageProps) {
  const auth = await requireAuth().catch(() => null);
  if (!auth) redirect("/login");

  const { tenantId } = auth;
  const admin = createAdminClient();
  const params = await searchParams;

  // Determine memo type from query param
  const memoType = params.type === "consignment" ? "consignment" : "memo";

  // Fetch customers and suppliers in parallel
  const [customersResult, suppliersResult] = await Promise.all([
    admin
      .from("customers")
      .select("id, first_name, last_name, email")
      .eq("tenant_id", tenantId)
      .order("first_name"),
    admin
      .from("suppliers")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name"),
  ]);

  const customers = customersResult.data ?? [];
  const suppliers = suppliersResult.data ?? [];

  return (
    <NewMemoClient
      memoType={memoType}
      customers={customers}
      suppliers={suppliers}
    />
  );
}
