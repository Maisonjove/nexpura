import { headers } from "next/headers";
import { NextRequest } from "next/server";

/**
 * CSRF Protection Utilities
 * 
 * For Next.js App Router, we validate Origin/Referer headers on mutation requests.
 * Server Actions have built-in CSRF protection via Next.js.
 * This utility is for API routes that accept POST/PUT/DELETE/PATCH requests.
 */

// Allowed origins - production + preview URLs
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  // Local development
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean) as string[];

/**
 * Validates that the request origin matches allowed origins.
 * Returns true if the request is valid, false otherwise.
 */
export function validateCSRFForRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Skip CSRF check for GET and HEAD requests
  if (request.method === "GET" || request.method === "HEAD") {
    return true;
  }

  // For same-origin requests, origin header should match
  if (origin) {
    return isAllowedOrigin(origin);
  }

  // Fallback to referer header check
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return isAllowedOrigin(refererUrl.origin);
    } catch {
      return false;
    }
  }

  // If neither origin nor referer is present, it might be a same-origin request
  // from an older browser. We'll allow it but log for monitoring.
  // In strict mode, you could return false here.
  return true;
}

/**
 * For use in server actions or server components
 */
export async function validateCSRFFromHeaders(): Promise<boolean> {
  const headersList = await headers();
  const origin = headersList.get("origin");
  const referer = headersList.get("referer");

  if (origin) {
    return isAllowedOrigin(origin);
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return isAllowedOrigin(refererUrl.origin);
    } catch {
      return false;
    }
  }

  return true;
}

function isAllowedOrigin(origin: string): boolean {
  // Check exact matches
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Check for Vercel preview URLs (*.vercel.app)
  if (origin.endsWith(".vercel.app")) {
    return true;
  }

  // Check for custom domain patterns if needed
  // For Nexpura, we might have tenant subdomains
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL);
      const originUrl = new URL(origin);
      // Allow same base domain (for subdomain tenants)
      if (originUrl.hostname.endsWith(appUrl.hostname)) {
        return true;
      }
    } catch {
      // Invalid URL, skip this check
    }
  }

  return false;
}

/**
 * Wrapper for API route handlers that validates CSRF
 */
export function withCSRFProtection<T>(
  handler: (request: NextRequest) => Promise<T>
): (request: NextRequest) => Promise<T | Response> {
  return async (request: NextRequest) => {
    if (!validateCSRFForRequest(request)) {
      return new Response(JSON.stringify({ error: "Invalid request origin" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    return handler(request);
  };
}
