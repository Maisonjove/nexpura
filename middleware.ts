import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Subdomain routing configuration
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "nexpura.com";
const RESERVED_SUBDOMAINS = ["www", "app", "api", "admin", "demo", "staging", "test"];

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;
  
  // Extract subdomain from hostname
  // e.g., "joeys-jewels.nexpura.com" → "joeys-jewels"
  // e.g., "nexpura.com" or "www.nexpura.com" → null (apex/root)
  const subdomain = getSubdomain(hostname);
  
  // If we're on a subdomain (tenant app)
  if (subdomain && !RESERVED_SUBDOMAINS.includes(subdomain)) {
    // Store subdomain in request headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nexpura-subdomain", subdomain);
    
    // Check if this is a public marketing route that should redirect to main domain
    const isMarketingRoute = 
      pathname === "/" ||
      pathname.startsWith("/pricing") ||
      pathname.startsWith("/features") ||
      pathname.startsWith("/contact") ||
      pathname.startsWith("/terms") ||
      pathname.startsWith("/privacy") ||
      pathname.startsWith("/switching");
    
    // On subdomain, marketing routes → redirect to main domain
    if (isMarketingRoute) {
      const mainUrl = new URL(pathname, `https://${ROOT_DOMAIN}`);
      mainUrl.search = request.nextUrl.search;
      return NextResponse.redirect(mainUrl);
    }
    
    // For app routes on subdomain, continue with session handling
    // The tenant will be resolved from the subdomain header
    return updateSession(request);
  }
  
  // Main domain (nexpura.com or www.nexpura.com)
  // Standard session handling for marketing + auth flows
  return updateSession(request);
}

/**
 * Extract subdomain from hostname
 * Returns null for apex domain, www, or localhost
 */
function getSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(":")[0];
  
  // Handle localhost/dev environments
  if (host === "localhost" || host === "127.0.0.1") {
    return null;
  }
  
  // Handle Vercel preview deployments
  if (host.includes(".vercel.app")) {
    // For preview URLs like project-name-xyz.vercel.app
    // or subdomain-project-name-xyz.vercel.app
    // We can use a custom header or query param for testing
    return null;
  }
  
  // Check if hostname matches pattern: subdomain.domain.tld
  const parts = host.split(".");
  
  // nexpura.com = 2 parts → no subdomain
  // www.nexpura.com = 3 parts, first is www → no subdomain  
  // joey.nexpura.com = 3 parts → subdomain is "joey"
  // sub.joey.nexpura.com = 4 parts → we don't support this
  
  if (parts.length < 3) {
    return null;
  }
  
  const subdomain = parts[0];
  
  // www is not a tenant subdomain
  if (subdomain === "www") {
    return null;
  }
  
  return subdomain;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
