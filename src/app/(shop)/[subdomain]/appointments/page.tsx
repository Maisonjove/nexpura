import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  resolveActiveTenantConfig,
  notFoundMetadata,
} from "@/lib/storefront/resolve-active-tenant";
import { Skeleton } from "@/components/ui/skeleton";
import AppointmentForm from "./AppointmentForm";

/**
 * /[subdomain]/appointments — public shop page, CC-ready.
 *
 * Same template as /settings/tags: synchronous default export returning
 * a Suspense boundary; all async work (params promise + Supabase read
 * + notFound branch) happens inside the async body component.
 *
 * No auth-related cookie reads on this route — it's a public-facing
 * shop page gated only by the `website_config.published = true` flag
 * AND the `tenants.deleted_at IS NULL` HARD CUTOFF (P2-C, 2026-05-05).
 *
 * Tenant resolution is centralised in `resolveActiveTenantConfig`
 * (src/lib/storefront/resolve-active-tenant.ts), which joins
 * website_config -> tenants and returns null for any soft-deleted
 * tenant. Changing the policy here means changing it in one place for
 * all 11 storefront pages + 7 generateMetadata exporters.
 */

interface PageProps {
  params: Promise<{ subdomain: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { subdomain } = await params;
  // P2-C: HARD CUTOFF on soft-deleted tenants — no business_name leak.
  const resolved = await resolveActiveTenantConfig(subdomain);
  if (!resolved) return notFoundMetadata();
  const name =
    resolved.config.meta_title ||
    resolved.config.business_name ||
    (subdomain.charAt(0).toUpperCase() + subdomain.slice(1));
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
// config + non-deleted tenant for the subdomain, and either 404s or
// renders the shell.
// ─────────────────────────────────────────────────────────────────────────
async function AppointmentBody({ paramsPromise }: { paramsPromise: Promise<{ subdomain: string }> }) {
  const { subdomain } = await paramsPromise;
  const resolved = await resolveActiveTenantConfig(subdomain);
  if (!resolved) notFound();
  const { config, tenant } = resolved;

  const primaryColor = (config.primary_color as string) || "amber-700";
  const font = (config.font as string) || "Inter";
  const businessName = (config.business_name as string) || subdomain;
  const tenantId = tenant.id;

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
