'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'info' | 'error';
  duration?: number;
  onClose: () => void;
}

/**
 * Non-intrusive toast notification.
 * Auto-dismisses after duration (default 4s).
 * Slides in from bottom-right.
 */
export default function Toast({ message, type = 'info', duration = 4000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Wait for slide-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const colors = {
    success: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', icon: 'fa-check-circle', color: '#22c55e' },
    info: { bg: 'rgba(212,175,55,0.15)', border: 'rgba(212,175,55,0.3)', icon: 'fa-circle-info', color: 'var(--accent-gold)' },
    error: { bg: 'rgba(230,57,70,0.15)', border: 'rgba(230,57,70,0.3)', icon: 'fa-circle-exclamation', color: 'var(--accent-red)' },
  };

  const c = colors[type];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 10000,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 300ms ease, opacity 300ms ease',
        maxWidth: 400,
      }}
    >
      <i className={`fa-solid ${c.icon}`} style={{ color: c.color, fontSize: 18 }}></i>
      <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 500 }}>{message}</span>
      <button
        onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
        style={{
          background: 'transparent', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', padding: '2px 6px', fontSize: 14, marginLeft: 8,
        }}
      >
        <i className="fa-solid fa-xmark"></i>
      </button>
    </div>
  );
}
