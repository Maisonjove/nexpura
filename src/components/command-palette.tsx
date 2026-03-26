'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  LayoutDashboard, Package, Wrench, Gem, ShoppingCart, Users,
  FileText, BarChart2, Settings, Plus, Search, X, ListTodo,
  ClipboardList, Star, Bell, TrendingUp, Globe, HelpCircle
} from 'lucide-react';

const quickActions = [
  { label: 'New Sale / Intake', href: '/intake', icon: ClipboardList, group: 'Quick Actions' },
  { label: 'New Repair', href: '/repairs/new', icon: Wrench, group: 'Quick Actions' },
  { label: 'New Customer', href: '/customers/new', icon: Users, group: 'Quick Actions' },
  { label: 'New Inventory Item', href: '/inventory/new', icon: Package, group: 'Quick Actions' },
  { label: 'New Bespoke Job', href: '/bespoke/new', icon: Gem, group: 'Quick Actions' },
  { label: 'New Invoice', href: '/invoices/new', icon: FileText, group: 'Quick Actions' },
];

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, group: 'Navigate' },
  { label: 'POS / Sales', href: '/pos', icon: ShoppingCart, group: 'Navigate' },
  { label: 'Customers', href: '/customers', icon: Users, group: 'Navigate' },
  { label: 'Inventory', href: '/inventory', icon: Package, group: 'Navigate' },
  { label: 'Repairs', href: '/repairs', icon: Wrench, group: 'Navigate' },
  { label: 'Bespoke Jobs', href: '/bespoke', icon: Gem, group: 'Navigate' },
  { label: 'Invoices', href: '/invoices', icon: FileText, group: 'Navigate' },
  { label: 'Tasks', href: '/tasks', icon: ListTodo, group: 'Navigate' },
  { label: 'Reports', href: '/reports', icon: BarChart2, group: 'Navigate' },
  { label: 'Appraisals', href: '/appraisals', icon: Star, group: 'Navigate' },
  { label: 'Reminders', href: '/settings/reminders', icon: Bell, group: 'Navigate' },
  { label: 'Financials', href: '/financials', icon: TrendingUp, group: 'Navigate' },
  { label: 'Website', href: '/website', icon: Globe, group: 'Navigate' },
  { label: 'Settings', href: '/settings', icon: Settings, group: 'Navigate' },
  { label: 'Help', href: '/help', icon: HelpCircle, group: 'Navigate' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();

  const handleOpen = useCallback(() => {
    setOpen(true);
    setSearch('');
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) {
          setOpen(false);
        } else {
          handleOpen();
        }
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, handleOpen]);

  const runCommand = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  if (!open) return null;

  const allItems = [...quickActions, ...navItems];
  const filtered = search
    ? allItems.filter(item =>
        item.label.toLowerCase().includes(search.toLowerCase())
      )
    : allItems;

  const grouped = filtered.reduce<Record<string, typeof allItems>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Command dialog */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100">
          <Search className="h-4 w-4 text-stone-400 shrink-0" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or jump to..."
            className="flex-1 text-sm bg-transparent outline-none text-stone-900 placeholder:text-stone-400"
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <X className="h-4 w-4 text-stone-400 hover:text-stone-600" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 text-[10px] font-medium text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {Object.keys(grouped).length === 0 && (
            <div className="py-8 text-center text-sm text-stone-500">
              No results found for &quot;{search}&quot;
            </div>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-1">
              <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                {group}
              </div>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => runCommand(item.href)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-amber-50 hover:text-amber-800 transition-colors group"
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-stone-100 group-hover:bg-amber-100 transition-colors">
                      <Icon className="h-3.5 w-3.5 text-stone-500 group-hover:text-amber-700" />
                    </div>
                    <span className="font-medium">{item.label}</span>
                    {group === 'Quick Actions' && (
                      <Plus className="h-3 w-3 text-stone-300 group-hover:text-amber-500 ml-auto" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-stone-100 px-4 py-2 flex items-center gap-3 text-[11px] text-stone-400">
          <span><kbd className="font-mono">↑↓</kbd> to navigate</span>
          <span><kbd className="font-mono">↵</kbd> to select</span>
          <span><kbd className="font-mono">⌘K</kbd> to toggle</span>
        </div>
      </div>
    </div>
  );
}
