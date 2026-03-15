/**
 * POST /api/integrations/insurance/setup
 *
 * Saves insurance valuation settings.
 * Body: { enabled, appraiser_name, appraiser_license, valuation_basis }
 *
 * GET returns current settings.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, getIntegration, upsertIntegration } from "@/lib/integrations";

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();
    const body = await req.json();
    const { enabled, appraiser_name, appraiser_license, valuation_basis } = body;

    const { error } = await upsertIntegration(
      tenantId,
      "insurance",
      {
        enabled: !!enabled,
        appraiser_name: appraiser_name ?? null,
        appraiser_license: appraiser_license ?? null,
        valuation_basis: valuation_basis ?? "replacement_value",
      },
      enabled ? "connected" : "disconnected"
    );

    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[insurance/setup]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(_req: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();
    const integration = await getIntegration(tenantId, "insurance");
    if (!integration) {
      return NextResponse.json({
        enabled: false,
        appraiser_name: null,
        appraiser_license: null,
        valuation_basis: "replacement_value",
      });
    }

    const cfg = integration.config as Record<string, unknown>;
    return NextResponse.json({
      enabled: cfg.enabled ?? false,
      appraiser_name: cfg.appraiser_name ?? null,
      appraiser_license: cfg.appraiser_license ?? null,
      valuation_basis: cfg.valuation_basis ?? "replacement_value",
      status: integration.status,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
