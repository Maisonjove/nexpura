import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        // Share session cookies across all *.nexpura.com subdomains in production.
        // NEXT_PUBLIC_COOKIE_DOMAIN is set to ".nexpura.com" in Vercel env vars.
        // Leave unset in development to scope cookies to localhost.
        domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
        sameSite: "lax",
        secure: true,
      },
    }
  );
}
