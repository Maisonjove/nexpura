'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Users, Package, Gem, Wrench, Truck,
  FileText, DollarSign, BarChart2, ShieldCheck, MessageSquare, Bot,
  Settings
} from 'lucide-react';

const navGroups = [
  {
    label: 'MAIN',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'POS / Sales', href: '/sales', icon: ShoppingCart },
      { name: 'Customers', href: '/customers', icon: Users },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { name: 'Inventory', href: '/inventory', icon: Package },
      { name: 'Bespoke Jobs', href: '/bespoke', icon: Gem },
      { name: 'Repairs', href: '/repairs', icon: Wrench },
      { name: 'Suppliers', href: '/suppliers', icon: Truck },
    ],
  },
  {
    label: 'FINANCIAL',
    items: [
      { name: 'Invoices', href: '/invoices', icon: FileText },
      { name: 'Expenses', href: '/expenses', icon: DollarSign },
      { name: 'Reports', href: '/reports', icon: BarChart2 },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { name: 'Passports', href: '/passports', icon: ShieldCheck },
      { name: 'Communications', href: '/communications', icon: MessageSquare },
      { name: 'AI Copilot', href: '/ai', icon: Bot },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  user?: any;
  isSuperAdmin?: boolean;
}

export default function Sidebar({ user, isSuperAdmin }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      style={{ backgroundColor: '#1A1A1A', minHeight: '100vh', width: '224px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}
    >
      {/* Logo */}
      <div style={{ padding: '0 20px', height: '64px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ width: '30px', height: '30px', backgroundColor: '#8B7355', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Gem size={15} color="white" />
        </div>
        <span style={{ color: 'white', fontWeight: 600, fontSize: '16px', letterSpacing: '-0.01em' }}>Nexpura</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {navGroups.map((group) => (
          <div key={group.label}>
            <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', padding: '0 8px', marginBottom: '6px' }}>
              {group.label}
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {group.items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        fontSize: '13.5px',
                        fontWeight: 500,
                        textDecoration: 'none',
                        transition: 'background 0.15s',
                        backgroundColor: isActive ? 'rgba(255,255,255,0.09)' : 'transparent',
                        color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
                      }}
                    >
                      <item.icon
                        size={15}
                        style={{ color: isActive ? '#8B7355' : 'rgba(255,255,255,0.35)', flexShrink: 0 }}
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.email || 'user@nexpura.com'}
        </p>
      </div>
    </aside>
  );
}
