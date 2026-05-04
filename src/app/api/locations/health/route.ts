import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import logger from "@/lib/logger";
import { withSentryFlush } from "@/lib/sentry-flush";

export const POST = withSentryFlush(async (request: Request) => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: "No tenant found" }, { status: 400 });
    }

    const body = await request.json();
    const { locationIds } = body;

    if (!locationIds?.length) {
      return NextResponse.json({ error: "Location IDs required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const tenantId = userData.tenant_id;

    // Fetch health stats for each location in parallel
    const healthPromises = locationIds.map(async (locationId: string) => {
      const [lowStockResult, pendingRepairsResult] = await Promise.all([
        // Low stock items at this location
        admin
          .from("inventory")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("location_id", locationId)
          .eq("status", "active")
          .eq("track_quantity", true)
          .is("deleted_at", null)
          .lt("quantity", 3),
        
        // Active repairs at this location
        admin
          .from("repairs")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("location_id", locationId)
          .not("stage", "in", '("collected","cancelled")')
          .is("deleted_at", null),
      ]);

      const lowStockCount = lowStockResult.count ?? 0;
      const pendingRepairsCount = pendingRepairsResult.count ?? 0;
      const todayAppointmentsCount = 0; // Placeholder - needs appointments table

      // Location needs attention if low stock > 5 or other thresholds
      const needsAttention = lowStockCount > 5;

      return {
        locationId,
        lowStockCount,
        pendingRepairsCount,
        todayAppointmentsCount,
        needsAttention,
      };
    });

    const health = await Promise.all(healthPromises);

    return NextResponse.json({ health });
  } catch (error) {
    logger.error("Location health error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
