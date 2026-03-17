import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import InviteClient from "./InviteClient";

export const metadata = { title: "Accept Invitation — Nexpura" };

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const admin = createAdminClient();

  // Find the invite
  const { data: invite } = await admin
    .from("team_members")
    .select(`
      id,
      name,
      email,
      role,
      invite_accepted,
      tenant_id,
      tenants!inner(business_name)
    `)
    .eq("invite_token", token)
    .single();

  if (!invite) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Invalid or Expired Invitation</h1>
          <p className="text-stone-500 mb-6">This invitation link is no longer valid. Please contact your employer for a new invite.</p>
          <a href="/login" className="text-amber-600 hover:text-amber-700 font-medium">
            Go to Login →
          </a>
        </div>
      </div>
    );
  }

  if (invite.invite_accepted) {
    redirect("/login");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessName = (invite.tenants as any)?.business_name || "Unknown Business";

  return (
    <InviteClient
      token={token}
      invite={{
        id: invite.id,
        name: invite.name,
        email: invite.email,
        role: invite.role,
        businessName,
      }}
    />
  );
}
