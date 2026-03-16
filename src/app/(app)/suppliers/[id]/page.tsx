import { getAuthOrReviewContext } from "@/lib/auth/review";
import { notFound } from "next/navigation";
import SupplierDetailClient from "./SupplierDetailClient";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenantId, admin } = await getAuthOrReviewContext();

  if (!tenantId) notFound();

  const { data: supplier } = await admin
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!supplier) notFound();

  return <SupplierDetailClient supplier={supplier} />;
}
