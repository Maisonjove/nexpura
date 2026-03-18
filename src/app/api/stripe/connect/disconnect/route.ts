/**
 * POST /api/stripe/connect/disconnect
 * 
 * Disconnects Stripe Connect account from tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_req: NextRequest) {
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

    // Remove Stripe account ID from tenant
    // Note: This doesn't delete the Stripe account, just disconnects it from Nexpura
    const { error } = await admin
      .from("tenants")
      .update({ stripe_account_id: null })
      .eq("id", userData.tenant_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[stripe/connect/disconnect]", err);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
