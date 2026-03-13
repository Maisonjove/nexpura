'use client';

import { Bell } from 'lucide-react';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const getInitials = (name: string) => {
  if (!name) return 'U';
  if (name.includes(' ')) {
    const parts = name.split(' ');
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function Header({ user }: { user?: { name?: string | null, email?: string | null } }) {
  const userName = user?.name || user?.email || 'Anonymous';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-stone-100 h-14 px-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="md:hidden text-stone-500" />
      </div>
      <div className="flex items-center gap-4">
        <button className="text-stone-400 hover:text-stone-600 transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-stone-200 text-stone-700 text-xs font-medium">
            {getInitials(userName)}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}