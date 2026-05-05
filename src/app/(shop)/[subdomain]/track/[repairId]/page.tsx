import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveActiveTenantConfig,
  notFoundMetadata,
} from "@/lib/storefront/resolve-active-tenant";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { CheckCircle2, Clock, AlertCircle, Phone, Mail, MapPin, Wrench, Camera } from "lucide-react";

interface Props {
  params: Promise<{ subdomain: string; repairId: string }>;
}

export default function RepairTrackingPageWrapper({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <RepairTrackingPage params={params} />
    </Suspense>
  );
}

const STAGE_ORDER = [
  "intake",
  "quoted",
  "approved",
  "in_progress",
  "in_workshop",
  "quality_check",
  "ready",
  "collected",
];

const STAGE_LABELS: Record<string, string> = {
  intake: "Received",
  quoted: "Quote Ready",
  approved: "Approved",
  in_progress: "In Progress",
  in_workshop: "In Workshop",
  quality_check: "Quality Check",
  ready: "Ready for Collection",
  collected: "Collected",
  cancelled: "Cancelled",
  on_hold: "On Hold",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params;
  // P2-C: HARD CUTOFF on soft-deleted tenants — no business_name leak.
  const resolved = await resolveActiveTenantConfig(subdomain);
  if (!resolved) return notFoundMetadata();
  const name = resolved.config.business_name || "Store";
  return { title: `Repair Status — ${name}` };
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function StageTimeline({ stage }: { stage: string }) {
  const currentIdx = STAGE_ORDER.indexOf(stage);
  const isCancelled = stage === "cancelled";
  const isOnHold = stage === "on_hold";

  if (isCancelled || isOnHold) {
    return (
      <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
        <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
        <span className="text-sm font-medium text-amber-800">
          {isCancelled
            ? "This repair has been cancelled. Please contact us for more information."
            : "This repair is currently on hold. Please contact us for more information."}
        </span>
      </div>
    );
  }

  const displayStages = ["intake", "in_progress", "quality_check", "ready"];

  return (
    <div className="space-y-3">
      {displayStages.map((s) => {
        const idx = STAGE_ORDER.indexOf(s);
        const completed = currentIdx >= idx && currentIdx >= 0;
        const isActiveStep =
          STAGE_ORDER[currentIdx] === s ||
          (s === "in_progress" && ["approved", "in_progress", "in_workshop"].includes(stage));
        return (
          <div key={s} className="flex items-center gap-4">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                completed
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "bg-white border-stone-200 text-stone-300"
              }`}
            >
              {completed ? <CheckCircle2 size={14} /> : <Clock size={14} />}
            </div>
            <span
              className={`text-sm ${completed ? "text-stone-900" : "text-stone-400"} ${
                isActiveStep ? "font-bold" : "font-medium"
              }`}
            >
              {STAGE_LABELS[s] ?? s}
              {isActiveStep && completed && (
                <span className="ml-2 text-xs text-emerald-600 font-normal">← Current step</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

async function RepairTrackingPage({ params }: Props) {
  const { subdomain, repairId } = await params;
  const admin = createAdminClient();

  // P2-C: HARD CUTOFF on soft-deleted tenants.
  const resolved = await resolveActiveTenantConfig(subdomain);
  if (!resolved) notFound();
  const { config, tenant } = resolved;

  const primaryColor = (config.primary_color as string) || "#b45309";
  const font = (config.font as string) || "Inter";
  const businessName = (config.business_name as string) || subdomain;
  const tenantId = tenant.id;
  // The original page selected `phone, email, address` from website_config —
  // those columns don't exist on that table (verified 2026-05-05); the real
  // fields are `contact_phone`, `contact_email`, `contact_address`. Pre-fix
  // the contact card was always empty. Read the correct columns now.
  const storePhone = (config.contact_phone as string | null) ?? null;
  const storeEmail = (config.contact_email as string | null) ?? null;
  const storeAddress = (config.contact_address as string | null) ?? null;

  // Fetch repair. Pre-fix selected `notes` (column doesn't exist on
  // repairs — verified 2026-04-25; real column is `internal_notes`)
  // → maybeSingle returned null → page 404'd for every repair.
  const { data: repair } = await admin
    .from("repairs")
    .select("id, repair_number, item_description, stage, due_date, created_at, internal_notes")
    .eq("id", repairId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!repair) notFound();

  // Fetch stage history (table exists — order_status_history was the
  // canonical name; repair_stages may also exist depending on the
  // tenant). Use order_status_history scoped to repair.
  const { data: stageHistory } = await admin
    .from("order_status_history")
    .select("status, changed_at, notes")
    .eq("order_type", "repair")
    .eq("order_id", repairId)
    .order("changed_at", { ascending: true })
    .limit(20);

  // Fetch photos. Pre-fix queried `repair_attachments` — table doesn't
  // exist (verified 2026-04-25). Real table is `order_attachments` with
  // a (order_type, order_id) shape, same one /track/[trackingId] uses.
  const { data: attachments } = await admin
    .from("order_attachments")
    .select("id, file_url, file_name, created_at")
    .eq("order_type", "repair")
    .eq("order_id", repairId)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(10);

  const stage = repair.stage as string;
  const stageLabel = STAGE_LABELS[stage] ?? stage.replace(/_/g, " ");
  const isReady = stage === "ready";
  const isCollected = stage === "collected";

  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: `'${font}', sans-serif` }}>
      {/* Nav */}
      <nav
        className="px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: primaryColor.startsWith("#") ? primaryColor : `var(--color-${primaryColor})` }}
      >
        <a href={`/${subdomain}`} className="text-white font-bold text-lg">
          {businessName}
        </a>
        <div className="flex items-center gap-4 text-sm text-white/80">
          <a href={`/${subdomain}/track`} className="hover:text-white transition-colors">
            Track Another
          </a>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-10 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-amber-700/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wrench size={26} className="text-amber-700" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Repair Status</h1>
          <p className="text-stone-500 text-sm mt-1 font-mono">
            Ticket #{repair.repair_number ?? repair.id.slice(-6).toUpperCase()}
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-stone-200 shadow-lg overflow-hidden space-y-0">
          {/* Status Banner */}
          {isReady && (
            <div className="p-5 bg-emerald-50 border-b border-emerald-200 flex items-center gap-3">
              <CheckCircle2 size={22} className="text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-800">Your item is ready for collection! 🎉</p>
                <p className="text-xs text-emerald-700 mt-0.5">Please bring your ticket number when you come in.</p>
              </div>
            </div>
          )}
          {isCollected && (
            <div className="p-5 bg-stone-50 border-b border-stone-200 flex items-center gap-3">
              <CheckCircle2 size={22} className="text-stone-500 flex-shrink-0" />
              <p className="text-sm font-medium text-stone-700">This item has been collected. Thank you!</p>
            </div>
          )}

          <div className="p-6 space-y-6">
            {/* Item Details */}
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">Your Item</p>
              <h2 className="text-xl font-bold text-stone-900">{repair.item_description || "Repair"}</h2>
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-700/10 text-amber-800 rounded-full text-xs font-semibold">
                <span className="w-1.5 h-1.5 bg-amber-600 rounded-full" />
                {stageLabel}
              </div>
            </div>

            {/* Progress Timeline */}
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">Progress</p>
              <StageTimeline stage={stage} />
            </div>

            {/* Stage History */}
            {stageHistory && stageHistory.length > 1 && (
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">Timeline</p>
                <div className="space-y-2">
                  {stageHistory.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-stone-800">
                          {STAGE_LABELS[s.status as string] ?? (s.status as string).replace(/_/g, " ")}
                        </span>
                        <span className="text-stone-400 ml-2 text-xs">{fmtDate(s.changed_at as string)}</span>
                        {s.notes && <p className="text-xs text-stone-500 mt-0.5">{s.notes as string}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-stone-50 rounded-xl">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">Received</p>
                <p className="text-sm font-medium text-stone-900">{fmtDate(repair.created_at as string)}</p>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">Est. Ready</p>
                <p className="text-sm font-medium text-stone-900">
                  {fmtDate(repair.due_date as string) ?? "To be advised"}
                </p>
              </div>
            </div>

            {/* Photos */}
            {attachments && attachments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                  <Camera size={12} /> Photos
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {attachments.map((att) => (
                    <a
                      key={att.id as string}
                      href={att.file_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative aspect-square bg-stone-100 rounded-xl overflow-hidden block hover:opacity-90 transition-opacity"
                    >
                      <Image
                        src={att.file_url as string}
                        alt={att.file_name as string}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 33vw, 120px"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Store Contact */}
            <div className="border-t border-stone-100 pt-4">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">Questions?</p>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-stone-900">{businessName}</p>
                {storePhone && (
                  <a href={`tel:${storePhone}`} className="flex items-center gap-2 text-sm text-amber-700 hover:underline">
                    <Phone size={14} /> {storePhone}
                  </a>
                )}
                {storeEmail && (
                  <a href={`mailto:${storeEmail}`} className="flex items-center gap-2 text-sm text-amber-700 hover:underline">
                    <Mail size={14} /> {storeEmail}
                  </a>
                )}
                {storeAddress && (
                  <p className="flex items-start gap-2 text-sm text-stone-500">
                    <MapPin size={14} className="flex-shrink-0 mt-0.5" /> {storeAddress}
                  </p>
                )}
              </div>
            </div>

            {/* Track another */}
            <div className="text-center pt-2">
              <a href={`/${subdomain}/track`} className="text-sm text-stone-400 hover:text-stone-600 transition-colors underline">
                Track a different repair →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
