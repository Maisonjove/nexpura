'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Users, Package, Scissors, Wrench, Truck,
  FileText, CreditCard, BarChart2, Tag, ShieldCheck, Bot, MessageSquare,
  Settings, Gem, DollarSign, Building2
} from 'lucide-react';

const navigation = [
  {
    section: 'MAIN',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'POS / Sales', href: '/sales', icon: ShoppingCart },
      { name: 'Customers', href: '/customers', icon: Users },
    ],
  },
  {
    section: 'OPERATIONS',
    items: [
      { name: 'Inventory', href: '/inventory', icon: Package },
      { name: 'Bespoke Jobs', href: '/bespoke', icon: Gem },
      { name: 'Repairs', href: '/repairs', icon: Wrench },
      { name: 'Suppliers', href: '/suppliers', icon: Truck },
    ],
  },
  {
    section: 'FINANCIAL',
    items: [
      { name: 'Invoices', href: '/invoices', icon: FileText },
      { name: 'Expenses', href: '/expenses', icon: DollarSign },
      { name: 'Reports', href: '/reports', icon: BarChart2 },
    ],
  },
  {
    section: 'TOOLS',
    items: [
      { name: 'Passports', href: '/passports', icon: ShieldCheck },
      { name: 'Communications', href: '/communications', icon: MessageSquare },
      { name: 'AI Copilot', href: '/ai', icon: Bot },
    ],
  },
  {
    section: 'ADMIN',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export default function Sidebar({ user, isSuperAdmin }: { user?: any; isSuperAdmin?: boolean }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col w-60 min-h-screen bg-[#1C1C2E] text-white flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 h-16 px-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <Gem className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-white">Nexpura</span>
      </div>
      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {navigation.map((section) => (
          <div key={section.section}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold tracking-widest text-white/30 uppercase">{section.section}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <li key={item.name}>
                    <Link href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90'}`}>
                      <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-violet-400' : 'text-white/40'}`} />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {/* User footer */}
      <div className="px-4 py-3 border-t border-white/10">
        <p className="text-xs text-white/40 truncate">{user?.email || 'user@nexpura.com'}</p>
      </div>
    </div>
  );
}