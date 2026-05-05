import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  resolveActiveTenantConfig,
  notFoundMetadata,
} from "@/lib/storefront/resolve-active-tenant";
import TrackRepairClient from "./TrackRepairClient";

interface Props {
  params: Promise<{ subdomain: string }>;
}

export default function TrackRepairPageWrapper(props: Props) {
  return (
    <Suspense fallback={null}>
      <TrackRepairPage {...props} />
    </Suspense>
  );
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
  return { title: `Track Your Repair — ${name}` };
}

async function TrackRepairPage({ params }: Props) {
  const { subdomain } = await params;

  // P2-C: HARD CUTOFF on soft-deleted tenants. The previous implementation
  // rendered the page with fallback values even when no tenant matched —
  // attackers could probe arbitrary subdomains and the tracker would
  // happily render. Now we 404 cleanly.
  const resolved = await resolveActiveTenantConfig(subdomain);
  if (!resolved) notFound();
  const { config } = resolved;

  const primaryColor = (config.primary_color as string) || "amber-700";
  const font = (config.font as string) || "Inter";
  const businessName = (config.business_name as string) || subdomain;

  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: `'${font}', sans-serif` }}>
      {/* Nav */}
      <nav style={{ backgroundColor: primaryColor }} className="px-6 py-4 flex items-center justify-between">
        <a href={`/${subdomain}`} className="text-white font-bold text-lg">
          {businessName}
        </a>
        <div className="flex items-center gap-4 text-sm text-white/80">
          <a href={`/${subdomain}/catalogue`} className="hover:text-white transition-colors">
            Catalogue
          </a>
          <a href={`/${subdomain}/repairs`} className="hover:text-white transition-colors">
            Repairs
          </a>
          <a href={`/${subdomain}/appointments`} className="hover:text-white transition-colors">
            Book Appointment
          </a>
          <a href={`/${subdomain}/track`} className="text-white font-medium">
            Track Repair
          </a>
          <a href={`/${subdomain}/enquiry`} className="hover:text-white transition-colors">
            Contact
          </a>
        </div>
      </nav>

      <TrackRepairClient subdomain={subdomain} />
    </div>
  );
}
