import { getAuthOrReviewContext } from "@/lib/auth/review";
import { redirect } from "next/navigation";
import AssistedMigrationClient from "./_components/AssistedMigrationClient";

export const metadata = { title: "Assisted Migration — Nexpura" };

export default async function AssistedMigrationPage({
  searchParams,
}: {
  searchParams: Promise<{ rt?: string }>;
}) {
  const params = await searchParams;
  const { tenantId } = await getAuthOrReviewContext(params.rt);

  if (!tenantId) {
    redirect("/login");
  }

  return <AssistedMigrationClient />;
}
