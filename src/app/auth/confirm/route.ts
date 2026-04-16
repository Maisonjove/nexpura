import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Email confirmation callback handler.
 * Supabase sends the user here after they click the verification link.
 * Handles both PKCE (code) and OTP (token_hash + type) flows.
 *
 * IMPORTANT: We cannot use createClient() from server.ts here because that
 * writes session cookies to Next.js cookieStore, which doesn't attach to
 * manually created NextResponse.redirect() objects. Instead, we wire Supabase
 * to write cookies directly onto a supabaseResponse object, then copy them
 * onto the redirect — exactly like the middleware pattern.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/onboarding";

  // Start with a base response Supabase can write session cookies onto
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Copy session cookies from supabaseResponse onto a redirect — this is the
  // critical step that was missing. Without it, the browser never receives the
  // session cookies, getSession() returns null, and the page shows
  // "Invalid or expired link".
  function redirectWithCookies(url: string): NextResponse {
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      redirect.cookies.set(cookie)
    );
    return redirect;
  }

  try {
    if (code) {
      // PKCE flow (signup email confirmation)
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return redirectWithCookies(`${origin}${next}`);
      }
    } else if (token_hash && type) {
      // OTP / magic link / password-reset flow
      const { error } = await supabase.auth.verifyOtp({ token_hash, type });
      if (!error) {
        return redirectWithCookies(`${origin}${next}`);
      }
    }
  } catch {
    // fall through to error redirect
  }

  // Verification failed — send back to login with error
  return NextResponse.redirect(`${origin}/login?error=verification_failed`);
}
