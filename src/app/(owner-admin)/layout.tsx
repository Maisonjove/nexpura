import { Gem, LayoutDashboard, Users, KeyRound, LogOut } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const OWNER_EMAIL = "germanijoey@yahoo.com";

export default async function OwnerAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If logged in but not owner, redirect to owner-admin login
  // This layout is used by both login page (no auth needed) and protected pages
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const isLoginPage = pathname === '/owner-admin';
  
  // For non-login pages, verify owner access
  // The middleware.ts handles redirects, but we double-check here for safety
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900">
      {/* Subtle pattern overlay */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50 pointer-events-none" />
      
      <div className="relative flex min-h-screen">
        {/* Show sidebar only for authenticated owner on non-login pages */}
        {user?.email === OWNER_EMAIL && (
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-stone-900/50 backdrop-blur-xl border-r border-white/5 flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Gem size={20} className="text-white" />
                </div>
                <div>
                  <span className="text-lg font-semibold text-white">Nexpura</span>
                  <p className="text-[10px] uppercase tracking-widest text-amber-500 font-medium">Owner Portal</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
              <NavLink href="/owner-admin/dashboard" icon={LayoutDashboard}>
                Dashboard
              </NavLink>
              <NavLink href="/owner-admin/memberships" icon={Users}>
                Memberships
              </NavLink>
              <NavLink href="/owner-admin/access-requests" icon={KeyRound}>
                Access Requests
              </NavLink>
            </nav>

            {/* User section */}
            <div className="p-4 border-t border-white/5">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-amber-600/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-amber-500">
                    {user?.email?.[0]?.toUpperCase() || 'O'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">Owner</p>
                  <p className="text-xs text-stone-400 truncate">{user?.email}</p>
                </div>
              </div>
              <form action="/api/auth/signout" method="POST" className="mt-2">
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </form>
            </div>
          </aside>
        )}

        {/* Main content */}
        <main className={`flex-1 ${user?.email === OWNER_EMAIL ? 'ml-64' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLink({ 
  href, 
  icon: Icon, 
  children 
}: { 
  href: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-stone-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors group"
    >
      <Icon size={18} className="text-stone-500 group-hover:text-amber-500 transition-colors" />
      {children}
    </Link>
  );
}
