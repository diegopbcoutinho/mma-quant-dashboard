'use client';

import { usePathname } from 'next/navigation';
import { useBetsStore } from '@/stores/useBetsStore';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/analytics': 'Analytics',
  '/bets': 'Apostas',
  '/simulator': 'Simulador',
  '/settings': 'Configurações',
};

interface TopBarProps {
  onOpenMobile: () => void;
}

export default function TopBar({ onOpenMobile }: TopBarProps) {
  const pathname = usePathname();
  const dolarHoje = useBetsStore((s) => s.globals.dolarHoje);

  const title = PAGE_TITLES[pathname] || 'Dashboard';
  const dolarText = dolarHoje > 0 ? `R$ ${dolarHoje.toFixed(2)}` : 'R$ --';

  return (
    <header className="top-bar">
      <button className="mobile-menu-btn" onClick={onOpenMobile} title="Menu">
        <i className="fa-solid fa-bars"></i>
      </button>
      <span className="top-bar-title">{title}</span>
      <div className="top-bar-pills">
        <div className="top-pill">
          <span className="pill-label">USD/BRL</span>
          <span className="pill-value">{dolarText}</span>
        </div>
      </div>
    </header>
  );
}
