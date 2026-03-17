'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/stores/useAuthStore';
import { BRAND } from '@/config/brand';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, user, loading, initialize } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err);
      setSubmitting(false);
    } else {
      router.replace('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <Image src="/logo.png" alt={BRAND.name} width={48} height={48} />
          <span className="auth-logo-text">
            <strong>{BRAND.name}</strong>
          </span>
        </div>

        <h1 className="auth-title">Sign In</h1>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-link">
          Don&apos;t have an account?{' '}
          <Link href="/signup">Create account</Link>
        </p>
      </div>
    </div>
  );
}
