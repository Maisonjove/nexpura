import { getAuthOrReviewContext } from "@/lib/auth/review";
import SupplierListClient from "./SupplierListClient";

export default async function SuppliersPage() {
  const { tenantId, admin } = await getAuthOrReviewContext();

  const { data: suppliers } = tenantId
    ? await admin
        .from("suppliers")
        .select("id, name, contact_name, email, phone, website, created_at")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true })
    : { data: [] };

  return <SupplierListClient suppliers={suppliers ?? []} />;
}
