'use client';

import { Bell } from 'lucide-react';

interface HeaderProps {
  user?: any;
}

export default function Header({ user }: HeaderProps) {
  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'NX';

  return (
    <header className="h-14 bg-stone-50 border-b border-stone-200 flex items-center justify-between px-8 flex-shrink-0">
      <div />
      <div className="flex items-center gap-4">
        <button className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors rounded-md hover:bg-stone-100">
          <Bell size={18} />
        </button>
        <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-semibold">
          {initials}
        </div>
      </div>
    </header>
  );
}
