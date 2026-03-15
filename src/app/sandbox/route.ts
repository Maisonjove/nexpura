/**
 * /sandbox — Server-side demo sandbox entry (preview-only)
 *
 * WHY 200 + meta-refresh INSTEAD OF 302 redirect:
 * Some reviewer environments (privacy extensions, strict browser settings,
 * certain proxies) silently drop Set-Cookie headers on 3xx redirect responses.
 * A 200 response with Set-Cookie is universally respected — cookies are stored
 * BEFORE the browser navigates away, so they're present on the next request.
 *
 * Flow:
 *   1. Server signs in as demo@nexpura.com server-side
 *   2. Session cookies are set on the 200 HTML response via Supabase library
 *   3. HTML page auto-navigates to / (meta-refresh + JS redirect)
 *   4. / sees the cookies → redirects to /dashboard
 *
 * PREVIEW-ONLY. Hard-wired to seeded Marcus & Co. demo tenant only.
 */

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Build a 200 HTML response — cookies on 200 are universally respected
  const htmlResponse = new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="1;url=/" />
  <title>Loading Nexpura Sandbox…</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      background:#fafaf9;display:flex;align-items:center;justify-content:center;
      min-height:100vh;color:#44403c}
    .card{background:#fff;border:1px solid #e7e5e4;border-radius:16px;
      padding:40px 48px;text-align:center;max-width:360px;width:100%;
      box-shadow:0 1px 3px rgba(0,0,0,.06)}
    .logo{font-size:20px;font-weight:700;letter-spacing:-.5px;color:#1c1917;margin-bottom:4px}
    .sub{font-size:13px;color:#78716c;margin-bottom:32px}
    .spinner{width:28px;height:28px;border:2.5px solid #e7e5e4;
      border-top-color:#8B7355;border-radius:50%;animation:spin .8s linear infinite;
      margin:0 auto 20px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .status{font-size:14px;color:#57534e;font-weight:500}
    .note{font-size:11px;color:#a8a29e;margin-top:20px;line-height:1.5}
    .reset{display:inline-block;margin-top:12px;font-size:11px;
      color:#8B7355;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Nexpura</div>
    <div class="sub">Demo Sandbox</div>
    <div class="spinner" id="spinner"></div>
    <div class="status" id="status">Establishing demo session…</div>
    <div class="note">
      Seeded Marcus &amp; Co. demo tenant only.<br/>No production data accessible.
    </div>
    <a class="reset" href="/sandbox/reset">Reset demo data →</a>
  </div>
  <script>
    // Navigate once session cookies are stored (meta-refresh fallback above handles no-JS)
    document.getElementById('status').textContent = 'Redirecting to app…';
    setTimeout(function() { window.location.replace('/'); }, 400);
  </script>
</body>
</html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );

  // Use Supabase library to sign in — it calls setAll with correctly formatted cookies
  // Writing to htmlResponse.cookies (200 response) is universally reliable
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            htmlResponse.cookies.set(name, value, {
              ...options,
              // Ensure cookies are accessible for the same-site redirect
              sameSite: "lax",
              path: "/",
            });
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: "demo@nexpura.com",
    password: "nexpura-demo-2026",
  });

  if (error) {
    return new Response(
      `<html><body style="font-family:sans-serif;padding:40px">
        <h2>Sandbox auth failed</h2>
        <p>${error.message}</p>
        <p><a href="/sandbox">Try again</a></p>
      </body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }

  return htmlResponse;
}
