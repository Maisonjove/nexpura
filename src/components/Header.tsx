'use client';

import { useState } from 'react';
import NotificationBell from './NotificationBell';
import LocationPicker from './LocationPicker';
import { LanguageSwitcher } from './language-switcher';
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
    <header className="h-14 bg-background border-b border-border flex items-center justify-between px-8 flex-shrink-0">
      {/* Left side - Location selector */}
      <div className="flex items-center gap-4">
        <LocationPicker showAllOption={true} />
      </div>
      <div className="flex items-center gap-3">
        {/* Scan indicator */}
        <div
          title={lastScan ? `Last scan: ${lastScan}` : 'Barcode scanner active'}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-300 ${
            scanFlash
              ? 'bg-green-100 text-green-700'
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <span>🔍</span>
          {scanFlash && <span>Scan detected</span>}
        </div>
        <LanguageSwitcher compact />
        <NotificationBell />
        <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-semibold">
          {initials}
        </div>
      </div>
    </header>
  );
}
