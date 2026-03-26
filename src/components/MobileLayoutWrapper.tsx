'use client';

import { useState, useEffect, ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

interface MobileLayoutWrapperProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}

export function MobileLayoutWrapper({ sidebar, header, children }: MobileLayoutWrapperProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  // Detect mobile/tablet
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [pathname, isMobile]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isSidebarOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen, isMobile]);

  return (
    <div className="flex min-h-screen bg-stone-50">
      {/* Mobile menu button */}
      {isMobile && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-4 left-4 z-40 p-2 bg-white rounded-lg shadow-md border border-stone-200 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-stone-700" />
        </button>
      )}

      {/* Sidebar overlay for mobile */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          ${isMobile ? 'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out' : ''}
          ${isMobile && !isSidebarOpen ? '-translate-x-full' : 'translate-x-0'}
        `}
      >
        {/* Close button for mobile */}
        {isMobile && isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-4 right-4 z-50 p-1.5 bg-stone-700 rounded-full text-white hover:bg-stone-600"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {sidebar}
      </div>

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-h-screen ${!isMobile ? 'ml-60' : 'ml-0'}`}>
        {/* Header with adjusted padding for mobile menu button */}
        <div className={isMobile ? 'pl-14' : ''}>
          {header}
        </div>
        {children}
      </div>
    </div>
  );
}

export default MobileLayoutWrapper;
