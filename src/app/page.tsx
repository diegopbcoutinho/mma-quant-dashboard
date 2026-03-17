'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * Root page — redirects based on auth state.
 * If authenticated → /dashboard
 * If not → /login
 */
export default function RootPage() {
  const router = useRouter();
  const { user, loading, initialize } = useAuthStore();

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/dashboard' : '/login');
    }
  }, [user, loading, router]);

  // Loading state while checking auth
  return (
    <div className="auth-container">
      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Carregando...</div>
    </div>
  );
}
