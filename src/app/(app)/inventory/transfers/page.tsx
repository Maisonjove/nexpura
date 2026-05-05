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

  // Joey 2026-05-05 (QA audit C-04): pre-fix this check was inverted —
  // the page denied access if `allowedLocationIds !== null` (which means
  // "user is restricted to a subset"). The canonical pattern across
  // LocationContext.tsx:69 + TransfersClient.tsx:126 treats NULL as
  // "all access" (owner/manager) and a populated array as "restricted
  // subset". Fixed to match.
  // Filter by user's accessible locations if restricted to a populated subset.
  if (allowedLocationIds !== null && allowedLocationIds.length > 0) {
    // Show transfers where user's location is either source or destination.
    // W2-004: allowedLocationIds is a UUID array read from
    // team_members.allowed_location_ids (server-only, not user-controlled),
    // so the `.in.(...)` interpolation is safe. The lint pattern targets
    // `%${}%` / `.eq.${}` / `.ilike.${}` specifically.
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
  const inventoryQuery = admin
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
