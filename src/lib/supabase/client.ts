import { createBrowserClient } from "@supabase/ssr";
import { getCookieDomain, getIsSecure } from "./cookie-config";

export function createClient() {
  const host =
    typeof window !== "undefined" ? window.location.host : undefined;
  const protocol =
    typeof window !== "undefined" ? window.location.protocol : undefined;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: getCookieDomain(host),
        sameSite: "lax",
        secure: getIsSecure(protocol, host),
      },
    }
  );
}
