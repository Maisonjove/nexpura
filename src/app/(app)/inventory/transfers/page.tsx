import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getUserLocationIds } from "@/lib/locations";
import TransfersClient from "./TransfersClient";

export const metadata = { title: "Stock Transfers — Nexpura" };

export default async function TransfersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");

  const admin = createAdminClient();
  const allowedLocationIds = await getUserLocationIds(user.id, userData.tenant_id);
  const isOwnerOrManager = userData.role === "owner" || userData.role === "manager";

  // Fetch transfers - filter by location if user is restricted
  let transfersQuery = admin
    .from("stock_transfers")
    .select(`
      *,
      from_location:from_location_id(id, name),
      to_location:to_location_id(id, name),
      created_by_user:created_by(email),
      dispatched_by_user:dispatched_by(email),
      received_by_user:received_by(email),
      items:stock_transfer_items(
        id,
        quantity,
        received_quantity,
        inventory:inventory_id(id, name, sku)
      )
    `)
    .eq("tenant_id", userData.tenant_id)
    .order("created_at", { ascending: false });

  // Filter by user's accessible locations if restricted
  if (allowedLocationIds !== null) {
    if (allowedLocationIds.length === 0) {
      // No location access
      return (
        <div className="max-w-2xl mx-auto py-16 text-center">
          <h1 className="text-2xl font-semibold text-stone-900 mb-3">No Location Access</h1>
          <p className="text-stone-500">You don&apos;t have access to any locations.</p>
        </div>
      );
    }
    // Show transfers where user's location is either source or destination
    transfersQuery = transfersQuery.or(`from_location_id.in.(${allowedLocationIds.join(",")}),to_location_id.in.(${allowedLocationIds.join(",")})`);
  }

  const { data: transfers } = await transfersQuery;

  // Fetch locations user has access to
  let locationsQuery = admin
    .from("locations")
    .select("*")
    .eq("tenant_id", userData.tenant_id)
    .eq("is_active", true)
    .order("name");

  if (allowedLocationIds !== null && allowedLocationIds.length > 0) {
    locationsQuery = locationsQuery.in("id", allowedLocationIds);
  }

  const { data: locations } = await locationsQuery;

  // Fetch inventory for transfer selection
  let inventoryQuery = admin
    .from("inventory")
    .select("id, name, sku, quantity, location_id")
    .eq("tenant_id", userData.tenant_id)
    .eq("status", "active")
    .is("deleted_at", null)
    .gt("quantity", 0)
    .order("name")
    .limit(500);

  const { data: inventory } = await inventoryQuery;

  return (
    <TransfersClient
      tenantId={userData.tenant_id}
      userId={user.id}
      initialTransfers={transfers ?? []}
      locations={locations ?? []}
      inventory={inventory ?? []}
      isOwnerOrManager={isOwnerOrManager}
      allowedLocationIds={allowedLocationIds}
    />
  );
}
