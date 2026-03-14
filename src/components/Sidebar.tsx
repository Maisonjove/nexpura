'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, Wrench, Gem, ShoppingCart, Users, Truck,
  FileText, DollarSign, BarChart2, ShieldCheck, MessageSquare, Bot,
  Settings, CreditCard, Globe, ExternalLink, Monitor, ListTodo,
  RotateCcw, Gift, Sun, ClipboardList, ArrowLeftRight, Star
} from 'lucide-react';

const navGroups = [
  {
    label: 'MAIN',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { name: 'Inventory', href: '/inventory', icon: Package },
      { name: 'Consignments', href: '/inventory?status=consignment', icon: Truck },
      { name: 'POS', href: '/pos', icon: Monitor },
      { name: 'Repairs', href: '/repairs', icon: Wrench },
      { name: 'Bespoke', href: '/bespoke', icon: Gem },
      { name: 'Sales', href: '/sales', icon: ShoppingCart },
      { name: 'Customers', href: '/customers', icon: Users },
      { name: 'Suppliers', href: '/suppliers', icon: Truck },
    ],
  },
  {
    label: 'FINANCIAL',
    items: [
      { name: 'Invoices', href: '/invoices', icon: FileText },
      { name: 'Quotes', href: '/quotes', icon: FileText },
      { name: 'Expenses', href: '/expenses', icon: DollarSign },
      { name: 'Gift Vouchers', href: '/vouchers', icon: Gift },
      { name: 'Refunds', href: '/refunds', icon: RotateCcw },
      { name: 'End of Day', href: '/eod', icon: Sun },
      { name: 'Reports', href: '/reports', icon: BarChart2 },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { name: 'Passports', href: '/passports', icon: ShieldCheck },
      { name: 'Stocktakes', href: '/stocktakes', icon: ClipboardList },
      { name: 'Memo & Consignment', href: '/memo', icon: ArrowLeftRight },
      { name: 'Appraisals', href: '/appraisals', icon: Star },
      { name: 'Tasks', href: '/tasks', icon: ListTodo },
      { name: 'Enquiries', href: '/enquiries', icon: MessageSquare },
      { name: 'Communications', href: '/communications', icon: MessageSquare },
      { name: 'AI Copilot', href: '/ai', icon: Bot },
      { name: 'Website', href: '/website', icon: Globe },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
      { name: 'Printing', href: '/settings/printing', icon: Settings },
      { name: 'Print Queue', href: '/print-queue', icon: FileText },
      { name: 'Documents', href: '/documents', icon: FileText },
      { name: 'Team', href: '/settings/team', icon: Users },
      { name: 'Numbering', href: '/settings/numbering', icon: FileText },
      { name: 'Import & Export', href: '/settings/import', icon: FileText },
      { name: 'Billing', href: '/billing', icon: CreditCard },
    ],
  },
];

interface SidebarProps {
  user?: any;
  isSuperAdmin?: boolean;
  websiteConfig?: {
    website_type?: string;
    external_url?: string;
    subdomain?: string;
    published?: boolean;
  } | null;
}

export default function Sidebar({ user, isSuperAdmin, websiteConfig }: SidebarProps) {
  const pathname = usePathname();

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'NX';

  return (
    <aside className="w-64 h-screen bg-[#1A1A1A] flex flex-col fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded bg-[#8B7355] flex items-center justify-center flex-shrink-0">
          <Gem size={14} color="white" />
        </div>
        <span className="text-white font-semibold text-sm">Nexpura</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] uppercase tracking-widest text-stone-500 px-4 mb-1.5 mt-5 font-medium">
              {group.label}
            </p>
            <ul className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-white/[0.08] text-white'
                          : 'text-stone-400 hover:bg-white/[0.05] hover:text-stone-200'
                      }`}
                    >
                      <item.icon
                        size={15}
                        className={`flex-shrink-0 ${isActive ? 'text-[#8B7355]' : 'text-stone-500'}`}
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
              {/* External website link — shown under TOOLS group */}
              {group.label === 'TOOLS' && websiteConfig?.website_type === 'connect' && websiteConfig.external_url && (
                <li>
                  <a
                    href={websiteConfig.external_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors text-stone-400 hover:bg-white/[0.05] hover:text-stone-200"
                  >
                    <ExternalLink
                      size={15}
                      className="flex-shrink-0 text-stone-500"
                    />
                    Your Website ↗
                  </a>
                </li>
              )}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-white/[0.06] px-4 py-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-stone-600 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-semibold text-white">{initials}</span>
        </div>
        <p className="text-xs text-stone-400 truncate">{user?.email || 'user@nexpura.com'}</p>
      </div>
    </aside>
  );
}
