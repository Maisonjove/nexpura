import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import logger from "@/lib/logger";

export async function POST(request: Request) {
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
    const { locationIds, startDate, endDate } = body;

    if (!locationIds?.length || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminClient();
    const tenantId = userData.tenant_id;

    // Fetch stats for each location in parallel
    const statsPromises = locationIds.map(async (locationId: string) => {
      const [salesResult, repairsResult, stockResult, staffResult] = await Promise.all([
        // Sales total for location
        admin
          .from("sales")
          .select("total")
          .eq("tenant_id", tenantId)
          .eq("location_id", locationId)
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        
        // Completed repairs count
        admin
          .from("repairs")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("location_id", locationId)
          .eq("stage", "collected")
          .gte("updated_at", startDate)
          .lte("updated_at", endDate),
        
        // Stock value at location
        admin
          .from("inventory")
          .select("retail_price, quantity")
          .eq("tenant_id", tenantId)
          .eq("location_id", locationId)
          .eq("status", "active")
          .is("deleted_at", null),
        
        // Staff count with access to this location
        admin
          .from("team_members")
          .select("id, allowed_location_ids")
          .eq("tenant_id", tenantId),
      ]);

      const salesTotal = (salesResult.data ?? []).reduce((sum, s) => sum + (s.total || 0), 0);
      const stockValue = (stockResult.data ?? []).reduce((sum, i) => sum + ((i.retail_price || 0) * Math.max(i.quantity || 0, 0)), 0);
      
      // Count staff with access to this location (null = all locations, or array contains this location)
      const staffCount = (staffResult.data ?? []).filter(m => 
        m.allowed_location_ids === null || 
        (Array.isArray(m.allowed_location_ids) && m.allowed_location_ids.includes(locationId))
      ).length;

      return {
        locationId,
        salesTotal,
        repairsCompleted: repairsResult.count ?? 0,
        stockValue,
        staffCount,
      };
    });

    const stats = await Promise.all(statsPromises);

    const res = NextResponse.json({ stats });
    res.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=60");
    return res;
  } catch (error) {
    logger.error("Location comparison error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
