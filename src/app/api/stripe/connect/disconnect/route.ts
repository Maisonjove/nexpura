/**
 * POST /api/stripe/connect/disconnect
 *
 * Disconnects Stripe Connect account from tenant.
 *
 * Pre-fix this only nulled tenants.stripe_account_id and told Stripe
 * nothing — the connected account stayed linked to our platform on
 * Stripe's side, kept emitting webhooks into the void, and could
 * still be re-used by a malicious staff member who immediately
 * connected a *different* Stripe account: payment-routing would now
 * fan out to whichever of N accounts answered the webhook last. Now
 * we deauthorize the OAuth grant via Stripe before nulling the
 * column, so the link is one-way severed on both sides.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(_req: NextRequest) {
  const ip = _req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's tenant and verify owner/manager role
    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    // Only owners/managers can disconnect
    if (!["owner", "manager"].includes(userData.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Look up the current connected account ID so we can deauthorize it
    // on Stripe's side BEFORE we forget about it locally.
    const { data: tenantRow } = await admin
      .from("tenants")
      .select("stripe_account_id")
      .eq("id", userData.tenant_id)
      .single();
    const oldAccountId: string | null = tenantRow?.stripe_account_id ?? null;

    // Best-effort OAuth deauthorize. If Stripe rejects (already
    // disconnected, account doesn't exist, missing platform client_id)
    // we still null the local column — but we record the failure in
    // the audit log so ops can verify Stripe-side cleanup later.
    if (oldAccountId) {
      const stripe = getStripe();
      const platformClientId = process.env.STRIPE_CONNECT_CLIENT_ID;
      if (stripe && platformClientId) {
        try {
          await stripe.oauth.deauthorize({
            client_id: platformClientId,
            stripe_user_id: oldAccountId,
          });
        } catch (deauthErr) {
          logger.warn("[stripe/connect/disconnect] deauthorize failed; will null local column anyway", {
            tenantId: userData.tenant_id,
            stripeAccountId: oldAccountId,
            error: deauthErr instanceof Error ? deauthErr.message : String(deauthErr),
          });
          await logAuditEvent({
            tenantId: userData.tenant_id,
            userId: user.id,
            action: "stripe_connect_deauthorize_failed",
            entityType: "tenant",
            entityId: userData.tenant_id,
            newData: { stripe_account_id: oldAccountId },
          });
        }
      } else {
        logger.warn("[stripe/connect/disconnect] STRIPE_SECRET_KEY or STRIPE_CONNECT_CLIENT_ID missing — skipping deauthorize", {
          tenantId: userData.tenant_id,
        });
      }
    }

    // Remove Stripe account ID from tenant
    const { error } = await admin
      .from("tenants")
      .update({ stripe_account_id: null })
      .eq("id", userData.tenant_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit the local change too — ops can correlate with the Stripe
    // dashboard if a customer reports payments going to the wrong
    // account after a re-connect.
    await logAuditEvent({
      tenantId: userData.tenant_id,
      userId: user.id,
      action: "stripe_connect_disconnect",
      entityType: "tenant",
      entityId: userData.tenant_id,
      newData: { previous_stripe_account_id: oldAccountId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("[stripe/connect/disconnect]", err);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
