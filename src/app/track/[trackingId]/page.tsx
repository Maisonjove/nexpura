import { createClient } from "@/lib/supabase/public";
import { notFound } from "next/navigation";
import TrackingPageClient from "./TrackingPageClient";

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

async function getOrderByTrackingId(trackingId: string): Promise<OrderData | null> {
  const supabase = createClient();
  const upperTrackingId = trackingId.toUpperCase();

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
      item_type: bespoke.item_type,
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

export default async function TrackingPage({ params }: PageProps) {
  const { trackingId } = await params;
  const order = await getOrderByTrackingId(trackingId);

  if (!order) {
    notFound();
  }

  return <TrackingPageClient order={order} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { trackingId } = await params;
  return {
    title: `Track Order ${trackingId} | Nexpura`,
    description: "Track the status of your jewellery order",
  };
}
