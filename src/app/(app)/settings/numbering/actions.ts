"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { supabase, tenantId: userData.tenant_id };
}

export interface SequenceInfo {
  invoice_sequence: number;
  job_sequence: number;
  repair_sequence: number;
  sale_sequence: number;
  quote_sequence: number;
  // Current max numbers from actual records
  invoice_current: string;
  job_current: string;
  repair_current: string;
  sale_current: string;
  quote_current: string;
}

export async function getSequenceInfo(): Promise<{ data: SequenceInfo | null; error?: string }> {
  try {
    const { supabase, tenantId } = await getAuthContext();
    const adminClient = createAdminClient();

    // Get tenant sequences
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("invoice_sequence,job_sequence,repair_sequence,sale_sequence,quote_sequence")
      .eq("id", tenantId)
      .single();

    // Get current max numbers from actual records
    const [
      { data: lastInvoice },
      { data: lastJob },
      { data: lastRepair },
      { data: lastSale },
      { data: lastQuote },
    ] = await Promise.all([
      supabase
        .from("invoices")
        .select("invoice_number")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("bespoke_jobs")
        .select("job_number")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("repairs")
        .select("repair_number")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sales")
        .select("sale_number")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("quotes")
        .select("quote_number")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      data: {
        invoice_sequence: (tenant as Record<string, number> | null)?.invoice_sequence ?? 1,
        job_sequence: (tenant as Record<string, number> | null)?.job_sequence ?? 1,
        repair_sequence: (tenant as Record<string, number> | null)?.repair_sequence ?? 1,
        sale_sequence: (tenant as Record<string, number> | null)?.sale_sequence ?? 1,
        quote_sequence: (tenant as Record<string, number> | null)?.quote_sequence ?? 1,
        invoice_current: (lastInvoice as { invoice_number?: string } | null)?.invoice_number ?? "None",
        job_current: (lastJob as { job_number?: string } | null)?.job_number ?? "None",
        repair_current: (lastRepair as { repair_number?: string } | null)?.repair_number ?? "None",
        sale_current: (lastSale as { sale_number?: string } | null)?.sale_number ?? "None",
        quote_current: (lastQuote as { quote_number?: string } | null)?.quote_number ?? "None",
      },
    };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

export async function saveSequence(
  field: "invoice_sequence" | "job_sequence" | "repair_sequence" | "sale_sequence" | "quote_sequence",
  value: number
): Promise<{ error?: string }> {
  try {
    if (!Number.isInteger(value) || value < 1) {
      return { error: "Sequence must be a positive integer" };
    }

    const { tenantId } = await getAuthContext();
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("tenants")
      .update({ [field]: value })
      .eq("id", tenantId);

    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return { error: String(err) };
  }
}
