import { getAuthOrReviewContext } from "@/lib/auth/review";
import { redirect } from "next/navigation";
import FilesClient from "./FilesClient";

export const metadata = { title: "Migration · Files — Nexpura" };

export default async function FilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ rt?: string }>;
}) {
  const { sessionId } = await params;
  const { rt } = await searchParams;
  const { tenantId } = await getAuthOrReviewContext(rt);

  if (!tenantId) {
    redirect("/login");
  }

  return <FilesClient sessionId={sessionId} rt={rt} />;
}
