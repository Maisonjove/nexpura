'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import NotificationBell from './NotificationBell';
import LocationPicker from './LocationPicker';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

// ─── Nav structure ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    label: 'Sales',
    children: [
      { label: 'New Intake', href: '/intake', description: 'Log a new item' },
      { label: 'POS / Sales', href: '/pos', description: 'Point of sale terminal' },
      { label: 'Sales History', href: '/sales', description: 'Search previous sales' },
      { label: 'Invoices', href: '/invoices', description: 'Manage invoices' },
      { label: 'Quotes', href: '/quotes', description: 'Create & manage quotes' },
      { label: 'Laybys', href: '/laybys', description: 'Layby management' },
    ],
  },
  {
    label: 'Inventory',
    children: [
      { label: 'All Items', href: '/inventory', description: 'Browse inventory' },
      { label: 'New Item', href: '/inventory/new', description: 'Add a new item' },
      { label: 'Receive Stock', href: '/inventory/receive', description: 'Receive from supplier' },
      { label: 'Stock Transfers', href: '/inventory/transfers', description: 'Transfer between locations' },
      { label: 'Stocktakes', href: '/stocktakes', description: 'Count & reconcile' },
      { label: 'Suppliers', href: '/suppliers', description: 'Manage suppliers' },
      { label: 'Memo & Consignment', href: '/memo', description: 'Consignment tracking' },
    ],
  },
  {
    label: 'Customers',
    children: [
      { label: 'All Customers', href: '/customers', description: 'Browse customers' },
      { label: 'New Customer', href: '/customers/new', description: 'Create customer profile' },
      { label: 'Communications', href: '/communications', description: 'Emails & SMS sent' },
    ],
  },
  {
    label: 'Workshop',
    children: [
      { label: 'Repairs', href: '/repairs', description: 'All repair jobs' },
      { label: 'New Repair', href: '/repairs/new', description: 'Log a repair job' },
      { label: 'Bespoke Jobs', href: '/bespoke', description: 'Custom commissions' },
      { label: 'New Bespoke', href: '/bespoke/new', description: 'Start a commission' },
      { label: 'Workshop View', href: '/workshop', description: 'All active jobs' },
      { label: 'Appraisals', href: '/appraisals', description: 'Jewellery appraisals' },
      { label: 'Passports', href: '/passports', description: 'Item passports' },
    ],
  },
  {
    label: 'Finance',
    children: [
      { label: 'Expenses', href: '/expenses', description: 'Track expenses' },
      { label: 'Financials', href: '/financials', description: 'Financial overview' },
      { label: 'Reports', href: '/reports', description: 'All reports' },
      { label: 'Refunds', href: '/refunds', description: 'Process refunds' },
      { label: 'Vouchers', href: '/vouchers', description: 'Gift vouchers' },
      { label: 'End of Day', href: '/eod', description: 'Daily reconciliation' },
    ],
  },
  {
    label: 'Marketing',
    children: [
      { label: 'Overview', href: '/marketing', description: 'Marketing dashboard' },
      { label: 'Campaigns', href: '/marketing/campaigns', description: 'Marketing campaigns' },
      { label: 'Bulk Email', href: '/marketing/bulk-email', description: 'Send bulk emails' },
      { label: 'Bulk SMS', href: '/marketing/bulk-sms', description: 'Send bulk SMS' },
      { label: 'Automations', href: '/marketing/automations', description: 'Automated workflows' },
      { label: 'Segments', href: '/marketing/segments', description: 'Customer segments' },
      { label: 'Templates', href: '/marketing/templates', description: 'Email templates' },
    ],
  },
  {
    label: 'More',
    children: [
      { label: 'Tasks', href: '/tasks', description: 'Your task list' },
      { label: 'AI Copilot', href: '/copilot', description: 'AI assistant' },
      { label: 'Website Builder', href: '/website', description: 'Build your website' },
      { label: 'Documents', href: '/documents', description: 'Document management' },
      { label: 'Integrations', href: '/integrations', description: 'Connected services' },
      { label: 'Reminders', href: '/settings/reminders', description: 'Manage reminders' },
      { label: 'Support', href: '/support', description: 'Get help' },
    ],
  },
];

const ADMIN_ITEMS = [
  { label: 'Settings', href: '/settings', description: 'General settings' },
  { label: 'Payments', href: '/settings/payments', description: 'Payment settings' },
  { label: 'Locations', href: '/settings/locations', description: 'Manage locations' },
  { label: 'Team & Roles', href: '/settings/roles', description: 'Team management' },
  { label: 'Email Domain', href: '/settings/email', description: 'Email configuration' },
  { label: 'Notifications', href: '/settings/notifications', description: 'Notification settings' },
  { label: 'Billing', href: '/billing', description: 'Subscription & billing' },
  { label: 'Printers', href: '/settings/printing', description: 'Printer settings' },
  { label: 'Activity Log', href: '/settings/activity', description: 'View activity' },
  { label: 'Migration Hub', href: '/migration', description: 'Data migration' },
];

// ─── Dropdown component ────────────────────────────────────────────────────

function NavDropdown({ item, pathname }: { item: (typeof NAV_ITEMS)[number]; pathname: string }) {
  const hasActiveChild = item.children.some(
    (child) => pathname === child.href || pathname.startsWith(child.href + '/')
  );

  return (
    <div className="relative group/nav">
      <button
        className={`relative px-5 py-6 text-[0.9375rem] transition-opacity duration-300 hover:opacity-70 cursor-pointer ${
          hasActiveChild ? 'text-stone-900 font-medium' : 'text-stone-600'
        }`}
      >
        {item.label}
        <span
          className={`absolute bottom-[18px] left-5 right-5 h-px bg-stone-900 transition-[width] duration-300 ${
            hasActiveChild ? 'w-[calc(100%-40px)]' : 'w-0 group-hover/nav:w-[calc(100%-40px)]'
          }`}
        />
      </button>
      <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1 opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible transition-all duration-200 ease-out z-50">
        <div className="bg-white/95 backdrop-blur-2xl border border-black/[0.08] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-2 min-w-[260px]">
          {item.children.map((child) => {
            const active = pathname === child.href || pathname.startsWith(child.href + '/');
            return (
              <Link
                key={child.href}
                href={child.href}
                className={`flex flex-col px-4 py-3 rounded-xl transition-colors duration-200 ${
                  active ? 'bg-stone-100' : 'hover:bg-stone-50'
                }`}
              >
                <span className={`text-[0.875rem] font-medium ${active ? 'text-stone-900' : 'text-stone-700'}`}>
                  {child.label}
                </span>
                <span className="text-[0.8125rem] text-stone-400 mt-0.5">{child.description}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

interface TopNavProps {
  user?: { full_name?: string; email?: string; [key: string]: unknown } | null;
  tenantName?: string;
}

export default function TopNav({ user, tenantName }: TopNavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [scanFlash, setScanFlash] = useState(false);

  useBarcodeScanner({
    onScan: () => {
      setScanFlash(true);
      setTimeout(() => setScanFlash(false), 1500);
    },
  });

  const initials = user?.full_name
    ? (user.full_name as string).split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email as string)?.slice(0, 2).toUpperCase() || 'NX';

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-2xl bg-white/85 border-b border-black/[0.08]">
      <nav className="flex items-center justify-between max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 h-[72px]">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="font-serif text-[1.75rem] tracking-[0.12em] text-stone-900 transition-opacity duration-300 hover:opacity-70 shrink-0 uppercase"
        >
          {tenantName || 'Nexpura'}
        </Link>

        {/* Center nav links with dropdowns — desktop */}
        <div className="hidden lg:flex items-center">
          {NAV_ITEMS.map((item) => (
            <NavDropdown key={item.label} item={item} pathname={pathname} />
          ))}
        </div>

        {/* Right side — desktop */}
        <div className="hidden lg:flex items-center gap-4">
          <LocationPicker showAllOption={true} />

          {scanFlash && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 transition-all">
              Scan detected
            </span>
          )}

          <NotificationBell />

          {/* Admin gear dropdown */}
          <div className="relative group/admin">
            <button
              className="p-2 text-stone-400 hover:text-stone-700 transition-colors duration-200 cursor-pointer"
              aria-label="Admin settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <div className="absolute top-full right-0 pt-1 opacity-0 invisible group-hover/admin:opacity-100 group-hover/admin:visible transition-all duration-200 ease-out z-50">
              <div className="bg-white/95 backdrop-blur-2xl border border-black/[0.08] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-2 min-w-[260px]">
                {ADMIN_ITEMS.map((child) => {
                  const active = pathname === child.href || pathname.startsWith(child.href + '/');
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`flex flex-col px-4 py-3 rounded-xl transition-colors duration-200 ${
                        active ? 'bg-stone-100' : 'hover:bg-stone-50'
                      }`}
                    >
                      <span className={`text-[0.875rem] font-medium ${active ? 'text-stone-900' : 'text-stone-700'}`}>
                        {child.label}
                      </span>
                      <span className="text-[0.8125rem] text-stone-400 mt-0.5">{child.description}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* User avatar */}
          <Link href="/settings" className="flex items-center gap-2 group/user">
            <div className="w-9 h-9 rounded-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] flex items-center justify-center text-white text-xs font-medium shadow-[0_2px_4px_rgba(0,0,0,0.15)] group-hover/user:opacity-80 transition-opacity duration-200">
              {initials}
            </div>
          </Link>
        </div>

        {/* Mobile toggle */}
        <div className="lg:hidden flex items-center gap-3">
          <NotificationBell />
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex flex-col gap-1.5 p-1 cursor-pointer"
            aria-label="Toggle menu"
          >
            <span className={`block w-6 h-[1.5px] bg-stone-900 transition-transform duration-300 ${menuOpen ? 'translate-y-[3.75px] rotate-45' : ''}`} />
            <span className={`block w-6 h-[1.5px] bg-stone-900 transition-transform duration-300 ${menuOpen ? '-translate-y-[3.75px] -rotate-45' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`lg:hidden overflow-y-auto transition-all duration-300 ease-out ${menuOpen ? 'max-h-[calc(100vh-72px)] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="flex flex-col gap-1 px-6 sm:px-10 py-4 bg-white/97 border-t border-black/[0.04]">
          {/* Location picker for mobile */}
          <div className="py-2 mb-2">
            <LocationPicker showAllOption={true} />
          </div>

          {NAV_ITEMS.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.15em] text-stone-400 mb-1 px-1">
                {group.label}
              </p>
              {group.children.map((child) => {
                const active = pathname === child.href || pathname.startsWith(child.href + '/');
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={`block text-[0.9375rem] py-2.5 px-3 rounded-xl transition-colors duration-200 ${
                      active ? 'text-stone-900 bg-stone-100 font-medium' : 'text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Admin section in mobile */}
          <div className="mb-3 pt-2 border-t border-stone-200">
            <button
              onClick={() => setAdminOpen(!adminOpen)}
              className="w-full flex items-center justify-between text-[0.75rem] font-bold uppercase tracking-[0.15em] text-stone-400 mb-1 px-1 py-1 cursor-pointer"
            >
              <span>Admin</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${adminOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {adminOpen && ADMIN_ITEMS.map((child) => {
              const active = pathname === child.href || pathname.startsWith(child.href + '/');
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={`block text-[0.9375rem] py-2.5 px-3 rounded-xl transition-colors duration-200 ${
                    active ? 'text-stone-900 bg-stone-100 font-medium' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
