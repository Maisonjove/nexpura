"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Routes that should be prefetched for faster navigation
const CRITICAL_ROUTES = [
  "/dashboard",
  "/pos",
  "/inventory",
  "/customers",
  "/invoices",
  "/repairs",
];

// Context-aware prefetching: prefetch routes likely to be visited from current route
const CONTEXTUAL_PREFETCH: Record<string, string[]> = {
  "/dashboard": ["/pos", "/inventory", "/repairs", "/customers", "/invoices", "/intake"],
  "/pos": ["/inventory", "/customers", "/invoices"],
  "/inventory": ["/inventory/new", "/inventory/receive", "/pos", "/stocktakes"],
  "/customers": ["/customers/new", "/pos", "/invoices"],
  "/invoices": ["/pos", "/customers", "/refunds"],
  "/repairs": ["/repairs/new", "/workshop", "/customers", "/bespoke"],
  "/bespoke": ["/bespoke/new", "/workshop", "/repairs", "/customers"],
  "/workshop": ["/repairs", "/bespoke"],
  "/settings": ["/settings/payments", "/settings/locations", "/settings/roles", "/billing"],
  "/marketing": ["/marketing/campaigns", "/marketing/bulk-email", "/marketing/segments"],
};

/**
 * PrefetchLinks component renders hidden Link elements to trigger
 * Next.js prefetching for likely next navigation destinations.
 * 
 * Add this to layout or main navigation wrapper components.
 */
export function PrefetchLinks() {
  const pathname = usePathname();
  
  // Get the base path (e.g., /repairs/123 -> /repairs)
  const basePath = "/" + (pathname?.split("/")[1] || "");
  
  // Get context-aware prefetch routes based on current page
  const contextRoutes = CONTEXTUAL_PREFETCH[basePath] || [];
  
  // Combine critical routes with context-aware routes, dedupe
  const routesToPrefetch = [...new Set([...CRITICAL_ROUTES, ...contextRoutes])].filter(
    (route) => route !== pathname && !pathname?.startsWith(route + "/")
  );

  return (
    <div className="hidden" aria-hidden="true">
      {routesToPrefetch.map((route) => (
        <Link key={route} href={route} prefetch={true} tabIndex={-1}>
          {/* Invisible link to trigger prefetch */}
        </Link>
      ))}
    </div>
  );
}

export default PrefetchLinks;
