"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { getTenantEmailSender } from "../email/actions";
import logger from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth } from "@/lib/auth-context";

const resend = new Resend(process.env.RESEND_API_KEY);

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

export interface PermissionSet {
  // View permissions
  canViewDashboard: boolean;
  canViewInventory: boolean;
  canViewCustomers: boolean;
  canViewSales: boolean;
  canViewRepairs: boolean;
  canViewBespoke: boolean;
  canViewReports: boolean;
  canViewFinancials: boolean;
  // Action permissions
  canCreateSales: boolean;
  canEditInventory: boolean;
  canManageCustomers: boolean;
  canProcessRefunds: boolean;
  canManageRepairs: boolean;
  canManageBespoke: boolean;
  canCloseEOD: boolean;
  // Admin permissions
  canManageTeam: boolean;
  canManageSettings: boolean;
  canViewAllLocations: boolean;
}

export const DEFAULT_PERMISSIONS: Record<string, PermissionSet> = {
  owner: {
    canViewDashboard: true, canViewInventory: true, canViewCustomers: true, canViewSales: true,
    canViewRepairs: true, canViewBespoke: true, canViewReports: true, canViewFinancials: true,
    canCreateSales: true, canEditInventory: true, canManageCustomers: true, canProcessRefunds: true,
    canManageRepairs: true, canManageBespoke: true, canCloseEOD: true,
    canManageTeam: true, canManageSettings: true, canViewAllLocations: true,
  },
  manager: {
    canViewDashboard: true, canViewInventory: true, canViewCustomers: true, canViewSales: true,
    canViewRepairs: true, canViewBespoke: true, canViewReports: true, canViewFinancials: true,
    canCreateSales: true, canEditInventory: true, canManageCustomers: true, canProcessRefunds: true,
    canManageRepairs: true, canManageBespoke: true, canCloseEOD: true,
    canManageTeam: true, canManageSettings: false, canViewAllLocations: true,
  },
  salesperson: {
    canViewDashboard: true, canViewInventory: true, canViewCustomers: true, canViewSales: true,
    canViewRepairs: false, canViewBespoke: false, canViewReports: false, canViewFinancials: false,
    canCreateSales: true, canEditInventory: false, canManageCustomers: true, canProcessRefunds: false,
    canManageRepairs: false, canManageBespoke: false, canCloseEOD: false,
    canManageTeam: false, canManageSettings: false, canViewAllLocations: false,
  },
  workshop_jeweller: {
    canViewDashboard: true, canViewInventory: true, canViewCustomers: false, canViewSales: false,
    canViewRepairs: true, canViewBespoke: true, canViewReports: false, canViewFinancials: false,
    canCreateSales: false, canEditInventory: true, canManageCustomers: false, canProcessRefunds: false,
    canManageRepairs: true, canManageBespoke: true, canCloseEOD: false,
    canManageTeam: false, canManageSettings: false, canViewAllLocations: false,
  },
  repair_technician: {
    canViewDashboard: true, canViewInventory: true, canViewCustomers: false, canViewSales: false,
    canViewRepairs: true, canViewBespoke: false, canViewReports: false, canViewFinancials: false,
    canCreateSales: false, canEditInventory: false, canManageCustomers: false, canProcessRefunds: false,
    canManageRepairs: true, canManageBespoke: false, canCloseEOD: false,
    canManageTeam: false, canManageSettings: false, canViewAllLocations: false,
  },
  inventory_manager: {
    canViewDashboard: true, canViewInventory: true, canViewCustomers: false, canViewSales: true,
    canViewRepairs: false, canViewBespoke: false, canViewReports: true, canViewFinancials: false,
    canCreateSales: false, canEditInventory: true, canManageCustomers: false, canProcessRefunds: false,
    canManageRepairs: false, canManageBespoke: false, canCloseEOD: false,
    canManageTeam: false, canManageSettings: false, canViewAllLocations: true,
  },
  accountant: {
    canViewDashboard: true, canViewInventory: false, canViewCustomers: false, canViewSales: true,
    canViewRepairs: false, canViewBespoke: false, canViewReports: true, canViewFinancials: true,
    canCreateSales: false, canEditInventory: false, canManageCustomers: false, canProcessRefunds: true,
    canManageRepairs: false, canManageBespoke: false, canCloseEOD: true,
    canManageTeam: false, canManageSettings: false, canViewAllLocations: true,
  },
  staff: {
    canViewDashboard: true, canViewInventory: true, canViewCustomers: true, canViewSales: true,
    canViewRepairs: false, canViewBespoke: false, canViewReports: false, canViewFinancials: false,
    canCreateSales: true, canEditInventory: false, canManageCustomers: false, canProcessRefunds: false,
    canManageRepairs: false, canManageBespoke: false, canCloseEOD: false,
    canManageTeam: false, canManageSettings: false, canViewAllLocations: false,
  },
};

export async function updateMemberPermissions(
  memberId: string,
  permissions: Partial<PermissionSet>
): Promise<{ success?: boolean; error?: string }> {
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

export async function inviteTeamMember(
  name: string,
  email: string,
  role: string,
  allowedLocationIds: string[] | null,
  phoneNumber?: string | null
): Promise<{ success?: boolean; error?: string; inviteToken?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();
  
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

  // Generate invite token
  const inviteToken = crypto.randomUUID();
  
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
    invite_accepted: false,
    phone_number: phoneNumber || null,
    whatsapp_notifications_enabled: true, // Default to enabled
  });

  if (error) return { error: error.message };

  // Send invite email
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://nexpura.com"}/invite/${inviteToken}`;
  
  // Get the tenant's email sender (custom domain or fallback)
  const emailSender = await getTenantEmailSender(ctx.tenantId);
  
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
  return { success: true, inviteToken };
}

export async function resendInvite(memberId: string): Promise<{ success?: boolean; error?: string }> {
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

  // Generate new token
  const inviteToken = crypto.randomUUID();
  
  await admin
    .from("team_members")
    .update({ invite_token: inviteToken })
    .eq("id", memberId);

  // Send invite email
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://nexpura.com"}/invite/${inviteToken}`;
  
  // Get the tenant's email sender (custom domain or fallback)
  const emailSender = await getTenantEmailSender(ctx.tenantId);
  
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
    return { error: "Failed to send email" };
  }

  return { success: true };
}

export async function removeMember(memberId: string): Promise<{ success?: boolean; error?: string }> {
  // RBAC: staff removal is a high-impact destructive action. Owner/manager only.
  try {
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can remove team members." };
    }
  } catch {
    return { error: "Not authenticated" };
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
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();
  
  const { error } = await admin
    .from("team_members")
    .update({ 
      phone_number: phoneNumber,
      updated_at: new Date().toISOString()
    })
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  
  revalidatePath("/settings/roles");
  return { success: true };
}

export async function updateMemberWhatsAppEnabled(
  memberId: string, 
  enabled: boolean
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();
  
  const { error } = await admin
    .from("team_members")
    .update({ 
      whatsapp_notifications_enabled: enabled,
      updated_at: new Date().toISOString()
    })
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  
  revalidatePath("/settings/roles");
  return { success: true };
}

export interface NotificationPreferences {
  notifyNewRepairs: boolean;
  notifyNewBespoke: boolean;
  notifyRepairReady: boolean;
  notifyBespokeReady: boolean;
  notifyNewSales: boolean;
}

export async function updateMemberNotifications(
  memberId: string,
  notifications: Partial<NotificationPreferences>
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();
  
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
