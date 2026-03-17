'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBetsStore } from '@/stores/useBetsStore';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import ConnectionBanner from '@/components/ConnectionBanner';

/**
 * Authenticated Layout — wraps all protected pages.
 * Redirects to /login if no session.
 * Fetches bets + settings on mount.
 */
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading: authLoading, initialize } = useAuthStore();
  const { fetchBets, fetchSettings } = useBetsStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchBets(user.id);
      fetchSettings(user.id);
    }
  }, [user, fetchBets, fetchSettings]);

  useEffect(() => {
    const saved = localStorage.getItem('mma_sidebar_collapsed');
    if (saved === 'true') setSidebarCollapsed(true);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('mma_sidebar_collapsed', String(next));
      return next;
    });
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);

  if (authLoading || !user) {
    return (
      <div className="auth-container">
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileOpen}
        onToggle={toggleSidebar}
        onCloseMobile={closeMobile}
      />
      <div className="main-wrapper">
        <TopBar onOpenMobile={openMobile} />
        {children}
      </div>
      <ConnectionBanner />
    </div>
  );
}
