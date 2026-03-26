import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import LocationDetailClient from "./LocationDetailClient";

export const metadata = { title: "Location Details — Nexpura" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LocationDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");

  // Fetch location details
  const { data: location, error } = await supabase
    .from("locations")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (error || !location) {
    notFound();
  }

  // Fetch team members assigned to this location
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, name, email, role, allowed_location_ids")
    .eq("tenant_id", userData.tenant_id);

  // Filter to members who have access to this location
  const assignedMembers = teamMembers?.filter((m) => {
    // null means all locations
    if (m.allowed_location_ids === null) return true;
    // Check if location is in their list
    return m.allowed_location_ids?.includes(id);
  }) ?? [];

  const isOwner = userData.role === "owner";

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link 
          href="/settings/locations" 
          className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{location.name}</h1>
          <p className="text-stone-500 capitalize">{location.type}</p>
        </div>
      </div>

      <LocationDetailClient 
        location={location} 
        assignedMembers={assignedMembers}
        isOwner={isOwner}
      />
    </div>
  );
}
