'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/stores/useAuthStore';
import { BRAND } from '@/config/brand';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
}

/** Admin emails — only these users see admin navigation items */
const ADMIN_EMAILS = ['diegopbcoutinho@gmail.com'];

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-house', href: '/dashboard' },
  { id: 'analytics', label: 'Analytics', icon: 'fa-chart-column', href: '/analytics' },
  { id: 'bets', label: 'Bets', icon: 'fa-list-check', href: '/bets' },
  { id: 'simulator', label: 'Simulator', icon: 'fa-chart-line', href: '/simulator' },
  { id: 'settings', label: 'Settings', icon: 'fa-gear', href: '/settings' },
];

const ADMIN_NAV_ITEMS = [
  { id: 'results', label: 'Results', icon: 'fa-clipboard-check', href: '/admin/results' },
];

export default function Sidebar({ collapsed, mobileOpen, onToggle, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuthStore();

  const userInitials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : '??';

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'active' : ''}`}
        onClick={onCloseMobile}
      />

      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <Image src="/logo.png" alt={BRAND.name} width={28} height={28} className="sidebar-logo-img" />
            <span className="sidebar-logo-text">
              <strong>{BRAND.name}</strong>
            </span>
          </div>
          <button className="sidebar-toggle-btn" onClick={onToggle} title="Collapse sidebar">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
                data-tooltip={item.label}
                onClick={onCloseMobile}
              >
                <i className={`fa-solid ${item.icon} nav-icon`}></i>
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}

          {/* Admin-only navigation */}
          {user && ADMIN_EMAILS.includes(user.email || '') && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 12px' }} />
              {ADMIN_NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    data-tooltip={item.label}
                    onClick={onCloseMobile}
                  >
                    <i className={`fa-solid ${item.icon} nav-icon`}></i>
                    <span className="nav-label">{item.label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User info */}
        {user && (
          <div className="sidebar-user">
            <span className="sidebar-user-avatar">{userInitials}</span>
            <div className="sidebar-user-info">
              <div className="sidebar-user-email">{user.email}</div>
            </div>
            <button className="btn-logout" onClick={signOut} title="Sign out">
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
        )}

        <div className="sidebar-footer">
          <div className="sidebar-live">
            <span className="pulse-dot"></span>
            <span className="nav-label">Live Sync</span>
          </div>
          <div className="sidebar-version">{BRAND.version}</div>
        </div>
      </aside>
    </>
  );
}
