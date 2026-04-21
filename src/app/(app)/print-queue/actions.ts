"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-context";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant");
  return { supabase, userId: user.id, tenantId: userData.tenant_id as string, role: userData.role as string };
}

export interface PrintJob {
  id: string;
  tenant_id: string;
  document_type: string;
  document_id: string | null;
  document_title: string | null;
  printer_type: string;
  status: string;
  copies: number;
  pdf_url: string | null;
  error_message: string | null;
  created_by: string | null;
  printed_at: string | null;
  created_at: string;
}

export async function getPrintQueue(): Promise<{ data: PrintJob[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("print_jobs")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("status", ["queued", "printing", "failed"])
      .order("created_at", { ascending: true });
    if (error) return { data: [], error: error.message };
    return { data: data ?? [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function queuePrintJob(
  documentType: string,
  documentId: string | null,
  documentTitle: string,
  printerType: "receipt" | "label" | "office",
  copies: number = 1,
  pdfUrl?: string
): Promise<{ id?: string; error?: string }> {
  try {
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("print_jobs")
      .insert({
        tenant_id: tenantId,
        document_type: documentType,
        document_id: documentId,
        document_title: documentTitle,
        printer_type: printerType,
        status: "queued",
        copies,
        pdf_url: pdfUrl || null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    revalidatePath("/print-queue");
    return { id: data?.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function markPrintJobDone(jobId: string): Promise<{ error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { error } = await admin
      .from("print_jobs")
      .update({ status: "done", printed_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };
    revalidatePath("/print-queue");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function cancelPrintJob(jobId: string): Promise<{ error?: string }> {
  try {
    // RBAC: cancelling another user's print job is destructive to their
    // workflow. Owner/manager only (users wanting to cancel their own
    // job can just reprint).
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can cancel print jobs." };
    }
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { error } = await admin
      .from("print_jobs")
      .update({ status: "cancelled" })
      .eq("id", jobId)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };
    revalidatePath("/print-queue");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getPrintHistory(): Promise<{ data: PrintJob[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("print_jobs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { data: [], error: error.message };
    return { data: data ?? [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}
