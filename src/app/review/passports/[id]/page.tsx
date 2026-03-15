import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import PassportDetailClient from "@/app/(app)/passports/[id]/PassportDetailClient";
import PassportPhotos from "@/app/(app)/passports/[id]/PassportPhotos";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

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
  current_owner_email: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  status: string;
  is_public: boolean;
  verified_at: string | null;
  created_at: string;
}

interface PassportEvent {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}

export default async function ReviewPassportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: passport } = await admin
    .from("passports")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .single();

  if (!passport) {
    return (
      <div className="space-y-4">
        <Link
          href="/review/passports"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-stone-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Passports
        </Link>
        <div className="max-w-2xl mx-auto py-16 text-center">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-stone-900 mb-3">No Passport Data</h1>
          <p className="text-stone-500 max-w-md mx-auto">
            No passport records have been seeded for the demo tenant. Passports are digital identity certificates for fine jewellery pieces.
          </p>
        </div>
      </div>
    );
  }

  const { data: events } = await admin
    .from("passport_events")
    .select("id, event_type, event_data, notes, created_at")
    .eq("passport_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-4">
      <Link
        href="/review/passports"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-stone-900 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Passports
      </Link>

      <PassportDetailClient
        passport={passport as Passport}
        events={(events ?? []) as PassportEvent[]}
      />

      <PassportPhotos
        passportId={id}
        tenantId={TENANT_ID}
        primaryImage={(passport as Passport & { primary_image?: string | null }).primary_image ?? null}
        additionalImages={((passport as Passport & { images?: string[] | null }).images ?? []) as string[]}
      />
    </div>
  );
}
