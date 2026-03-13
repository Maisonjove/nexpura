'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Users, Package, Scissors, Wrench, Truck,
  FileText, CreditCard, BarChart, Tag, ShieldCheck, Bot, MessageSquare,
  Settings, Diamond
} from 'lucide-react';

const navigation = [
  {
    section: 'MAIN',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'POS/Sales', href: '/sales', icon: ShoppingCart },
      { name: 'Customers', href: '/customers', icon: Users },
    ],
  },
  {
    section: 'OPERATIONS',
    items: [
      { name: 'Inventory', href: '/inventory', icon: Package },
      { name: 'Bespoke Jobs', href: '/bespoke', icon: Scissors },
      { name: 'Repairs', href: '/repairs', icon: Wrench },
      { name: 'Suppliers', href: '/suppliers', icon: Truck },
    ],
  },
  {
    section: 'FINANCIAL',
    items: [
      { name: 'Invoices', href: '/invoices', icon: FileText },
      { name: 'Billing', href: '/billing', icon: CreditCard },
      { name: 'Reports', href: '/reports', icon: BarChart },
    ],
  },
  {
    section: 'TOOLS',
    items: [
      { name: 'Stock Tags', href: '/settings/tags', icon: Tag },
      { name: 'Passports', href: '/passports', icon: ShieldCheck },
      { name: 'AI Copilot', href: '/ai', icon: Bot },
      { name: 'Communications', href: '/communications', icon: MessageSquare },
    ],
  },
  {
    section: 'ADMIN',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface SidebarProps {
  user?: any;
  isSuperAdmin?: boolean;
}

export default function Sidebar({ user, isSuperAdmin }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-gray-200 px-6 pb-4 w-64">
      <div className="flex h-16 shrink-0 items-center">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Diamond className="h-8 w-8 text-accent-teal" />
          <span className="text-xl font-bold text-charcoal">Nexpura</span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          {navigation.map((section) => (
            <li key={section.section}>
              <div className="text-xs font-semibold leading-6 text-gray-400">{section.section}</div>
              <ul role="list" className="-mx-2 mt-2 space-y-1">
                {section.items.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={classNames(
                        pathname.startsWith(item.href)
                          ? 'bg-gray-100 text-accent-teal'
                          : 'text-gray-700 hover:text-accent-teal hover:bg-gray-50',
                        'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                      )}
                    >
                      <item.icon
                        className={classNames(
                          pathname.startsWith(item.href) ? 'text-accent-teal' : 'text-gray-400 group-hover:text-accent-teal',
                          'h-6 w-6 shrink-0'
                        )}
                        aria-hidden="true"
                      />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
