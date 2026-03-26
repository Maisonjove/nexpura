import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInvoiceEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit invoice emails per user
    const { success } = await checkRateLimit(`invoice-email:${user.id}`);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Get user's tenant
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    // Verify invoice belongs to tenant
    const { data: invoice, error: invError } = await admin
      .from("invoices")
      .select("id, tenant_id, customer_id, customers(email)")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (invError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Get customer email (can be array or single object from Supabase join)
    const rawCustomer = invoice.customers;
    const customer = Array.isArray(rawCustomer) 
      ? (rawCustomer[0] as { email: string | null } | undefined) 
      : (rawCustomer as { email: string | null } | null);
    if (!customer?.email) {
      return NextResponse.json(
        { error: "Customer has no email address" },
        { status: 400 }
      );
    }

    // Send email
    const result = await sendInvoiceEmail(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, emailId: result.emailId });
  } catch (error) {
    logger.error("Error sending invoice email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
