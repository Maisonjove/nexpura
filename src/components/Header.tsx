"use client";

import { usePathname } from "next/navigation";

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
        <button className="relative w-9 h-9 rounded-lg hover:bg-ivory border border-platinum flex items-center justify-center transition-colors">
          <svg className="w-4 h-4 text-forest/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-sage rounded-full" />
        </button>

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
