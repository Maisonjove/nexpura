'use client';

import { useState } from 'react';
import NotificationBell from './NotificationBell';
import LocationPicker from './LocationPicker';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

interface HeaderProps {
  user?: {
    full_name?: string;
    email?: string;
    [key: string]: unknown;
  };
}

export default function Header({ user }: HeaderProps) {
  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'NX';

  const [scanFlash, setScanFlash] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  useBarcodeScanner({
    onScan: (barcode) => {
      setLastScan(barcode);
      setScanFlash(true);
      setTimeout(() => setScanFlash(false), 1500);
    },
  });

  return (
    <header 
      className="h-14 bg-background border-b border-border flex items-center justify-between px-8 flex-shrink-0"
      role="banner"
    >
      {/* Left side - Location selector */}
      <div className="flex items-center gap-4">
        <LocationPicker showAllOption={true} />
      </div>
      <div className="flex items-center gap-3" role="group" aria-label="Header actions">
        {/* Scan indicator */}
        <div
          role="status"
          aria-live="polite"
          aria-label={lastScan ? `Last scan: ${lastScan}` : 'Barcode scanner active'}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-300 ${
            scanFlash
              ? 'bg-green-100 text-green-700'
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <span aria-hidden="true">🔍</span>
          {scanFlash && <span>Scan detected</span>}
        </div>
        <NotificationBell />
        <div 
          className="w-8 h-8 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-semibold"
          aria-label={`User: ${user?.full_name || user?.email || 'Unknown'}`}
          role="img"
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
