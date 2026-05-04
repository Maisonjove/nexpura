"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { initDefaultPermissions } from "@/lib/permissions";
import logger from "@/lib/logger";
import { invalidateUserCache } from "@/lib/cached-auth";

import { flushSentry } from "@/lib/sentry-flush";
// ============================================================================
// VALIDATION & SANITIZATION
// ============================================================================

const MAX_BUSINESS_NAME_LENGTH = 100;
const VALID_PLANS = ["boutique", "studio", "atelier"] as const;
const VALID_BUSINESS_TYPES = [
  "Independent Jeweller",
  "Jewellery Studio",
  "Retail Store",
  "Workshop",
  "Online Store",
  "Other",
];

function sanitizeString(
  str: string | undefined | null,
  maxLength: number
): string {
  if (!str || typeof str !== "string") return "";
  return str.trim().slice(0, maxLength).replace(/[\x00-\x1F\x7F]/g, "");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

// Return type now includes slug so the client can navigate to the subdomain URL.
// We no longer call redirect() here -- the client handles navigation after
// displaying the workspace URL to the user.
export async function completeOnboarding(
  businessName: string,
  businessType: string,
  plan: "boutique" | "studio" | "atelier"
): Promise<{ error?: string; slug?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Validate and sanitize inputs
    const sanitizedName = sanitizeString(
      businessName,
      MAX_BUSINESS_NAME_LENGTH
    );
    if (!sanitizedName || sanitizedName.length < 2) {
      return { error: "Business name must be at least 2 characters" };
    }

    const sanitizedType = VALID_BUSINESS_TYPES.includes(businessType)
      ? businessType
      : "Other";
    const validPlan = VALID_PLANS.includes(plan) ? plan : "boutique";

    // SECURITY: Check if user already has a tenant (prevent duplicate onboarding).
    const adminCheck = createAdminClient();
    const { data: existingUser } = await adminCheck
      .from("users")
      .select("tenant_id, email")
      .eq("id", user.id)
      .single();

    if (existingUser?.tenant_id) {
      if (
        existingUser.email &&
        user.email &&
        existingUser.email !== user.email
      ) {
        await supabase.auth.signOut();
        return {
          error: "Session mismatch detected. Please sign in again.",
        };
      }
      // Already onboarded -- return slug so client can navigate
      const { data: tenant } = await adminCheck
        .from("tenants")
        .select("slug")
        .eq("id", existingUser.tenant_id)
        .single();
      return { slug: tenant?.slug ?? "" };
    }

    const adminClient = createAdminClient();

    // Defense against the webhook ↔ onboarding race:
    // The Stripe webhook is what creates the user→tenant link in
    // public.users (PR #46). Webhooks usually fire within seconds, but
    // if Stripe retries due to a transient error, or if the user verifies
    // their email faster than usual, we could reach this point with
    // public.users.tenant_id still NULL while the matching tenant
    // already exists in the DB.
    //
    // Look up by email match against tenants.email (also written by the
    // webhook). If found, link the user to that tenant instead of
    // creating a duplicate — the duplicate-tenant bug Joey hit on
    // 2026-04-28 was exactly this race materialising the wrong way.
    if (user.email) {
      const { data: stripePaidTenant } = await adminClient
        .from("tenants")
        .select("id, slug")
        .eq("email", user.email)
        .not("stripe_customer_id", "is", null)
        .maybeSingle();

      if (stripePaidTenant?.id) {
        // Link the user to the existing Stripe-paid tenant + update its
        // business name/type from this onboarding submission.
        // Policy: destructive THROW (ghost-tenant prevention). If this
        // upsert fails, the user has paid Stripe (tenant has
        // stripe_customer_id) but public.users.tenant_id stays NULL —
        // they sign in and hit "no tenant" / get bounced back to
        // onboarding, while their workspace exists in the DB orphaned.
        // Outer try/catch unwinds with a generic error so they retry.
        const { error: linkUserErr } = await adminClient.from("users").upsert(
          {
            id: user.id,
            tenant_id: stripePaidTenant.id,
            email: user.email,
            full_name: sanitizedName.slice(0, 100),
            role: "owner",
          },
          { onConflict: "id" },
        );
        if (linkUserErr) {
          throw new Error(`onboarding: users upsert (link to Stripe-paid tenant) failed: ${linkUserErr.message}`);
        }
        // Policy: destructive THROW (ghost-tenant prevention). The user
        // is now linked to the tenant, but if this update fails the
        // tenant still has whatever placeholder name the webhook wrote
        // ("Owner" / no business_type) instead of what the user just
        // typed in onboarding — workspace is mis-branded across UI,
        // emails, receipts. Throw so the outer try/catch fails the
        // request and the user retries onboarding with the same form.
        const { error: tenantNameErr } = await adminClient
          .from("tenants")
          .update({ name: sanitizedName, business_type: sanitizedType })
          .eq("id", stripePaidTenant.id);
        if (tenantNameErr) {
          throw new Error(`onboarding: tenants update (name/business_type on Stripe-paid tenant) failed: ${tenantNameErr.message}`);
        }
        await invalidateUserCache(user.id);
        return { slug: stripePaidTenant.slug ?? "" };
      }
    }

    // Generate unique slug
    let slug = slugify(sanitizedName);
    if (!slug) slug = "business";

    const { data: existingTenant } = await adminClient
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existingTenant) {
      slug = `${slug}-${randomSuffix()}`;
    }

    // 1. Insert tenant
    const { data: tenant, error: tenantErr } = await adminClient
      .from("tenants")
      .insert({
        name: sanitizedName,
        slug,
        business_type: sanitizedType,
        plan: validPlan,
      })
      .select()
      .single();

    if (tenantErr || !tenant) {
      logger.error("Tenant creation error:", tenantErr);
      await flushSentry();
      return { error: tenantErr?.message ?? "Failed to create business" };
    }

    // 2. Insert user record
    const { error: userErr } = await adminClient.from("users").upsert(
      {
        id: user.id,
        tenant_id: tenant.id,
        email: user.email ?? "",
        full_name: "Owner",
        role: "owner",
      },
      { onConflict: "id" }
    );

    if (userErr) {
      logger.error("User creation error:", userErr);
      // Policy: destructive THROW (ghost-tenant prevention). User
      // upsert just failed — we have a tenant row but no user→tenant
      // link. Roll back the tenant insert so the user can retry
      // cleanly. If THIS rollback delete itself fails, we've leaked an
      // orphan tenant (no user, no Stripe customer because this is the
      // pre-Stripe path) into the DB; throw so the failure surfaces in
      // Sentry and the outer try/catch returns a clean error to the
      // user. Better an error here than a silent orphan tenant that
      // pollutes admin metrics and slug uniqueness.
      const { error: tenantRollbackErr } = await adminClient
        .from("tenants")
        .delete()
        .eq("id", tenant.id);
      if (tenantRollbackErr) {
        throw new Error(`onboarding: tenants rollback delete (after users upsert failure) failed: ${tenantRollbackErr.message}; original users error: ${userErr.message}`);
      }
      await flushSentry();
      return { error: userErr.message };
    }

    // 3. Insert subscription (14-day trial)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const { error: subErr } = await adminClient
      .from("subscriptions")
      .insert({
        tenant_id: tenant.id,
        plan: validPlan,
        status: "trialing",
        trial_ends_at: trialEndsAt.toISOString(),
      });

    if (subErr) {
      logger.error("Subscription creation error:", subErr);
      // Policy: destructive THROW (ghost-tenant prevention). Subscription
      // insert just failed — we have tenant + user→tenant link but no
      // subscription row, which means the user can sign in but every
      // billing/plan check returns null and behaviour is undefined
      // (locked-out UI / phantom-trial bugs). Roll back both rows so
      // they can retry cleanly; if either rollback fails we'd leave an
      // orphan tenant or an orphan user→tenant link with no
      // subscription, so throw and let the outer catch surface a
      // generic error — preferable to a half-state account.
      const { error: userRollbackErr } = await adminClient
        .from("users")
        .delete()
        .eq("id", user.id);
      if (userRollbackErr) {
        throw new Error(`onboarding: users rollback delete (after subscriptions insert failure) failed: ${userRollbackErr.message}; original subscriptions error: ${subErr.message}`);
      }
      const { error: tenantRollback2Err } = await adminClient
        .from("tenants")
        .delete()
        .eq("id", tenant.id);
      if (tenantRollback2Err) {
        throw new Error(`onboarding: tenants rollback delete (after subscriptions insert failure) failed: ${tenantRollback2Err.message}; original subscriptions error: ${subErr.message}`);
      }
      await flushSentry();
      return { error: "Failed to create subscription" };
    }

    // 4. Create a default location for the tenant
    const locationName = `${sanitizedName} - Main Store`.slice(0, 100);
    const { error: locationErr } = await adminClient
      .from("locations")
      .insert({
        tenant_id: tenant.id,
        name: locationName,
        type: "retail",
        is_active: true,
      });

    if (locationErr) {
      logger.error("Default location creation error:", locationErr);
      // Non-critical
    }

    // 5. Seed default permissions
    try {
      await initDefaultPermissions(tenant.id);
    } catch (permErr) {
      logger.error("Permission seeding error:", permErr);
      // Non-critical
    }

    // Invalidate user cache so layout picks up new user profile
    await invalidateUserCache(user.id);

    // Return slug -- client will navigate to https://{slug}.nexpura.com/dashboard
    await flushSentry();
    return { slug };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    logger.error("completeOnboarding failed", { error });
    await flushSentry();
    return { error: "Something went wrong. Please try again." };
  }
}
