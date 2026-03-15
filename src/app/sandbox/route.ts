/**
 * /sandbox — Reviewer entry point (preview-only)
 *
 * Redirects to /dashboard?rt=nexpura-review-2026
 * The middleware picks up the ?rt= token on every request and injects the
 * demo session server-side — no browser cookie persistence needed.
 *
 * Also sets the nexpura-review cookie as a fallback for navigating within
 * the app without the ?rt= param in the URL.
 */

import { NextRequest, NextResponse } from "next/server";

const REVIEW_TOKEN = "nexpura-review-2026";
const REVIEW_COOKIE = "nexpura-review";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const dashboardUrl = new URL("/dashboard", request.url);
  dashboardUrl.searchParams.set("rt", REVIEW_TOKEN);

  const response = NextResponse.redirect(dashboardUrl);

  // Set the review cookie so subsequent in-app navigation (without ?rt=) still works
  response.cookies.set(REVIEW_COOKIE, REVIEW_TOKEN, {
    path: "/",
    maxAge: 86400 * 7, // 7 days
    sameSite: "lax",
    httpOnly: false,
  });

  return response;
}
