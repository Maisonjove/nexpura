'use client';

import { Bell } from 'lucide-react';

interface HeaderProps {
  user?: any;
}

export default function Header({ user }: HeaderProps) {
  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'GE';

  return (
    <header style={{
      backgroundColor: 'white',
      borderBottom: '1px solid #E7E5E4',
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      flexShrink: 0,
    }}>
      <div />
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#A8A29E', display: 'flex', alignItems: 'center' }}>
          <Bell size={18} />
        </button>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          backgroundColor: '#E7E5E4', color: '#57534E',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 600,
        }}>
          {initials}
        </div>
      </div>
    </header>
  );
}
