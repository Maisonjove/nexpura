import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * SECURITY: Print routes require authentication.
 * All print routes (invoices, repairs, bespoke, receipts) contain sensitive
 * business and customer data. Unauthenticated access is blocked.
 *
 * Same CC-compliance shape as the (admin) layout: sync outer wrapper +
 * Suspense-wrapped async auth guard. The guard's redirect() still fires
 * server-side during streaming before any print-content HTML is flushed.
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <PrintAuthGuard>{children}</PrintAuthGuard>
    </Suspense>
  );
}

async function PrintAuthGuard({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/print");
  }

  return <>{children}</>;
}
