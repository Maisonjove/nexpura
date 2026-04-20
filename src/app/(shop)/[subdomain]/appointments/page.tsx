import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import { getShopDisplayName } from "@/lib/shop/display-name";
import AppointmentForm from "./AppointmentForm";

/**
 * /[subdomain]/appointments — public shop page, CC-ready.
 *
 * Same template as /settings/tags: synchronous default export returning
 * a Suspense boundary; all async work (params promise + Supabase read
 * + notFound branch) happens inside the async body component. The
 * loader takes `subdomain` as a parameter, so it's trivially cacheable
 * under CC with `'use cache' + cacheTag("website-config:" + subdomain)`.
 *
 * No auth-related cookie reads on this route — it's a public-facing
 * shop page gated only by the `website_config.published = true` flag.
 *
 * TODO(cacheComponents-flag): once the flag is globally on, add inside
 * `loadPublishedConfig`:
 *   'use cache';
 *   cacheLife('minutes');
 *   cacheTag(`website-config:${subdomain}`);
 * And call `revalidateTag(`website-config:${subdomain}`)` from the
 * tenant's website-settings server actions when they publish/unpublish
 * or change branding.
 */

interface PageProps {
  params: Promise<{ subdomain: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { subdomain } = await params;
  const name = await getShopDisplayName(subdomain);
  return { title: `Book an Appointment — ${name}` };
}

export default function AppointmentPage({ params }: PageProps) {
  return (
    <Suspense fallback={<AppointmentSkeleton />}>
      <AppointmentBody paramsPromise={params} />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic body. Awaits the params promise, loads the published website
// config for the subdomain, and either 404s or renders the shell.
// ─────────────────────────────────────────────────────────────────────────
async function AppointmentBody({ paramsPromise }: { paramsPromise: Promise<{ subdomain: string }> }) {
  const { subdomain } = await paramsPromise;
  const config = await loadPublishedConfig(subdomain);
  if (!config) notFound();

  const primaryColor = (config.primary_color as string) || "amber-700";
  const font = (config.font as string) || "Inter";
  const businessName = (config.business_name as string) || subdomain;
  const tenantId = config.tenant_id as string;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: `'${font}', sans-serif` }}>
      {/* Nav */}
      <nav style={{ backgroundColor: primaryColor }} className="px-6 py-4 flex items-center justify-between">
        <a href={`/${subdomain}`} className="text-white font-bold text-lg">{businessName}</a>
        <div className="flex items-center gap-4 text-sm text-white/80">
          <a href={`/${subdomain}/catalogue`} className="hover:text-white transition-colors">Catalogue</a>
          <a href={`/${subdomain}/repairs`} className="hover:text-white transition-colors">Repairs</a>
          <a href={`/${subdomain}/appointments`} className="text-white font-medium">Book Appointment</a>
          <a href={`/${subdomain}/enquiry`} className="hover:text-white transition-colors">Contact</a>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-12 px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900" style={{ fontFamily: "'Georgia', serif" }}>
            Book an Appointment
          </h1>
          <p className="text-stone-500 mt-2">
            Request an appointment and we&apos;ll confirm your preferred time.
          </p>
        </div>

        <AppointmentForm
          subdomain={subdomain}
          tenantId={tenantId}
          primaryColor={primaryColor}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cacheable per subdomain. Published website config only — if the shop
// isn't published the result is null and the body 404s.
// ─────────────────────────────────────────────────────────────────────────
interface WebsiteConfig {
  subdomain: string;
  primary_color: string | null;
  font: string | null;
  business_name: string | null;
  tenant_id: string;
  published: boolean;
}

async function loadPublishedConfig(subdomain: string): Promise<WebsiteConfig | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`website-config:${subdomain}`);
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("website_config")
    .select("*")
    .eq("subdomain", subdomain)
    .eq("published", true)
    .maybeSingle();
  return (data as WebsiteConfig | null) ?? null;
}

function AppointmentSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-stone-300 h-14" />
      <div className="max-w-2xl mx-auto py-12 px-6 space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-32 rounded-lg" />
      </div>
    </div>
  );
}
