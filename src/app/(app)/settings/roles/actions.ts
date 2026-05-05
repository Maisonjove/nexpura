"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import nodeCrypto from "node:crypto";
import { resend } from "@/lib/email/resend";
import { getTenantEmailSender } from "../email/actions";
import logger from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth, requireRole } from "@/lib/auth-context";
import { DEFAULT_PERMISSIONS, type PermissionSet, type NotificationPreferences } from "./_constants";
import { PLAN_FEATURES, canAddStaff, type PlanId } from "@/lib/plans";

import { flushSentry } from "@/lib/sentry-flush";
// CRIT-7: invites expire after 7 days. Matches the 7-day copy in the
// invite emails below and /api/invite/accept's expiry check.
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function hashInviteToken(token: string): string {
  return nodeCrypto.createHash("sha256").update(token, "utf8").digest("hex");
}

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { userId: user.id, tenantId: userData.tenant_id };
}

// PermissionSet, NotificationPreferences, and DEFAULT_PERMISSIONS used to
// be exported from this file. Next 16 enforces "use server" files may
// only export `async function` declarations — types and consts trigger
// a runtime "found object" crash. Moved to ./_constants.ts.

export async function updateMemberPermissions(
  memberId: string,
  permissions: Partial<PermissionSet>
): Promise<{ success?: boolean; error?: string }> {
  // W6-CRIT-04 + W2-003: per-member permission overrides are a privilege-
  // escalation surface. Owner-only.
  try {
    await requireRole("owner");
  } catch {
    return { error: "Only the account owner can change team member permissions." };
  }
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();
  
  const { error } = await admin
    .from("team_members")
    .update({ permissions })
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateMemberRole(
  memberId: string,
  role: string
): Promise<{ success?: boolean; error?: string }> {
  // W6-CRIT-04: promoting/demoting teammates is tenant-admin territory.
  // Owner-only so a manager can't escalate themselves (or a friend) to owner.
  try {
    await requireRole("owner");
  } catch {
    return { error: "Only the account owner can change team member roles." };
  }
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();

  // Update role and set default permissions for that role
  const defaultPerms = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.staff;
  
  const { error } = await admin
    .from("team_members")
    .update({ role, permissions: defaultPerms })
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateMemberLocationAccess(
  memberId: string,
  allowedLocationIds: string[] | null // null = all locations
): Promise<{ success?: boolean; error?: string }> {
  // W6-CRIT-04: location-access grants are privilege escalation (can unlock
  // stores the staffer was never allowed into). Owner-only.
  try {
    await requireRole("owner");
  } catch {
    return { error: "Only the account owner can change location access." };
  }
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();
  
  const { error } = await admin
    .from("team_members")
    .update({ allowed_location_ids: allowedLocationIds })
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateMemberDefaultLocation(
  memberId: string,
  defaultLocationId: string | null
): Promise<{ success?: boolean; error?: string }> {
  // W6-CRIT-04: default-location assignment changes what the teammate
  // sees/writes by default — owner/manager bucket.
  try {
    await requireRole("owner", "manager");
  } catch {
    return { error: "Only owner or manager can change default location." };
  }
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();
  
  const { error } = await admin
    .from("team_members")
    .update({ default_location_id: defaultLocationId })
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  return { success: true };
}

/**
 * H-04a (consolidation, 2026-05-05): this is the ONE inviteTeamMember
 * action. The duplicate in `settings/team/actions.ts` was deleted —
 * it didn't send an invite email so a junior staff member who landed
 * on the team modal got a recipient that never received the link.
 *
 * This version: sends email, applies plan-limit enforcement (folded
 * in from the deleted twin), and is the single import target for both
 * /settings/roles + /settings/team UI surfaces.
 */
export async function inviteTeamMember(
  name: string,
  email: string,
  role: string,
  allowedLocationIds: string[] | null,
  phoneNumber?: string | null
): Promise<{ success?: boolean; error?: string; inviteToken?: string }> {
  // W6-CRIT-04: adding teammates is a privilege-granting action. Owner-only.
  try {
    await requireRole("owner");
  } catch {
    return { error: "Only the account owner can invite team members." };
  }
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();

  // H-04a: plan-limit enforcement. Folded in from the (now-deleted)
  // settings/team/actions.ts:inviteTeamMember twin. canAddStaff() is
  // also used client-side for UI feedback, but the authoritative check
  // MUST happen here in the Server Action.
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("plan")
    .eq("tenant_id", ctx.tenantId)
    .single();
  const userPlan = (subscription?.plan ?? "boutique") as PlanId;

  const { count: memberCount } = await admin
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId);

  if (!canAddStaff(userPlan, memberCount ?? 0)) {
    const limit = PLAN_FEATURES[userPlan]?.staffLimit;
    const planLabel = userPlan.charAt(0).toUpperCase() + userPlan.slice(1);
    return {
      error: `Your ${planLabel} plan allows up to ${limit} staff member${limit === 1 ? "" : "s"}. Upgrade your plan to add more team members.`,
    };
  }

  // Check if member already exists
  const { data: existing } = await admin
    .from("team_members")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("email", email.toLowerCase())
    .single();

  if (existing) return { error: "A team member with this email already exists" };

  // Get tenant info for the email
  const { data: tenant } = await admin
    .from("tenants")
    .select("business_name")
    .eq("id", ctx.tenantId)
    .single();

  // Generate invite token. CRIT-7: store sha256(token) + 7-day expiry.
  const inviteToken = crypto.randomUUID();
  const inviteTokenHash = hashInviteToken(inviteToken);
  const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_MS).toISOString();

  // Get default permissions for this role
  const defaultPerms = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.staff;

  // Create team member record
  const { error } = await admin.from("team_members").insert({
    tenant_id: ctx.tenantId,
    name,
    email: email.toLowerCase(),
    role,
    permissions: defaultPerms,
    allowed_location_ids: allowedLocationIds,
    invite_token: inviteToken,
    invite_token_hash: inviteTokenHash,
    invite_expires_at: inviteExpiresAt,
    invite_accepted: false,
    phone_number: phoneNumber || null,
    whatsapp_notifications_enabled: true, // Default to enabled
  });

  if (error) return { error: error.message };

  // Send invite email
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://nexpura.com"}/invite/${inviteToken}`;
  
  // Get the tenant's email sender (custom domain or fallback)
  // getTenantEmailSender now resolves the tenant from the session itself
  // (PR-01 / W6-CRIT-03); no tenant id is passed in.
  const emailSender = await getTenantEmailSender();
  
  try {
    await resend.emails.send({
      from: emailSender.from,
      replyTo: emailSender.replyTo,
      to: email.toLowerCase(),
      subject: `You're invited to join ${tenant?.business_name || "a jewellery business"}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f4; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #78716c 0%, #57534e 100%); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Welcome to Nexpura</h1>
            </div>
            <div style="padding: 32px;">
              <p style="color: #44403c; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Hi ${name},
              </p>
              <p style="color: #44403c; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                You've been invited to join <strong>${tenant?.business_name || "a jewellery business"}</strong> as a <strong>${role.replace("_", " ")}</strong> on Nexpura.
              </p>
              <a href="${inviteUrl}" style="display: block; background: #78716c; color: white; text-decoration: none; padding: 14px 24px; border-radius: 8px; text-align: center; font-weight: 600; font-size: 16px;">
                Accept Invitation
              </a>
              <p style="color: #a8a29e; font-size: 14px; line-height: 1.5; margin: 24px 0 0; text-align: center;">
                This invite link will expire in 7 days.
              </p>
            </div>
            <div style="background: #fafaf9; padding: 20px 32px; text-align: center; border-top: 1px solid #e7e5e4;">
              <p style="color: #a8a29e; font-size: 12px; margin: 0;">
                Nexpura — The Modern Jewellery Management System
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  } catch (emailError) {
    logger.error("Failed to send invite email:", emailError);
    // Don't fail the invite if email fails - they can still use the link
  }

  await logAuditEvent({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "team_member_invite",
    entityType: "team_member",
    newData: { name, email, role },
  });

  revalidatePath("/settings/roles");
  await flushSentry();
  return { success: true, inviteToken };
}

export async function resendInvite(memberId: string): Promise<{ success?: boolean; error?: string }> {
  // W6-CRIT-04: re-issuing an invite rotates the token and is part of the
  // staff-admin surface. Owner/manager only.
  try {
    await requireRole("owner", "manager");
  } catch {
    return { error: "Only owner or manager can resend invites." };
  }
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();
  
  // Get member info
  const { data: member } = await admin
    .from("team_members")
    .select("name, email, role, invite_token, invite_accepted")
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  
  if (!member) return { error: "Team member not found" };
  if (member.invite_accepted) return { error: "This member has already accepted their invite" };

  // Get tenant info
  const { data: tenant } = await admin
    .from("tenants")
    .select("business_name")
    .eq("id", ctx.tenantId)
    .single();

  // Generate new token. CRIT-7: rotate hash + expiry as well so the
  // fresh link has a fresh 7-day window and the old link is dead.
  const inviteToken = crypto.randomUUID();
  const inviteTokenHash = hashInviteToken(inviteToken);
  const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_MS).toISOString();

  // Destructive return-error: this rotates the invite token + its hash on
  // the team_members row. The email below uses inviteToken to build the
  // invite URL. If this update silently fails, the email goes out with
  // the new token but the DB still holds the OLD hash → the invitee
  // clicks the link, hashInviteToken comparison fails, signup denied.
  // Surface so the caller knows the email shouldn't be sent.
  const { error: tokenUpdErr } = await admin
    .from("team_members")
    .update({
      invite_token: inviteToken,
      invite_token_hash: inviteTokenHash,
      invite_expires_at: inviteExpiresAt,
    })
    .eq("id", memberId);
  if (tokenUpdErr) return { error: tokenUpdErr.message };

  // Send invite email
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://nexpura.com"}/invite/${inviteToken}`;
  
  // Get the tenant's email sender (custom domain or fallback)
  // getTenantEmailSender now resolves the tenant from the session itself
  // (PR-01 / W6-CRIT-03); no tenant id is passed in.
  const emailSender = await getTenantEmailSender();
  
  try {
    await resend.emails.send({
      from: emailSender.from,
      replyTo: emailSender.replyTo,
      to: member.email,
      subject: `Reminder: You're invited to join ${tenant?.business_name || "a jewellery business"}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f4; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #78716c 0%, #57534e 100%); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Welcome to Nexpura</h1>
            </div>
            <div style="padding: 32px;">
              <p style="color: #44403c; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Hi ${member.name},
              </p>
              <p style="color: #44403c; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                This is a reminder that you've been invited to join <strong>${tenant?.business_name || "a jewellery business"}</strong> as a <strong>${member.role.replace("_", " ")}</strong> on Nexpura.
              </p>
              <a href="${inviteUrl}" style="display: block; background: #78716c; color: white; text-decoration: none; padding: 14px 24px; border-radius: 8px; text-align: center; font-weight: 600; font-size: 16px;">
                Accept Invitation
              </a>
              <p style="color: #a8a29e; font-size: 14px; line-height: 1.5; margin: 24px 0 0; text-align: center;">
                This invite link will expire in 7 days.
              </p>
            </div>
            <div style="background: #fafaf9; padding: 20px 32px; text-align: center; border-top: 1px solid #e7e5e4;">
              <p style="color: #a8a29e; font-size: 12px; margin: 0;">
                Nexpura — The Modern Jewellery Management System
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  } catch (emailError) {
    logger.error("Failed to send invite email:", emailError);
    await flushSentry();
    return { error: "Failed to send email" };
  }

  return { success: true };
}

export async function removeMember(memberId: string): Promise<{ success?: boolean; error?: string }> {
  // W6-CRIT-04: staff removal is privilege-management. Owner-only.
  // Previously allowed managers; tightened so managers can't evict peers.
  try {
    await requireRole("owner");
  } catch {
    return { error: "Only the account owner can remove team members." };
  }
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();
  
  // Check if trying to remove owner
  const { data: member } = await admin
    .from("team_members")
    .select("role, name, email")
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  
  if (member?.role === "owner") return { error: "Cannot remove the owner" };

  const { error } = await admin
    .from("team_members")
    .delete()
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };

  await logAuditEvent({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "team_member_delete",
    entityType: "team_member",
    entityId: memberId,
    oldData: member || undefined,
  });
  
  revalidatePath("/settings/roles");
  return { success: true };
}

export async function updateMemberPhone(
  memberId: string,
  phoneNumber: string | null
): Promise<{ success?: boolean; error?: string }> {
  // W6-CRIT-04: editing a teammate's contact phone is staff-admin. Staff
  // may update their own row (self-service profile), anyone else requires
  // owner/manager.
  let authCtx;
  try {
    authCtx = await requireAuth();
  } catch {
    return { error: "Not authenticated" };
  }

  const admin = createAdminClient();

  // Resolve the acting user's own team_members row (if any) to compare
  // against the target id for the self-service carve-out.
  const { data: selfRow } = await admin
    .from("team_members")
    .select("id")
    .eq("tenant_id", authCtx.tenantId)
    .eq("user_id", authCtx.userId)
    .maybeSingle();

  const isSelf = selfRow?.id === memberId;
  if (!isSelf && !authCtx.isOwner && !authCtx.isManager) {
    return { error: "Only owner or manager can change another member's phone." };
  }

  const { error } = await admin
    .from("team_members")
    .update({
      phone_number: phoneNumber,
      updated_at: new Date().toISOString()
    })
    .eq("id", memberId)
    .eq("tenant_id", authCtx.tenantId);

  if (error) return { error: error.message };

  revalidatePath("/settings/roles");
  return { success: true };
}

export async function updateMemberWhatsAppEnabled(
  memberId: string,
  enabled: boolean
): Promise<{ success?: boolean; error?: string }> {
  // W6-CRIT-04: self-service for own row; owner/manager for anyone else.
  let authCtx;
  try {
    authCtx = await requireAuth();
  } catch {
    return { error: "Not authenticated" };
  }

  const admin = createAdminClient();

  const { data: selfRow } = await admin
    .from("team_members")
    .select("id")
    .eq("tenant_id", authCtx.tenantId)
    .eq("user_id", authCtx.userId)
    .maybeSingle();

  const isSelf = selfRow?.id === memberId;
  if (!isSelf && !authCtx.isOwner && !authCtx.isManager) {
    return {
      error:
        "Only owner or manager can change another member's WhatsApp settings.",
    };
  }

  const { error } = await admin
    .from("team_members")
    .update({
      whatsapp_notifications_enabled: enabled,
      updated_at: new Date().toISOString()
    })
    .eq("id", memberId)
    .eq("tenant_id", authCtx.tenantId);

  if (error) return { error: error.message };

  revalidatePath("/settings/roles");
  return { success: true };
}

export async function updateMemberNotifications(
  memberId: string,
  notifications: Partial<NotificationPreferences>
): Promise<{ success?: boolean; error?: string }> {
  // W6-CRIT-04: self-service for own row; owner/manager for anyone else.
  let authCtx;
  try {
    authCtx = await requireAuth();
  } catch {
    return { error: "Not authenticated" };
  }

  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();

  const { data: selfRow } = await admin
    .from("team_members")
    .select("id")
    .eq("tenant_id", authCtx.tenantId)
    .eq("user_id", authCtx.userId)
    .maybeSingle();

  const isSelf = selfRow?.id === memberId;
  if (!isSelf && !authCtx.isOwner && !authCtx.isManager) {
    return {
      error:
        "Only owner or manager can change another member's notification preferences.",
    };
  }

  // Get current permissions to merge with
  const { data: member } = await admin
    .from("team_members")
    .select("permissions")
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId)
    .single();

  if (!member) return { error: "Member not found" };
  
  // Merge notifications into permissions object
  const currentPerms = (member.permissions || {}) as Record<string, unknown>;
  const currentNotifs = (currentPerms.notifications || {}) as Record<string, unknown>;
  const updatedPerms = {
    ...currentPerms,
    notifications: {
      ...currentNotifs,
      ...notifications,
    },
  };
  
  const { error } = await admin
    .from("team_members")
    .update({ 
      permissions: updatedPerms,
      updated_at: new Date().toISOString()
    })
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  
  revalidatePath("/settings/roles");
  return { success: true };
}
