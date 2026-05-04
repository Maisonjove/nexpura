"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  HomeIcon,
  BuildingOffice2Icon,
  CreditCardIcon,
  CurrencyDollarIcon,
  EnvelopeIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: HomeIcon, exact: true },
  { label: "Tenants", href: "/admin/tenants", icon: BuildingOffice2Icon, exact: false },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCardIcon, exact: false },
  { label: "Revenue", href: "/admin/revenue", icon: CurrencyDollarIcon, exact: false },
  { label: "Demo Requests", href: "/admin/demo-requests", icon: EnvelopeIcon, exact: false },
  { label: "Settings", href: "/admin/settings", icon: Cog6ToothIcon, exact: false },
];

interface SidebarContentProps {
  pathname: string;
  userEmail: string;
  onNavClick: () => void;
  onSignOut: () => void;
}

function SidebarContent({ pathname, userEmail, onNavClick, onSignOut }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full bg-nexpura-charcoal">
      {/* Wordmark */}
      <div className="px-6 py-6 border-b border-stone-800">
        <Link href="/admin" className="flex items-center gap-3" onClick={onNavClick}>
          <div className="w-8 h-8 rounded-md bg-stone-800 flex items-center justify-center">
            <ShieldCheckIcon className="w-4 h-4 text-stone-300" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-serif text-base text-stone-100 tracking-tight">
              Nexpura
            </span>
            <span className="text-[10px] uppercase tracking-luxury text-stone-500 mt-0.5">
              Admin
            </span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-luxury text-stone-500 px-3 mb-3">
          Platform
        </p>
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavClick}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 ${
                  isActive
                    ? "bg-stone-800 text-stone-100 font-medium"
                    : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Back to app */}
        <div className="pt-5 mt-5 border-t border-stone-800">
          <p className="text-[10px] uppercase tracking-luxury text-stone-500 px-3 mb-3">
            Return
          </p>
          <Link
            href="/dashboard"
            onClick={onNavClick}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-stone-400 hover:bg-stone-800 hover:text-stone-200 transition-colors duration-200"
          >
            <ArrowLeftOnRectangleIcon className="w-5 h-5" />
            Back to App
          </Link>
        </div>
      </nav>

      {/* User info */}
      <div className="px-3 py-4 border-t border-stone-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-stone-300">
              {(userEmail || "A")[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-stone-400 truncate">{userEmail}</p>
            <p className="text-xs text-stone-200 font-medium">Super Admin</p>
          </div>
          <button
            onClick={onSignOut}
            title="Sign out"
            className="text-stone-500 hover:text-stone-200 transition-colors duration-200 flex-shrink-0"
            aria-label="Sign out"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface AdminSidebarProps {
  userEmail: string;
}

export default function AdminSidebar({ userEmail }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  const handleNavClick = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 flex-col h-full">
        <SidebarContent
          pathname={pathname}
          userEmail={userEmail}
          onNavClick={handleNavClick}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-white border border-stone-200 rounded-lg flex items-center justify-center shadow-sm"
        aria-label="Open menu"
      >
        <Bars3Icon className="w-5 h-5 text-stone-900" />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`lg:hidden fixed left-0 top-0 bottom-0 w-64 z-50 transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent
          pathname={pathname}
          userEmail={userEmail}
          onNavClick={handleNavClick}
          onSignOut={handleSignOut}
        />
      </aside>
    </>
  );
}
