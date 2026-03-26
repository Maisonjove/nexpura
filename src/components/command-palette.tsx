'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, Wrench, Gem, ShoppingCart, Users,
  FileText, BarChart2, Settings, Plus, Search, X, ListTodo,
  ClipboardList, Star, Bell, TrendingUp, Globe, HelpCircle, Loader2
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useFocusTrap, useAnnounce } from '@/hooks/useAccessibility';
import { useLiveRegion } from '@/components/LiveRegion';
import * as Sentry from '@sentry/nextjs';

interface SearchResult {
  id: string;
  type: 'inventory' | 'customer' | 'repair' | 'invoice';
  title: string;
  subtitle?: string;
  href: string;
}

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

const TYPE_ICONS: Record<SearchResult['type'], typeof Package> = {
  inventory: Package,
  customer: Users,
  repair: Wrench,
  invoice: FileText,
};

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  inventory: 'Inventory',
  customer: 'Customers',
  repair: 'Repairs',
  invoice: 'Invoices',
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap(open);
  const { announce } = useLiveRegion();

  const handleOpen = useCallback(() => {
    setOpen(true);
    setSearch('');
    setSearchResults([]);
    setSelectedIndex(0);
  }, []);

  // Keyboard shortcut handling
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

  // Search functionality
  useEffect(() => {
    if (!search || search.length < 2) {
      setSearchResults([]);
      return;
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const supabase = createClient();
        const searchTerm = `%${search}%`;

        // Parallel searches across all entity types
        const [inventoryRes, customersRes, repairsRes, invoicesRes] = await Promise.all([
          // Inventory: name, SKU
          supabase
            .from('inventory')
            .select('id, name, sku')
            .is('deleted_at', null)
            .or(`name.ilike.${searchTerm},sku.ilike.${searchTerm}`)
            .limit(5),
          // Customers: name, email, phone
          supabase
            .from('customers')
            .select('id, full_name, email, phone')
            .or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`)
            .limit(5),
          // Repairs: repair_number, description
          supabase
            .from('repairs')
            .select('id, repair_number, description')
            .is('deleted_at', null)
            .or(`repair_number.ilike.${searchTerm},description.ilike.${searchTerm}`)
            .limit(5),
          // Invoices: invoice_number
          supabase
            .from('invoices')
            .select('id, invoice_number, customer_name')
            .is('deleted_at', null)
            .ilike('invoice_number', searchTerm)
            .limit(5),
        ]);

        if (abortController.signal.aborted) return;

        const results: SearchResult[] = [];

        // Map inventory results
        for (const item of inventoryRes.data ?? []) {
          results.push({
            id: item.id,
            type: 'inventory',
            title: item.name,
            subtitle: item.sku || undefined,
            href: `/inventory/${item.id}`,
          });
        }

        // Map customer results
        for (const customer of customersRes.data ?? []) {
          results.push({
            id: customer.id,
            type: 'customer',
            title: customer.full_name,
            subtitle: customer.email || customer.phone || undefined,
            href: `/customers/${customer.id}`,
          });
        }

        // Map repair results
        for (const repair of repairsRes.data ?? []) {
          results.push({
            id: repair.id,
            type: 'repair',
            title: repair.repair_number || 'Repair',
            subtitle: repair.description ? repair.description.slice(0, 50) : undefined,
            href: `/repairs/${repair.id}`,
          });
        }

        // Map invoice results
        for (const invoice of invoicesRes.data ?? []) {
          results.push({
            id: invoice.id,
            type: 'invoice',
            title: invoice.invoice_number,
            subtitle: invoice.customer_name || undefined,
            href: `/invoices/${invoice.id}`,
          });
        }

        setSearchResults(results);
        setSelectedIndex(0);
        // Announce search results to screen readers
        if (results.length > 0) {
          announce(`Found ${results.length} results`);
        } else {
          announce('No results found');
        }
      } catch (error) {
        Sentry.captureException(error, { tags: { component: 'CommandPalette', action: 'search' } });
      } finally {
        setIsSearching(false);
      }
    }, 200); // Debounce

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [search]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const allItems = search && searchResults.length > 0 
      ? searchResults 
      : [...quickActions, ...navItems];
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % allItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allItems.length) % allItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (search && searchResults.length > 0) {
        const selected = searchResults[selectedIndex];
        if (selected) {
          setOpen(false);
          router.push(selected.href);
        }
      } else {
        const selected = allItems[selectedIndex];
        if (selected && 'href' in selected) {
          setOpen(false);
          router.push(selected.href);
        }
      }
    }
  }, [search, searchResults, selectedIndex, router]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = resultsRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const runCommand = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  if (!open) return null;

  const allStaticItems = [...quickActions, ...navItems];
  const filtered = search && !searchResults.length
    ? allStaticItems.filter(item =>
        item.label.toLowerCase().includes(search.toLowerCase())
      )
    : allStaticItems;

  const grouped = filtered.reduce<Record<string, typeof allStaticItems>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  // Group search results by type
  const groupedResults = searchResults.reduce<Record<string, SearchResult[]>>((acc, result) => {
    const type = TYPE_LABELS[result.type];
    if (!acc[type]) acc[type] = [];
    acc[type].push(result);
    return acc;
  }, {});

  const showSearchResults = search.length >= 2 && (searchResults.length > 0 || isSearching);
  const totalResults = showSearchResults ? searchResults.length : filtered.length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Command dialog */}
      <div 
        ref={focusTrapRef}
        className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden"
        role="combobox"
        aria-expanded={true}
        aria-haspopup="listbox"
        aria-owns="command-palette-results"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100">
          <Search className="h-4 w-4 text-stone-400 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search inventory, customers, repairs, invoices..."
            className="flex-1 text-sm bg-transparent outline-none text-stone-900 placeholder:text-stone-400"
            aria-label="Search"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            aria-activedescendant={`command-item-${selectedIndex}`}
            role="searchbox"
          />
          {isSearching && (
            <Loader2 className="h-4 w-4 text-amber-600 animate-spin" aria-label="Searching..." />
          )}
          {search && !isSearching && (
            <button 
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
            >
              <X className="h-4 w-4 text-stone-400 hover:text-stone-600" aria-hidden="true" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 text-[10px] font-medium text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200" aria-label="Press Escape to close">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div 
          ref={resultsRef} 
          id="command-palette-results"
          role="listbox"
          aria-label={`${totalResults} results available`}
          className="max-h-[400px] overflow-y-auto py-2"
        >
          {/* Search Results */}
          {showSearchResults ? (
            <>
              {isSearching && searchResults.length === 0 && (
                <div className="py-8 text-center text-sm text-stone-500">
                  Searching...
                </div>
              )}
              {!isSearching && searchResults.length === 0 && search.length >= 2 && (
                <div className="py-8 text-center text-sm text-stone-500">
                  No results found for &quot;{search}&quot;
                </div>
              )}
              {Object.entries(groupedResults).map(([type, results]) => (
                <div key={type} className="mb-1">
                  <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                    {type}
                  </div>
                  {results.map((result, index) => {
                    const globalIndex = searchResults.indexOf(result);
                    const Icon = TYPE_ICONS[result.type];
                    return (
                      <button
                        key={result.id}
                        data-index={globalIndex}
                        onClick={() => runCommand(result.href)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors group ${
                          globalIndex === selectedIndex
                            ? 'bg-amber-50 text-amber-800'
                            : 'text-stone-700 hover:bg-amber-50 hover:text-amber-800'
                        }`}
                      >
                        <div className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                          globalIndex === selectedIndex
                            ? 'bg-amber-100'
                            : 'bg-stone-100 group-hover:bg-amber-100'
                        }`}>
                          <Icon className={`h-3.5 w-3.5 ${
                            globalIndex === selectedIndex
                              ? 'text-amber-700'
                              : 'text-stone-500 group-hover:text-amber-700'
                          }`} />
                        </div>
                        <div className="flex-1 text-left">
                          <span className="font-medium">{result.title}</span>
                          {result.subtitle && (
                            <span className="text-xs text-stone-400 ml-2">{result.subtitle}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          ) : (
            <>
              {/* Static navigation when not searching */}
              {Object.keys(grouped).length === 0 && (
                <div className="py-8 text-center text-sm text-stone-500">
                  No results found for &quot;{search}&quot;
                </div>
              )}
              {Object.entries(grouped).map(([group, items]) => {
                let currentIndex = 0;
                if (group === 'Navigate') {
                  currentIndex = quickActions.length;
                }
                return (
                  <div key={group} className="mb-1">
                    <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                      {group}
                    </div>
                    {items.map((item, index) => {
                      const globalIndex = group === 'Quick Actions' ? index : quickActions.length + index;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.href}
                          data-index={globalIndex}
                          onClick={() => runCommand(item.href)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors group ${
                            globalIndex === selectedIndex
                              ? 'bg-amber-50 text-amber-800'
                              : 'text-stone-700 hover:bg-amber-50 hover:text-amber-800'
                          }`}
                        >
                          <div className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                            globalIndex === selectedIndex
                              ? 'bg-amber-100'
                              : 'bg-stone-100 group-hover:bg-amber-100'
                          }`}>
                            <Icon className={`h-3.5 w-3.5 ${
                              globalIndex === selectedIndex
                                ? 'text-amber-700'
                                : 'text-stone-500 group-hover:text-amber-700'
                            }`} />
                          </div>
                          <span className="font-medium">{item.label}</span>
                          {group === 'Quick Actions' && (
                            <Plus className={`h-3 w-3 ml-auto ${
                              globalIndex === selectedIndex
                                ? 'text-amber-500'
                                : 'text-stone-300 group-hover:text-amber-500'
                            }`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
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
