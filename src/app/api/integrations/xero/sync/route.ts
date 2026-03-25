/**
 * POST /api/integrations/xero/sync
 *
 * Fetches invoices not yet pushed to Xero and creates them via
 * the Xero Accounting API. Handles token refresh automatically.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, getIntegration, upsertIntegration } from "@/lib/integrations";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_BASE = "https://api.xero.com";

async function refreshXeroToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const clientId = process.env.XERO_CLIENT_ID!;
  const clientSecret = process.env.XERO_CLIENT_SECRET!;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) return null;
  return res.json();
}

async function getValidAccessToken(
  tenantId: string,
  config: Record<string, unknown>
): Promise<string | null> {
  const expiresAt = config.expires_at as string | undefined;
  const isExpired = expiresAt
    ? new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000
    : true;

  if (!isExpired) return config.access_token as string;

  // Refresh the token
  const refreshed = await refreshXeroToken(config.refresh_token as string);
  if (!refreshed) return null;

  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await upsertIntegration(tenantId, "xero", {
    ...config,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: newExpiresAt,
  });

  return refreshed.access_token;
}

export async function POST(_req: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();
    const integration = await getIntegration(tenantId, "xero");

    if (!integration || integration.status !== "connected") {
      return NextResponse.json({ error: "Xero is not connected" }, { status: 400 });
    }

    const config = integration.config as Record<string, unknown>;
    const xeroTenantId = config.xero_tenant_id as string;
    if (!xeroTenantId) {
      return NextResponse.json(
        { error: "No Xero tenant ID found. Please reconnect." },
        { status: 400 }
      );
    }

    const accessToken = await getValidAccessToken(tenantId, config);
    if (!accessToken) {
      await upsertIntegration(tenantId, "xero", { ...config }, "error");
      return NextResponse.json(
        { error: "Could not refresh Xero token. Please reconnect." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    // Fetch invoices not yet pushed to Xero
    const { data: invoices, error: invErr } = await admin
      .from("invoices")
      .select(`
        id, invoice_number, invoice_date, due_date,
        subtotal, tax_amount, tax_name, discount_amount, total, amount_paid,
        customer_id, tenant_id,
        customers (id, full_name, email),
        invoice_line_items (id, description, quantity, unit_price, discount_pct, total, sort_order)
      `)
      .eq("tenant_id", tenantId)
      .is("xero_invoice_id", null)
      .neq("status", "draft");

    if (invErr) {
      return NextResponse.json({ error: invErr.message }, { status: 500 });
    }

    const synced: string[] = [];
    const errors: string[] = [];

    for (const invoice of invoices ?? []) {
      try {
        const customer = Array.isArray(invoice.customers)
          ? invoice.customers[0]
          : invoice.customers as any;

        const lineItems = (invoice.invoice_line_items as any[] ?? []).map((li: any) => ({
          Description: li.description,
          Quantity: li.quantity,
          UnitAmount: li.unit_price,
          DiscountRate: li.discount_pct ?? 0,
          AccountCode: "200", // default sales account
        }));

        const xeroInvoice = {
          Type: "ACCREC",
          InvoiceNumber: invoice.invoice_number,
          Date: invoice.invoice_date,
          DueDate: invoice.due_date ?? invoice.invoice_date,
          Contact: {
            Name: customer?.full_name || "Unknown Customer",
            EmailAddress: customer?.email ?? undefined,
          },
          LineItems: lineItems,
          Status: "AUTHORISED",
        };

        const res = await fetch(`${XERO_API_BASE}/api.xro/2.0/Invoices`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Xero-tenant-id": xeroTenantId,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ Invoices: [xeroInvoice] }),
        });

        if (res.ok) {
          const data = await res.json();
          const xeroId = data?.Invoices?.[0]?.InvoiceID;
          if (xeroId) {
            await admin
              .from("invoices")
              .update({ xero_invoice_id: xeroId })
              .eq("id", invoice.id);
            synced.push(invoice.id);
          }
        } else {
          const text = await res.text();
          errors.push(`Invoice ${invoice.invoice_number}: ${text.slice(0, 200)}`);
        }
      } catch (e) {
        errors.push(`Invoice ${invoice.id}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }

    // Update last_sync_at
    await admin
      .from("integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("type", "xero");

    return NextResponse.json({
      synced: synced.length,
      errors: errors.length,
      details: errors,
    });
  } catch (err) {
    logger.error("[xero/sync]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
