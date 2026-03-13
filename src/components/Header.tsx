'use client';

import { Bell } from 'lucide-react';

// A simple utility for getting initials from a name or email
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
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="flex items-center justify-end h-14 px-4 sm:px-6 lg:px-8">
        {/* Right side actions */}
        <div className="flex items-center gap-4">
          {/* Notification Bell */}
          <button
            type="button"
            className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
          >
            <span className="sr-only">View notifications</span>
            <Bell className="h-5 w-5" />
            {/* Notification badge */}
            <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          {/* Separator */}
          <div className="h-6 w-px bg-gray-200" aria-hidden="true" />

          {/* User Avatar */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-sm font-bold text-white">
              {getInitials(userName)}
            </div>
            <div className="hidden md:flex flex-col text-right">
              <span className="text-sm font-medium text-gray-800">{userName}</span>
              <span className="text-xs text-gray-500">User</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}