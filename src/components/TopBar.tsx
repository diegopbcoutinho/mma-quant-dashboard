'use client';

import { usePathname } from 'next/navigation';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/analytics': 'Analytics',
  '/bets': 'Bets',
  '/simulator': 'Simulator',
  '/settings': 'Settings',
};

interface TopBarProps {
  onOpenMobile: () => void;
}

export default function TopBar({ onOpenMobile }: TopBarProps) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || 'Dashboard';

  return (
    <header className="top-bar">
      <button className="mobile-menu-btn" onClick={onOpenMobile} title="Menu">
        <i className="fa-solid fa-bars"></i>
      </button>
      <span className="top-bar-title">{title}</span>
      <div className="top-bar-pills" />
    </header>
  );
}
