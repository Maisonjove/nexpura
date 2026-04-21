import { Suspense } from "react";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_cache } from "next/cache";
import TrackingPageClient from "./TrackingPageClient";
import { getTrackingThread } from "@/lib/messaging";
import { checkRateLimit } from "@/lib/rate-limit";

// Revalidate tracking data every 30 seconds
// This means updates show within 30s but pages load instantly from cache

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

    // order-attachments bucket is private — sign each file_url so the
    // customer can fetch it. See migration 20260421_order_attachments_private_bucket.sql.
    const { signOrderAttachments } = await import("@/lib/storage/signed-urls");
    const signedAttachments = await signOrderAttachments(attachmentsResult.data || []);

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
      attachments: signedAttachments,
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

    // Sign attachment URLs — bucket is private. See migration
    // 20260421_order_attachments_private_bucket.sql.
    const { signOrderAttachments } = await import("@/lib/storage/signed-urls");
    const signedAttachments = await signOrderAttachments(attachmentsResult.data || []);

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
      attachments: signedAttachments,
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

  // Audit finding (High): public /track/[id] had no rate limit, so the
  // 4-billion-entry `RPR-XXXXXXXX` namespace was scrapable. Cap per-IP
  // attempts on the API-tier bucket. Keep the message-fetch out of the
  // limited scope to avoid blocking legitimate refreshes.
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "anonymous";
  const { success } = await checkRateLimit(`track:${ip}`, "api");
  if (!success) {
    return <TrackOrderNotFound trackingId={trackingId} />;
  }

  const order = await getOrderByTrackingId(trackingId);

  if (!order) {
    // Customer-facing invalid-state: branded card (not the generic Next.js
    // 404 fallback). Covers both invalid format (regex reject in
    // fetchOrderData) and unknown/valid-format-but-no-row lookups.
    return <TrackOrderNotFound trackingId={trackingId} />;
  }

  // Messages are fetched fresh (not cached with the order) so new replies
  // from the jeweller appear as soon as they're sent, without waiting on
  // the 30s order-data revalidation window.
  const messages = await getTrackingThread(trackingId);

  return <TrackingPageClient order={order} initialMessages={messages} />;
}

function TrackOrderNotFound({ trackingId }: { trackingId: string }) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-stone-900 mb-2">Order Not Found</h1>
        <p className="text-stone-500 mb-2">
          We couldn&apos;t find an order with the tracking ID{" "}
          <span className="font-mono text-stone-700">{trackingId}</span>.
        </p>
        <p className="text-stone-500 mb-6 text-sm">
          Please double-check the ID in your email or text from the store. Tracking IDs look like{" "}
          <span className="font-mono text-stone-700">RPR-XXXXXXXX</span> or{" "}
          <span className="font-mono text-stone-700">BSP-XXXXXXXX</span>.
        </p>
        <a
          href="/"
          className="inline-block text-amber-700 hover:text-amber-800 font-medium"
        >
          Go to Nexpura →
        </a>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { trackingId } = await params;
  return {
    title: `Track Order ${trackingId} | Nexpura`,
    description: "Track the status of your jewellery order",
    robots: { index: false, follow: false },
  };
}
