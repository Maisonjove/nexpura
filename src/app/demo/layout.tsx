"use client";

import { useState } from "react";
import { LocationProvider } from "@/contexts/LocationContext";

const DEMO_LOCATIONS = [
  { id: "demo-loc-1", name: "Sydney CBD Store", type: "retail", is_active: true },
  { id: "demo-loc-2", name: "Workshop", type: "workshop", is_active: true },
];

const NAV_ITEMS = [
  {
    label: "Sales",
    children: [
      { label: "New Sale", description: "Create a sale" },
      { label: "Quick Sale", description: "Sale without a customer" },
      { label: "Find Sale", description: "Search previous sales" },
      { label: "Point of Sale", description: "POS terminal" },
      { label: "Invoices", description: "Manage invoices" },
      { label: "Quotes", description: "Create & manage quotes" },
      { label: "Laybys", description: "Layby management" },
    ],
  },
  {
    label: "Inventory",
    children: [
      { label: "Enter Stock", description: "Receive from supplier" },
      { label: "New Item", description: "Add inventory item" },
      { label: "Find Item", description: "Search stock items" },
      { label: "Stock Transfers", description: "Transfer between locations" },
      { label: "Stocktakes", description: "Count & reconcile" },
      { label: "Suppliers", description: "Manage suppliers" },
    ],
  },
  {
    label: "Customers",
    children: [
      { label: "New Customer", description: "Create customer profile" },
      { label: "Find Customer", description: "Search customers" },
      { label: "Communications", description: "Emails & SMS sent" },
      { label: "Campaigns", description: "Marketing campaigns" },
      { label: "Segments", description: "Customer segments" },
    ],
  },
  {
    label: "Workshop",
    children: [
      { label: "New Repair", description: "Log a repair job" },
      { label: "Bespoke Job", description: "Start a commission" },
      { label: "Workshop View", description: "All active jobs" },
      { label: "Appraisals", description: "Jewellery appraisals" },
      { label: "Passports", description: "Item passports" },
    ],
  },
  {
    label: "Finance",
    children: [
      { label: "Expenses", description: "Track expenses" },
      { label: "Financials", description: "Financial overview" },
      { label: "Refunds", description: "Process refunds" },
      { label: "End of Day", description: "Daily reconciliation" },
    ],
  },
  {
    label: "Reports",
    children: [
      { label: "Sales Reports", description: "Revenue & sales data" },
      { label: "Stock Reports", description: "Inventory analytics" },
      { label: "Customer Reports", description: "Customer insights" },
      { label: "Supplier Reports", description: "Purchase history" },
      { label: "Expense Reports", description: "Expense breakdown" },
    ],
  },
];

function NavDropdown({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  return (
    <div className="relative group/nav">
      <button className="relative px-5 py-6 text-[0.9375rem] text-stone-900 transition-opacity duration-300 hover:opacity-70 cursor-pointer">
        {item.label}
        {/* Underline indicator */}
        <span className="absolute bottom-[18px] left-5 right-5 h-px bg-stone-900 w-0 group-hover/nav:w-[calc(100%-40px)] transition-[width] duration-300" />
      </button>
      {/* Dropdown panel */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1 opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible transition-all duration-200 ease-out">
        <div className="bg-white/95 backdrop-blur-2xl border border-black/[0.08] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-2 min-w-[260px]">
          {item.children.map((child) => (
            <a
              key={child.label}
              href="/signup"
              className="flex flex-col px-4 py-3 rounded-xl hover:bg-stone-50 transition-colors duration-200"
            >
              <span className="text-[0.875rem] font-medium text-stone-900">{child.label}</span>
              <span className="text-[0.8125rem] text-stone-400 mt-0.5">{child.description}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <LocationProvider initialLocations={DEMO_LOCATIONS} initialCurrentLocationId="demo-loc-1">
      <div className="min-h-screen bg-stone-50 font-sans">
        {/* Demo banner */}
        <div className="bg-stone-900 px-4 py-2.5 text-center text-[0.8125rem] text-stone-300 z-50 relative">
          <span className="text-stone-400">Demo Mode</span>
          <span className="mx-2 text-stone-600">—</span>
          <span>All data is fictional.</span>
          <a href="/signup" className="text-white font-medium ml-3 hover:opacity-70 transition-opacity duration-300">
            Start free trial →
          </a>
        </div>

        {/* Top navigation — glass header like landing page */}
        <header className="sticky top-0 z-40 backdrop-blur-2xl bg-white/85 border-b border-black/[0.08]">
          <nav className="flex items-center justify-between max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 h-[72px]">
            {/* Logo */}
            <a
              href="/demo"
              className="font-serif text-[1.75rem] tracking-[0.12em] text-stone-900 transition-opacity duration-300 hover:opacity-70 shrink-0"
            >
              NEXPURA
            </a>

            {/* Center nav links with dropdowns */}
            <div className="hidden lg:flex items-center">
              {NAV_ITEMS.map((item) => (
                <NavDropdown key={item.label} item={item} />
              ))}
            </div>

            {/* Right side */}
            <div className="hidden lg:flex items-center gap-5">
              <div className="flex items-center border border-stone-200 rounded-full px-4 py-2 w-52 hover:border-stone-300 transition-colors duration-200 cursor-pointer">
                <svg className="w-3.5 h-3.5 text-stone-400 mr-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-[0.875rem] text-stone-400">Search...</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] flex items-center justify-center text-white text-xs font-medium shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
                MW
              </div>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden flex flex-col gap-1.5 p-1 cursor-pointer"
              aria-label="Toggle menu"
            >
              <span className={`block w-6 h-[1.5px] bg-stone-900 transition-transform duration-300 ${menuOpen ? "translate-y-[3.75px] rotate-45" : ""}`} />
              <span className={`block w-6 h-[1.5px] bg-stone-900 transition-transform duration-300 ${menuOpen ? "-translate-y-[3.75px] -rotate-45" : ""}`} />
            </button>
          </nav>

          {/* Mobile menu */}
          <div className={`lg:hidden overflow-hidden transition-all duration-300 ease-out ${menuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="flex flex-col gap-1 px-6 sm:px-10 py-4 bg-white/97 border-t border-black/[0.04]">
              {NAV_ITEMS.map((item) => (
                <a key={item.label} href="/signup" className="text-[0.9375rem] text-stone-900 py-2.5 hover:opacity-70 transition-opacity duration-300">
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-8 lg:py-12">
          {children}
        </main>
      </div>
    </LocationProvider>
  );
}
