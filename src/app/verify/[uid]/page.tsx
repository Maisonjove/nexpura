import { createClient } from "@/lib/supabase/public";
import Image from "next/image";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

interface Passport {
  id: string;
  passport_uid: string;
  title: string;
  jewellery_type: string | null;
  description: string | null;
  metal_type: string | null;
  metal_colour: string | null;
  metal_purity: string | null;
  metal_weight_grams: number | null;
  stone_type: string | null;
  stone_shape: string | null;
  stone_carat: number | null;
  stone_colour: string | null;
  stone_clarity: string | null;
  stone_origin: string | null;
  stone_cert_number: string | null;
  ring_size: string | null;
  setting_style: string | null;
  maker_name: string | null;
  made_in: string | null;
  year_made: number | null;
  current_owner_name: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  primary_image: string | null;
  status: string;
  is_public: boolean;
  verified_at: string | null;
  created_at: string;
  tenant_id: string;
}

interface PassportEvent {
  id: string;
  event_type: string;
  notes: string | null;
  created_at: string;
}

function SpecItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">{label}</dt>
      <dd className="text-sm font-semibold text-[#071A0D] capitalize">{String(value)}</dd>
    </div>
  );
}

function eventLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const EVENT_COLOURS: Record<string, string> = {
  created: "bg-[#52B788]/15 text-[#52B788]",
  ownership_transferred: "bg-stone-100 text-stone-700",
  reported_lost: "bg-red-50 text-red-500",
  reported_stolen: "bg-red-50 text-red-600",
  recovered: "bg-emerald-50 text-emerald-600",
  authenticated: "bg-emerald-50 text-emerald-600",
  updated: "bg-gray-100 text-gray-500",
};

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const supabase = createClient();

  const { data: passport } = await supabase
    .from("passports")
    .select("*")
    .eq("passport_uid", uid)
    .eq("is_public", true)
    .eq("status", "active")
    .is("deleted_at", null)
    .single();

  if (!passport) {
    return (
      <div className="min-h-screen bg-[#F8F5F0] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          {/* Logo */}
          <h1 className="font-semibold text-3xl font-bold text-[#071A0D] mb-1">nexpura</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-12">Digital Jewellery Passport</p>

          <div className="bg-white rounded-2xl border border-[#E8E8E8] p-8 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="font-semibold text-xl font-semibold text-[#071A0D] mb-2">Passport Not Found</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              This passport does not exist or is private. If you believe this is an error, please contact your jeweller.
            </p>
          </div>

          <p className="text-xs text-gray-400 mt-8">Verified by Nexpura · nexpura.com</p>
        </div>
      </div>
    );
  }

  const p = passport as Passport;

  // Fetch tenant name
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", p.tenant_id)
    .single();

  // Fetch events (public read)
  const { data: events } = await supabase
    .from("passport_events")
    .select("id, event_type, notes, created_at")
    .eq("passport_id", p.id)
    .order("created_at", { ascending: true });

  const safeEvents = (events ?? []) as PassportEvent[];

  const hasStone = p.stone_type || p.stone_carat || p.stone_colour || p.stone_clarity;
  const hasRing = p.ring_size || p.setting_style;
  const hasMetal = p.metal_type || p.metal_purity || p.metal_weight_grams;
  const hasProvenance = p.maker_name || p.made_in || p.year_made;
  const hasOwnership = p.current_owner_name || p.purchase_date;

  return (
    <div className="min-h-screen bg-[#F8F5F0]">
      {/* Hero strip */}
      <div className="bg-[#071A0D] text-white px-4 py-8 text-center">
        <h1 className="font-semibold text-2xl sm:text-3xl font-bold tracking-tight">nexpura</h1>
        <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Digital Jewellery Passport</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Verified badge + UID + title */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 sm:p-8 shadow-sm text-center">
          {/* Verified badge */}
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-semibold mb-5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Verified Authentic
          </div>

          {/* UID */}
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="font-mono text-base sm:text-lg font-bold bg-[#52B788]/10 text-[#52B788] px-4 py-1.5 rounded-lg tracking-wider">
              {p.passport_uid}
            </span>
          </div>

          {/* Title */}
          <h2 className="font-semibold text-2xl sm:text-3xl font-semibold text-[#071A0D] mt-1">
            {p.title}
          </h2>

          {p.jewellery_type && (
            <p className="text-sm text-gray-400 mt-1 capitalize">{p.jewellery_type.replace(/_/g, " ")}</p>
          )}

          {p.description && (
            <p className="text-sm text-gray-500 mt-3 leading-relaxed max-w-md mx-auto">{p.description}</p>
          )}

          {/* Issued by */}
          {tenant?.name && (
            <div className="mt-5 pt-5 border-t border-[#E8E8E8]">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1">Issued by</p>
              <p className="text-base font-semibold text-[#071A0D]">{tenant.name}</p>
            </div>
          )}
        </div>

        {/* Primary image hero */}
        {p.primary_image && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-sm">
            <Image
              src={p.primary_image}
              alt={p.title}
              width={800}
              height={400}
              className="w-full object-cover rounded-2xl max-h-[400px]"
              unoptimized
            />
          </div>
        )}

        {/* Specifications */}
        {(hasMetal || hasStone || hasRing) && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 shadow-sm">
            <h3 className="font-semibold text-lg font-semibold text-[#071A0D] mb-4">Specifications</h3>
            <div className="space-y-4">
              {hasMetal && (
                <div>
                  <p className="text-[10px] font-bold text-[#52B788] uppercase tracking-widest mb-2">Metal</p>
                  <dl className="grid grid-cols-2 gap-2">
                    <SpecItem label="Type" value={p.metal_type?.replace(/_/g, " ")} />
                    <SpecItem label="Colour" value={p.metal_colour} />
                    <SpecItem label="Purity" value={p.metal_purity} />
                    <SpecItem label="Weight" value={p.metal_weight_grams ? `${p.metal_weight_grams}g` : null} />
                  </dl>
                </div>
              )}
              {hasStone && (
                <div>
                  <p className="text-[10px] font-bold text-[#52B788] uppercase tracking-widest mb-2">Stone</p>
                  <dl className="grid grid-cols-2 gap-2">
                    <SpecItem label="Type" value={p.stone_type} />
                    <SpecItem label="Shape" value={p.stone_shape?.replace(/_/g, " ")} />
                    <SpecItem label="Carat" value={p.stone_carat ? `${p.stone_carat}ct` : null} />
                    <SpecItem label="Colour" value={p.stone_colour} />
                    <SpecItem label="Clarity" value={p.stone_clarity} />
                    <SpecItem label="Origin" value={p.stone_origin} />
                    {p.stone_cert_number && (
                      <div className="col-span-2">
                        <SpecItem label="Certificate" value={p.stone_cert_number} />
                      </div>
                    )}
                  </dl>
                </div>
              )}
              {hasRing && (
                <div>
                  <p className="text-[10px] font-bold text-[#52B788] uppercase tracking-widest mb-2">Ring</p>
                  <dl className="grid grid-cols-2 gap-2">
                    <SpecItem label="Size" value={p.ring_size} />
                    <SpecItem label="Setting" value={p.setting_style} />
                  </dl>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Provenance */}
        {hasProvenance && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 shadow-sm">
            <h3 className="font-semibold text-lg font-semibold text-[#071A0D] mb-4">Provenance</h3>
            <dl className="grid grid-cols-2 gap-2">
              <SpecItem label="Maker" value={p.maker_name} />
              <SpecItem label="Made In" value={p.made_in} />
              <SpecItem label="Year Made" value={p.year_made} />
            </dl>
          </div>
        )}

        {/* Ownership */}
        {hasOwnership && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 shadow-sm">
            <h3 className="font-semibold text-lg font-semibold text-[#071A0D] mb-4">Ownership</h3>
            <dl className="grid grid-cols-2 gap-2">
              {p.current_owner_name && (
                <div className="col-span-2">
                  <SpecItem label="Currently Owned By" value={p.current_owner_name} />
                </div>
              )}
              <SpecItem
                label="Purchase Date"
                value={p.purchase_date ? new Date(p.purchase_date).toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" }) : null}
              />
            </dl>
          </div>
        )}

        {/* Event Timeline */}
        {safeEvents.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 shadow-sm">
            <h3 className="font-semibold text-lg font-semibold text-[#071A0D] mb-5">History</h3>
            <div className="space-y-0">
              {safeEvents.map((event, idx) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        EVENT_COLOURS[event.event_type] || "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    {idx < safeEvents.length - 1 && (
                      <div className="w-px flex-1 bg-[#E8E8E8] my-1" />
                    )}
                  </div>
                  <div className={`pb-5 flex-1 min-w-0`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-[#071A0D]">
                        {eventLabel(event.event_type)}
                      </span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0 mt-0.5">
                        {new Date(event.created_at).toLocaleDateString("en-AU", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {event.notes && (
                      <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{event.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Passport issued date */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Passport Issued</span>
            <span className="font-medium text-[#071A0D]">
              {new Date(p.created_at).toLocaleDateString("en-AU", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 text-xs text-gray-400">
            <svg className="w-4 h-4 text-[#52B788]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Verified by <span className="font-semibold font-semibold text-[#071A0D]">Nexpura</span> · nexpura.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}
