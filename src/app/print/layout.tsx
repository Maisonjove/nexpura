import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * SECURITY: Print routes require authentication.
 * All print routes (invoices, repairs, bespoke, receipts) contain sensitive
 * business and customer data. Unauthenticated access is blocked.
 */
export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/print");
  }

  return <>{children}</>;
}
