import { redirect } from "next/navigation";

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Redirect to standalone print page (outside app layout)
  redirect(`/print/invoice/${id}`);
}
