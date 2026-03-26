'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, Wrench, Gem, ShoppingCart, Users, Truck,
  FileText, DollarSign, BarChart2, ShieldCheck,
  Settings, CreditCard, Globe, Monitor, ListTodo,
  RotateCcw, Gift, ClipboardList, ArrowLeftRight, Star,
  Bell, Link as LinkIcon, TrendingUp, ArrowRightLeft,
  ChevronDown, ChevronRight, Layers, MessageSquare, Sparkles, Plug,
  Moon, UserCog, MapPin, Mail, Printer, Megaphone, Send, Zap, Activity
} from 'lucide-react';

/* ─── Primary nav (always visible, no group header) ─── */
const PRIMARY_ITEMS = [
  { name: 'Dashboard',  href: '/dashboard',  icon: LayoutDashboard },
  { name: 'New Intake', href: '/intake',     icon: ClipboardList, highlight: true },
  { name: 'POS / Sales', href: '/pos',       icon: ShoppingCart },
  { name: 'Customers',  href: '/customers',   icon: Users },
  { name: 'Inventory',  href: '/inventory',   icon: Package },
  { name: 'Invoices',   href: '/invoices',    icon: FileText },
  { name: 'AI Copilot', href: '/copilot',    icon: Sparkles },
];

/* ─── Grouped (collapsible) nav ─── */
const NAV_GROUPS = [
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { name: 'Repairs',            href: '/repairs',    icon: Wrench },
      { name: 'Bespoke Jobs',       href: '/bespoke',    icon: Gem },
      { name: 'Workshop',           href: '/workshop',   icon: Wrench },
      { name: 'Sales History',      href: '/sales',      icon: BarChart2 },
      { name: 'Tasks',              href: '/tasks',      icon: ListTodo },
      { name: 'End of Day',         href: '/eod',        icon: Moon },
      { name: 'Suppliers',          href: '/suppliers',  icon: Truck },
      { name: 'Quotes',             href: '/quotes',     icon: FileText },
      { name: 'Laybys',             href: '/laybys',     icon: Layers },
      { name: 'Appraisals',         href: '/appraisals', icon: Star },
      { name: 'Memo & Consignment', href: '/memo',       icon: ArrowLeftRight },
      { name: 'Passports',          href: '/passports',  icon: ShieldCheck },
      { name: 'Stocktakes',         href: '/stocktakes', icon: ClipboardList },
      { name: 'Stock Transfers',    href: '/inventory/transfers', icon: ArrowRightLeft },
      { name: 'Reminders',          href: '/settings/reminders', icon: Bell },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { name: 'Expenses',    href: '/expenses',   icon: DollarSign },
      { name: 'Reports',     href: '/reports',    icon: BarChart2 },
      { name: 'Financials',  href: '/financials', icon: TrendingUp },
      { name: 'Refunds',     href: '/refunds',    icon: RotateCcw },
      { name: 'Vouchers',    href: '/vouchers',   icon: Gift },
    ],
  },
  {
    id: 'website',
    label: 'Website',
    items: [
      { name: 'Website Builder',  href: '/website',         icon: Globe },
      { name: 'Connect Website',  href: '/website/connect', icon: LinkIcon },
      { name: 'Migration Hub',    href: '/migration',       icon: ArrowRightLeft },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      { name: 'Overview',      href: '/marketing',              icon: Megaphone },
      { name: 'Campaigns',     href: '/marketing/campaigns',    icon: Mail },
      { name: 'Bulk Email',    href: '/marketing/bulk-email',   icon: Send },
      { name: 'Bulk SMS',      href: '/marketing/bulk-sms',     icon: MessageSquare },
      { name: 'Automations',   href: '/marketing/automations',  icon: Zap },
      { name: 'Segments',      href: '/marketing/segments',     icon: Users },
      { name: 'Templates',     href: '/marketing/templates',    icon: FileText },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { name: 'Settings',     href: '/settings',           icon: Settings },
      { name: 'Payments',     href: '/settings/payments',  icon: CreditCard },
      { name: 'Locations',    href: '/settings/locations', icon: MapPin },
      { name: 'Team & Roles', href: '/settings/roles',     icon: UserCog },
      { name: 'Email Domain', href: '/settings/email',     icon: Mail },
      { name: 'Notifications', href: '/settings/notifications', icon: Bell },
      { name: 'Billing',      href: '/billing',            icon: CreditCard },
      { name: 'Documents',    href: '/documents',          icon: FileText },
      { name: 'Connected Services', href: '/integrations', icon: Plug },
      { name: 'Printers',     href: '/settings/printing',  icon: Printer },
      { name: 'Activity Log', href: '/settings/activity',  icon: Activity },
      { name: 'Support',      href: '/support',            icon: MessageSquare },
    ],
  },
];

const STORAGE_KEY = 'nexpura_nav_collapsed';

interface SidebarProps {
  user?: { full_name?: string; email?: string; role?: string } | null;
  isSuperAdmin?: boolean;
  websiteConfig?: {
    website_type?: string;
    external_url?: string;
    subdomain?: string;
    published?: boolean;
  } | null;
  businessMode?: string;
  readyRepairsCount?: number;
  readyBespokeCount?: number;
  plan?: string; // boutique | studio | atelier
  tenantName?: string;
}

export default function Sidebar({
  user,
  isSuperAdmin,
  websiteConfig,
  businessMode = 'full',
  readyRepairsCount = 0,
  readyBespokeCount = 0,
  plan = 'boutique',
  tenantName,
}: SidebarProps) {
  const hasWebsite = plan === 'studio' || plan === 'atelier';
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setCollapsed(JSON.parse(stored));
    } catch {}
  }, []);

  function toggleGroup(id: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  /* filter by businessMode */
  function filterItems(items: typeof PRIMARY_ITEMS) {
    return items.filter((item) => {
      if (businessMode === 'retail') {
        if (['Bespoke', 'Workshop'].includes(item.name)) return false;
      }
      if (businessMode === 'workshop') {
        if (['Sales', 'POS'].includes(item.name)) return false;
      }
      if (businessMode === 'bespoke') {
        if (['Sales', 'POS', 'Repairs'].includes(item.name)) return false;
      }
      return true;
    });
  }

  const initials = tenantName
    ? tenantName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'NX';

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  }

  // Map hrefs to data-tour attribute values for the onboarding tour
  const TOUR_TARGETS: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/pos': 'pos',
    '/inventory': 'inventory',
    '/repairs': 'repairs',
    '/customers': 'customers',
    '/invoices': 'invoices',
    '/reports': 'reports',
    '/settings': 'settings',
  };

  function NavItem({ name, href, icon: Icon, badge, highlight }: { name: string; href: string; icon: React.ElementType; badge?: number; highlight?: boolean }) {
    const active = isActive(href);
    const tourAttr = TOUR_TARGETS[href];
    return (
      <li role="none">
        <Link
          href={href}
          data-tour={tourAttr}
          role="menuitem"
          aria-current={active ? 'page' : undefined}
          aria-label={badge ? `${name}, ${badge} items` : name}
          className={`flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors relative focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1A] outline-none ${
            active
              ? 'bg-stone-800 text-white border-l-2 border-amber-500 -ml-px pl-[11px]'
              : highlight
              ? 'bg-amber-700/20 text-amber-400 hover:bg-amber-700/30 border border-amber-700/40'
              : 'text-stone-400 hover:bg-white/[0.05] hover:text-stone-200'
          }`}
        >
          <Icon
            size={14}
            className={`flex-shrink-0 ${active ? 'text-amber-400' : highlight ? 'text-amber-400' : 'text-stone-500'}`}
            aria-hidden="true"
          />
          <span className="flex-1 truncate">{name}</span>
          {badge !== undefined && badge > 0 && (
            <span 
              className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center"
              aria-label={`${badge} items requiring attention`}
            >
              {badge}
            </span>
          )}
        </Link>
      </li>
    );
  }

  return (
    <aside 
      className="w-60 h-screen bg-[#1A1A1A] flex flex-col lg:fixed left-0 top-0 z-30"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded bg-amber-600 flex items-center justify-center flex-shrink-0" aria-hidden="true">
          <Gem size={14} color="white" />
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">Nexpura</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin" role="navigation">
        {/* Primary items — always visible, no header */}
        <ul className="space-y-0.5 px-2 mb-4" role="menu" aria-label="Primary navigation">
          {filterItems(PRIMARY_ITEMS).map((item) => (
            <NavItem
              key={item.href}
              name={item.name}
              href={item.href}
              icon={item.icon}
              highlight={(item as any).highlight}
              badge={
                item.name === 'Repairs' ? readyRepairsCount :
                item.name === 'Bespoke' ? readyBespokeCount :
                undefined
              }
            />
          ))}
        </ul>

        {/* Divider */}
        <div className="mx-4 mb-3 border-t border-white/[0.05]" />

        {/* Grouped collapsible sections */}
        {NAV_GROUPS.map((group) => {
          // Hide Website group entirely for Boutique plan
          if (group.id === 'website' && !hasWebsite) return null;
          const groupItems = filterItems(group.items);
          if (groupItems.length === 0) return null;
          const isCollapsed = collapsed[group.id] ?? false;
          const hasActiveChild = groupItems.some((item) => isActive(item.href));

          return (
            <div key={group.id} className="mb-1">
              <button
                onClick={() => toggleGroup(group.id)}
                aria-expanded={!isCollapsed}
                aria-controls={`nav-group-${group.id}`}
                className={`w-full flex items-center justify-between px-4 py-1.5 text-left group transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1A] rounded ${
                  hasActiveChild ? 'text-amber-500' : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {group.label}
                </span>
                {isCollapsed
                  ? <ChevronRight size={11} className="flex-shrink-0" aria-hidden="true" />
                  : <ChevronDown size={11} className="flex-shrink-0" aria-hidden="true" />
                }
              </button>

              {!isCollapsed && (
                <ul 
                  id={`nav-group-${group.id}`}
                  className="space-y-0.5 px-2 mt-0.5 mb-2"
                  role="menu"
                  aria-label={group.label}
                >
                  {groupItems.map((item) => (
                    <NavItem
                      key={item.href}
                      name={item.name}
                      href={item.href}
                      icon={item.icon}
                    />
                  ))}
                  {/* External website link under WEBSITE group */}
                  {group.id === 'website' && websiteConfig?.website_type === 'connect' && websiteConfig.external_url && (
                    <li>
                      <a
                        href={websiteConfig.external_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] text-stone-400 hover:bg-white/[0.05] hover:text-stone-200"
                      >
                        <LinkIcon size={14} className="flex-shrink-0 text-stone-500" />
                        Your Website ↗
                      </a>
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-white/[0.06] px-4 py-3.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-semibold text-white">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-stone-300 truncate">
            {tenantName || 'Business'}
          </p>
          <p className="text-[10px] text-stone-500 truncate">{user?.full_name || user?.email?.split('@')[0] || 'User'}</p>
        </div>
        <Link href="/settings" className="text-stone-600 hover:text-stone-300 transition-colors">
          <Settings size={14} />
        </Link>
      </div>
    </aside>
  );
}
