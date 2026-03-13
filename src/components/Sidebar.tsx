'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Users, Package, Wrench, Truck,
  FileText, Bot, MessageSquare, Settings, Gem, DollarSign, BarChart2, ShieldCheck
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

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

export default function AppSidebar({ user, isSuperAdmin }: { user?: any; isSuperAdmin?: boolean }) {
  const pathname = usePathname();
  
  return (
    <Sidebar className="bg-[#1A1A1A] border-r-0 border-none">
      <SidebarHeader className="h-16 flex flex-row items-center gap-2.5 px-5 border-b border-white/[0.08]">
        <div className="w-7 h-7 rounded-md bg-[#8B7355] flex items-center justify-center">
          <Gem className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-semibold text-white">Nexpura</span>
      </SidebarHeader>
      
      <SidebarContent className="px-3 py-4 space-y-6">
        {navigation.map((section) => (
          <SidebarGroup key={section.section} className="px-0 py-0">
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-medium text-stone-500 px-3 mb-1 h-auto">
              {section.section}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {section.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      isActive={active}
                      className={`flex items-center gap-2.5 px-3 py-1.5 h-auto rounded-md text-sm transition-colors ${
                        active 
                          ? 'bg-white/[0.08] text-white hover:bg-white/[0.08] hover:text-white' 
                          : 'text-stone-400 hover:bg-white/[0.05] hover:text-stone-200'
                      }`}
                    >
                      <Link href={item.href}>
                        <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#8B7355]' : 'text-stone-400 group-hover:text-stone-200'}`} />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="px-3 py-3 border-t border-white/[0.08]">
        <p className="text-xs text-stone-500 truncate px-2">{user?.email || 'user@nexpura.com'}</p>
      </SidebarFooter>
    </Sidebar>
  );
}