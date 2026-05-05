import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  resolveActiveTenantConfig,
  notFoundMetadata,
} from "@/lib/storefront/resolve-active-tenant";
import RepairEnquiryForm from "./RepairEnquiryForm";

interface Props {
  params: Promise<{ subdomain: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params;
  // P2-C: HARD CUTOFF on soft-deleted tenants — no business_name leak.
  const resolved = await resolveActiveTenantConfig(subdomain);
  if (!resolved) return notFoundMetadata();
  const name =
    resolved.config.meta_title ||
    resolved.config.business_name ||
    (subdomain.charAt(0).toUpperCase() + subdomain.slice(1));
  return { title: `Book a Repair — ${name}` };
}

export default function RepairEnquiryPageWrapper(props: Props) {
  return (
    <Suspense fallback={null}>
      <RepairEnquiryPage {...props} />
    </Suspense>
  );
}

async function RepairEnquiryPage({ params }: Props) {
  const { subdomain } = await params;

  // P2-C: HARD CUTOFF on soft-deleted tenants.
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
          <a href={`/${subdomain}/repairs`} className="text-white font-medium">Repairs</a>
          <a href={`/${subdomain}/appointments`} className="hover:text-white transition-colors">Book Appointment</a>
          <a href={`/${subdomain}/enquiry`} className="hover:text-white transition-colors">Contact</a>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-12 px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900" style={{ fontFamily: "'Georgia', serif" }}>
            Repair Enquiry
          </h1>
          <p className="text-stone-500 mt-2">
            Tell us about the item that needs repair and we'll get back to you with a quote.
          </p>
        </div>

        <RepairEnquiryForm
          subdomain={subdomain}
          tenantId={tenantId}
          primaryColor={primaryColor}
        />
      </div>
    </div>
  );
}
