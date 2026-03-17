'use client';

import { useBetsStore } from '@/stores/useBetsStore';

/**
 * Connection Banner — Sprint 1.5 Data Safety
 *
 * Shows a non-intrusive banner when Supabase connection fails.
 * Auto-dismissable by user. Lives in the authenticated layout.
 */
export default function ConnectionBanner() {
  const { connectionError, clearConnectionError } = useBetsStore();

  if (!connectionError) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(230, 57, 70, 0.15)',
        border: '1px solid rgba(230, 57, 70, 0.3)',
        backdropFilter: 'blur(12px)',
        borderRadius: 10,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 9999,
        fontSize: 13,
        color: 'var(--accent-red)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      <i className="fa-solid fa-wifi" style={{ opacity: 0.7 }}></i>
      <span>Problema de conexão. A sincronização pode estar atrasada.</span>
      <button
        onClick={clearConnectionError}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--accent-red)',
          cursor: 'pointer',
          fontSize: 14,
          padding: '2px 6px',
          opacity: 0.7,
        }}
      >
        <i className="fa-solid fa-xmark"></i>
      </button>
    </div>
  );
}
