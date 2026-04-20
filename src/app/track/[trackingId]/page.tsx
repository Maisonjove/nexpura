import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import TrackingPageClient from "./TrackingPageClient";
import { getTrackingThread } from "@/lib/messaging";

// Revalidate tracking data every 30 seconds
// This means updates show within 30s but pages load instantly from cache
export const revalidate = 30;

interface PageProps {
  params: Promise<{ trackingId: string }>;
}

interface OrderData {
  id: string;
  tracking_id: string;
  order_type: "repair" | "bespoke";
  status: string;
  item_description: string;
  item_type?: string;
  estimated_completion_date: string | null;
  created_at: string;
  tenant: {
    business_name: string;
    logo_url?: string;
  };
  attachments: Array<{
    id: string;
    file_url: string;
    file_name: string;
    file_type: string | null;
    description: string | null;
    created_at: string;
  }>;
  status_history: Array<{
    id: string;
    status: string;
    notes: string | null;
    changed_at: string;
  }>;
}

// Validate tracking ID format to prevent abuse
function isValidTrackingId(id: string): boolean {
  // Only allow valid tracking ID formats: RPR-XXXXXXXX or BSP-XXXXXXXX
  return /^(RPR|BSP)-[A-F0-9]{8}$/i.test(id);
}

async function fetchOrderData(trackingId: string): Promise<OrderData | null> {
  // Use admin client (service role) - this bypasses RLS
  // Safe because we're server-side only and validate the tracking ID format
  const supabase = createAdminClient();
  const upperTrackingId = trackingId.toUpperCase();

  // Validate tracking ID format to prevent enumeration attacks
  if (!isValidTrackingId(upperTrackingId)) {
    return null;
  }

  // Try repairs first
  if (upperTrackingId.startsWith("RPR-")) {
    const { data: repair, error } = await supabase
      .from("repairs")
      .select(`
        id,
        tracking_id,
        stage,
        item_description,
        item_type,
        estimated_completion_date,
        created_at,
        tenant_id,
        tenants!inner (
          business_name,
          logo_url
        )
      `)
      .eq("tracking_id", upperTrackingId)
      .is("deleted_at", null)
      .single();

    if (error || !repair) return null;

    // Fetch attachments and history in parallel for better performance
    const [attachmentsResult, historyResult] = await Promise.all([
      supabase
        .from("order_attachments")
        .select("id, file_url, file_name, file_type, description, created_at")
        .eq("order_type", "repair")
        .eq("order_id", repair.id)
        .eq("is_public", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("order_status_history")
        .select("id, status, notes, changed_at")
        .eq("order_type", "repair")
        .eq("order_id", repair.id)
        .order("changed_at", { ascending: false }),
    ]);

    const tenant = Array.isArray(repair.tenants) ? repair.tenants[0] : repair.tenants;

    return {
      id: repair.id,
      tracking_id: repair.tracking_id,
      order_type: "repair",
      status: repair.stage || "intake",
      item_description: repair.item_description,
      item_type: repair.item_type,
      estimated_completion_date: repair.estimated_completion_date,
      created_at: repair.created_at,
      tenant: {
        business_name: tenant?.business_name || "Jeweller",
        logo_url: tenant?.logo_url,
      },
      attachments: attachmentsResult.data || [],
      status_history: historyResult.data || [],
    };
  }

  // Try bespoke jobs
  if (upperTrackingId.startsWith("BSP-")) {
    const { data: bespoke, error } = await supabase
      .from("bespoke_jobs")
      .select(`
        id,
        tracking_id,
        stage,
        description,
        jewellery_type,
        estimated_completion_date,
        created_at,
        tenant_id,
        tenants!inner (
          business_name,
          logo_url
        )
      `)
      .eq("tracking_id", upperTrackingId)
      .is("deleted_at", null)
      .single();

    if (error || !bespoke) return null;

    // Fetch attachments and history in parallel for better performance
    const [attachmentsResult, historyResult] = await Promise.all([
      supabase
        .from("order_attachments")
        .select("id, file_url, file_name, file_type, description, created_at")
        .eq("order_type", "bespoke")
        .eq("order_id", bespoke.id)
        .eq("is_public", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("order_status_history")
        .select("id, status, notes, changed_at")
        .eq("order_type", "bespoke")
        .eq("order_id", bespoke.id)
        .order("changed_at", { ascending: false }),
    ]);

    const tenant = Array.isArray(bespoke.tenants) ? bespoke.tenants[0] : bespoke.tenants;

    return {
      id: bespoke.id,
      tracking_id: bespoke.tracking_id,
      order_type: "bespoke",
      status: bespoke.stage || "enquiry",
      item_description: bespoke.description,
      item_type: bespoke.jewellery_type,
      estimated_completion_date: bespoke.estimated_completion_date,
      created_at: bespoke.created_at,
      tenant: {
        business_name: tenant?.business_name || "Jeweller",
        logo_url: tenant?.logo_url,
      },
      attachments: attachmentsResult.data || [],
      status_history: historyResult.data || [],
    };
  }

  return null;
}

// Cached version of the fetch function - revalidates every 30 seconds
const getOrderByTrackingId = unstable_cache(
  async (trackingId: string) => fetchOrderData(trackingId),
  ["tracking-order"],
  { revalidate: 30, tags: ["tracking"] }
);

export default function TrackingPageWrapper(props: PageProps) {
  return (
    <Suspense fallback={null}>
      <TrackingPage {...props} />
    </Suspense>
  );
}

async function TrackingPage({ params }: PageProps) {
  const { trackingId } = await params;
  const order = await getOrderByTrackingId(trackingId);

  if (!order) {
    notFound();
  }

  // Messages are fetched fresh (not cached with the order) so new replies
  // from the jeweller appear as soon as they're sent, without waiting on
  // the 30s order-data revalidation window.
  const messages = await getTrackingThread(trackingId);

  return <TrackingPageClient order={order} initialMessages={messages} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { trackingId } = await params;
  return {
    title: `Track Order ${trackingId} | Nexpura`,
    description: "Track the status of your jewellery order",
  };
}
