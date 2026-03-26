'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, Wrench, Gem, Users,
  FileText, ShieldCheck,
  Settings, CreditCard, Globe, Monitor, ListTodo, Sun, ArrowLeftRight, Star
} from 'lucide-react';

const navGroups = [
  {
    label: 'MAIN',
    items: [
      { name: 'Dashboard', href: '/review/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { name: 'Inventory', href: '/review/inventory', icon: Package },
      { name: 'POS', href: '/review/pos', icon: Monitor },
      { name: 'Workshop', href: '/review/workshop', icon: Wrench },
      { name: 'Repairs', href: '/review/repairs', icon: Wrench },
      { name: 'Bespoke', href: '/review/bespoke', icon: Gem },
      { name: 'Customers', href: '/review/customers', icon: Users },
    ],
  },
  {
    label: 'FINANCIAL',
    items: [
      { name: 'Invoices', href: '/review/invoices', icon: FileText },
      { name: 'End of Day', href: '/review/eod', icon: Sun },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { name: 'Passports', href: '/review/passports', icon: ShieldCheck },
      { name: 'Memo & Consignment', href: '/review/memo', icon: ArrowLeftRight },
      { name: 'Appraisals', href: '/review/appraisals', icon: Star },
      { name: 'Tasks', href: '/review/tasks', icon: ListTodo },
      { name: 'Website', href: '/review/website', icon: Globe },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { name: 'Settings', href: '/review/settings', icon: Settings },
      { name: 'Billing', href: '/review/billing', icon: CreditCard },
    ],
  },
];

interface ReviewSidebarProps {
  user?: any;
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
}

export default function ReviewSidebar({ user, isSuperAdmin, websiteConfig, businessMode = 'full', readyRepairsCount = 0, readyBespokeCount = 0 }: ReviewSidebarProps) {
  const pathname = usePathname();

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'NX';

  return (
    <aside className="w-64 h-screen bg-[#1A1A1A] flex flex-col fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded bg-amber-700 flex items-center justify-center flex-shrink-0">
          <Gem size={14} color="white" />
        </div>
        <div className="flex flex-col">
          <span className="text-white font-semibold text-sm leading-tight">Nexpura</span>
          <span className="text-amber-400 text-[9px] font-bold uppercase tracking-widest leading-tight">Review Mode</span>
        </div>
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
                        className={`flex-shrink-0 ${isActive ? 'text-amber-700' : 'text-stone-500'}`}
                      />
                      <span className="flex-1">{item.name}</span>
                      {item.name === 'Repairs' && readyRepairsCount > 0 && (
                        <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {readyRepairsCount}
                        </span>
                      )}
                      {item.name === 'Bespoke' && readyBespokeCount > 0 && (
                        <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {readyBespokeCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-white/[0.06] px-4 py-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-stone-600 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-semibold text-white">{initials}</span>
        </div>
        <p className="text-xs text-stone-400 truncate">{user?.email || 'demo@nexpura.com'}</p>
      </div>
    </aside>
  );
}
