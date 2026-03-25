import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { token, userId } = await request.json();

    if (!token || !userId) {
      return NextResponse.json({ error: "Missing token or userId" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Find the invite
    const { data: invite, error: inviteError } = await admin
      .from("team_members")
      .select("id, tenant_id, name, email, role, permissions, allowed_location_ids, invite_accepted")
      .eq("invite_token", token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 400 });
    }

    if (invite.invite_accepted) {
      return NextResponse.json({ error: "This invitation has already been accepted" }, { status: 400 });
    }

    // Update the users table with tenant_id and role
    const { error: userError } = await admin
      .from("users")
      .upsert({
        id: userId,
        tenant_id: invite.tenant_id,
        role: invite.role,
        full_name: invite.name,
        email: invite.email,
      }, { onConflict: "id" });

    if (userError) {
      logger.error("Failed to update user:", userError);
      return NextResponse.json({ error: "Failed to link user to tenant" }, { status: 500 });
    }

    // Mark invite as accepted and link to user
    const { error: updateError } = await admin
      .from("team_members")
      .update({
        user_id: userId,
        invite_accepted: true,
        invite_token: null, // Clear the token so it can't be reused
      })
      .eq("id", invite.id);

    if (updateError) {
      logger.error("Failed to update team member:", updateError);
      return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Invite accept error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
