import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import PassportDetailClient from "./PassportDetailClient";
import PassportPhotos from "./PassportPhotos";

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

export default async function PassportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Get current user's tenant_id
  const { data: { user } } = await supabase.auth.getUser();
  const { data: userData } = user
    ? await supabase.from("users").select("tenant_id").eq("id", user.id).single()
    : { data: null };
  const tenantId = userData?.tenant_id ?? "";

  const { data: passport, error } = await supabase
    .from("passports")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !passport) notFound();

  const { data: events } = await supabase
    .from("passport_events")
    .select("id, event_type, event_data, notes, created_at")
    .eq("passport_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/passports"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-forest transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Passports
      </Link>

      <PassportDetailClient
        passport={passport as Passport}
        events={(events ?? []) as PassportEvent[]}
      />

      <PassportPhotos
        passportId={id}
        tenantId={tenantId}
        primaryImage={(passport as Passport & { primary_image?: string | null }).primary_image ?? null}
        additionalImages={((passport as Passport & { images?: string[] | null }).images ?? []) as string[]}
      />
    </div>
  );
}
