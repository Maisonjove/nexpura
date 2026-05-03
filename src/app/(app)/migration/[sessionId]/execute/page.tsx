import { getAuthOrReviewContext } from "@/lib/auth/review";
import { redirect } from "next/navigation";
import ExecuteClient from "./ExecuteClient";

export const metadata = { title: "Migration · Execute — Nexpura" };

export default async function ExecutePage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ rt?: string, jobId?: string }>;
}) {
  const { sessionId } = await params;
  const { rt, jobId } = await searchParams;
  const { tenantId } = await getAuthOrReviewContext(rt);

  if (!tenantId) {
    redirect("/login");
  }

  return <ExecuteClient sessionId={sessionId} jobId={jobId} rt={rt} />;
}
