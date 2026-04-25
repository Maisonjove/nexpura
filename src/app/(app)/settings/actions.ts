"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";
import { requireRole } from "@/lib/auth-context";

async function verifyTenantOwnership(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string): Promise<{ error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (profile?.tenant_id !== tenantId) {
    return { error: "Unauthorized" };
  }

  return {};
}

export async function saveBusinessProfile(tenantId: string, formData: FormData) {
  try {
    // Pre-fix this only verified tenant ownership (any authed member of
    // the tenant). Salespersons + workshop staff could rewrite the
    // business name / ABN / tax-relevant address. Owners + managers
    // only — saveBanking already does this; align the rest.
    try {
      await requireRole("owner", "manager");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      return { error: msg.startsWith("permission_denied") ? "Only owner or manager can edit business profile." : "Not authenticated" };
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const authCheck = await verifyTenantOwnership(supabase, tenantId);
    if (authCheck.error) return { error: authCheck.error };

    const updates = {
      business_name: formData.get("business_name") as string || null,
      business_type: formData.get("business_type") as string || null,
      business_mode: formData.get("business_mode") as string || 'full',
      phone: formData.get("phone") as string || null,
      email: formData.get("email") as string || null,
      website: formData.get("website") as string || null,
      abn: formData.get("abn") as string || null,
      address_line1: formData.get("address_line1") as string || null,
      suburb: formData.get("suburb") as string || null,
      state: formData.get("state") as string || null,
      postcode: formData.get("postcode") as string || null,
      country: formData.get("country") as string || null,
      invoice_accent_color: formData.get("invoice_accent_color") as string || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("tenants")
      .update(updates)
      .eq("id", tenantId);

    if (error) return { error: error.message };

    // Log audit event
    await logAuditEvent({
      tenantId,
      userId: user?.id,
      action: "settings_update",
      entityType: "settings",
      entityId: tenantId,
      newData: { section: "business_profile", ...updates },
    });

    return { success: true };
  } catch (error) {
    logger.error("saveBusinessProfile failed", { error });
    return { error: "Operation failed" };
  }
}

export async function saveTaxCurrency(tenantId: string, formData: FormData) {
  try {
    // Same pattern as saveBusinessProfile — tax + currency directly
    // affects every invoice/sale total. Owners + managers only.
    try {
      await requireRole("owner", "manager");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      return { error: msg.startsWith("permission_denied") ? "Only owner or manager can edit tax + currency." : "Not authenticated" };
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const authCheck = await verifyTenantOwnership(supabase, tenantId);
    if (authCheck.error) return { error: authCheck.error };

    const taxRatePercent = parseFloat(formData.get("tax_rate") as string) || 10;
    const updates = {
      currency: formData.get("currency") as string || "AUD",
      timezone: formData.get("timezone") as string || "Australia/Sydney",
      tax_name: formData.get("tax_name") as string || "GST",
      tax_rate: taxRatePercent / 100,
      tax_inclusive: formData.get("tax_inclusive") === "true",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("tenants")
      .update(updates)
      .eq("id", tenantId);

    if (error) return { error: error.message };

    // Log audit event
    await logAuditEvent({
      tenantId,
      userId: user?.id,
      action: "settings_update",
      entityType: "settings",
      entityId: tenantId,
      newData: { section: "tax_currency", ...updates },
    });

    return { success: true };
  } catch (error) {
    logger.error("saveTaxCurrency failed", { error });
    return { error: "Operation failed" };
  }
}

export async function saveBanking(tenantId: string, formData: FormData) {
  try {
    // W6-CRIT-01: banking details (BSB/account that customers see on
    // invoices) are owner-only — a rogue staffer must not be able to swap
    // the payout account to theirs. Also ignores the caller-supplied
    // tenantId and uses the session tenant (defence-in-depth vs PR-01).
    let authCtx;
    try {
      authCtx = await requireRole("owner");
    } catch {
      return { error: "Only the account owner can update banking details." };
    }

    const supabase = await createClient();
    const user = { id: authCtx.userId };

    // Refuse any cross-tenant save attempt outright.
    if (tenantId && tenantId !== authCtx.tenantId) {
      return { error: "Unauthorized" };
    }
    const effectiveTenantId = authCtx.tenantId;

    const updates = {
      bank_name: formData.get("bank_name") as string || null,
      bank_bsb: formData.get("bank_bsb") as string || null,
      bank_account: formData.get("bank_account") as string || null,
      invoice_footer: formData.get("invoice_footer") as string || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("tenants")
      .update(updates)
      .eq("id", effectiveTenantId);

    if (error) return { error: error.message };

    // Log audit event
    await logAuditEvent({
      tenantId: effectiveTenantId,
      userId: user?.id,
      action: "settings_update",
      entityType: "settings",
      entityId: effectiveTenantId,
      newData: { section: "banking", bank_name: updates.bank_name },
    });

    return { success: true };
  } catch (error) {
    logger.error("saveBanking failed", { error });
    return { error: "Operation failed" };
  }
}

/**
 * Launch-QA W6-CRIT-02: saveAccount previously accepted a `userId` from the
 * client and updated the `users` row matching that id. Any authenticated
 * user could change another user's full_name (and, with the equivalent
 * bug class, cross-tenant personal info) by passing a different UUID. The
 * fix: ignore any caller-supplied id; always resolve the acting user from
 * the session.
 */
export async function saveAccount(_unusedUserId: string | undefined, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { error } = await supabase
      .from("users")
      .update({
        full_name: formData.get("full_name") as string || null,
      })
      .eq("id", user.id);

    if (error) return { error: error.message };
    return { success: true };
  } catch (error) {
    logger.error("saveAccount failed", { error });
    return { error: "Operation failed" };
  }
}
