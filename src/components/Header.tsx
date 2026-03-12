"use client";

import { usePathname } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/customers": "Customers",
  "/jobs": "Jobs",
  "/repairs": "Repairs",
  "/stock": "Stock",
  "/invoices": "Invoices",
  "/settings": "Settings",
};

interface HeaderProps {
  user: {
    full_name?: string | null;
    email?: string | null;
  } | null;
}

export default function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || "Nexpura";

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-platinum flex-shrink-0">
      {/* Page title — push right on mobile to avoid hamburger overlap */}
      <h2 className="font-fraunces text-lg font-semibold text-forest ml-12 lg:ml-0">
        {title}
      </h2>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden sm:flex items-center gap-2 bg-ivory border border-platinum rounded-lg px-3 py-2 w-56">
          <svg className="w-4 h-4 text-forest/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search…"
            className="bg-transparent text-sm text-forest placeholder-forest/40 focus:outline-none w-full"
          />
        </div>

        {/* Notifications */}
        <NotificationBell />

        {/* User avatar */}
        <div className="w-9 h-9 rounded-lg bg-forest flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold text-white">
            {(user?.full_name || user?.email || "U")[0].toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  );
}
