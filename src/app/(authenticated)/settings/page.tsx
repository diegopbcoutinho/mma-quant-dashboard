'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBetsStore } from '@/stores/useBetsStore';
import type { StakeStrategy } from '@/types';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { globals, settings, saveSettings, fetchBets, connectionError, metrics } = useBetsStore();

  const [banca, setBanca] = useState('');
  const [unit, setUnit] = useState('');
  const [strategy, setStrategy] = useState<StakeStrategy>('flat');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBanca(String(globals.bancaInicial));
    setUnit(String((globals.unitSize * 100).toFixed(1)));
    setStrategy(settings?.stake_strategy ?? 'flat');
  }, [globals, settings]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    await saveSettings(user.id, {
      initial_bankroll: parseFloat(banca) || 500,
      unit_size: (parseFloat(unit) || 1) / 100,
      target_units: 0,
      currency: 'USD',
      stake_strategy: strategy,
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleSync = () => {
    if (user) fetchBets(user.id);
  };

  // Calculate unit value based on strategy
  const bankrollVal = parseFloat(banca) || 500;
  const unitPct = (parseFloat(unit) || 1) / 100;
  const currentBankroll = metrics?.currentBankroll ?? bankrollVal;
  const flatUnitValue = bankrollVal * unitPct;
  const compoundUnitValue = currentBankroll * unitPct;
  const displayUnitValue = strategy === 'compound' ? compoundUnitValue : flatUnitValue;

  return (
    <main className="page-content">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="settings-grid">
        {/* Starting Bankroll */}
        <section className="glass-panel settings-card">
          <h3>
            <i className="fa-solid fa-wallet" style={{ marginRight: 8, color: 'var(--accent-gold)' }}></i>
            Starting Bankroll
          </h3>
          <div className="settings-field">
            <label htmlFor="set-banca">Initial Amount (USD)</label>
            <input
              type="number"
              id="set-banca"
              className="settings-input"
              placeholder="500"
              value={banca}
              onChange={(e) => setBanca(e.target.value)}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Your bankroll at the start of tracking. Used to calculate ROI and progression.
            </span>
          </div>
        </section>

        {/* Stake Management */}
        <section className="glass-panel settings-card">
          <h3>
            <i className="fa-solid fa-sliders" style={{ marginRight: 8, color: 'var(--accent-gold)' }}></i>
            Stake Management
          </h3>
          <div className="settings-field">
            <label htmlFor="set-unit">Unit Size (%)</label>
            <input
              type="number"
              id="set-unit"
              className="settings-input"
              placeholder="1.0"
              step="0.1"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Percentage of bankroll per unit.
            </span>
          </div>

          {/* Strategy Toggle */}
          <div className="settings-field" style={{ marginTop: 16 }}>
            <label>Staking Strategy</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setStrategy('flat')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: `1px solid ${strategy === 'flat' ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: strategy === 'flat' ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.02)',
                  color: strategy === 'flat' ? 'var(--accent-gold)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 200ms ease',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                  <i className="fa-solid fa-minus" style={{ marginRight: 6 }}></i>
                  Flat (Simple)
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  Unit stays fixed based on initial bankroll. Safer, more predictable.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStrategy('compound')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: `1px solid ${strategy === 'compound' ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: strategy === 'compound' ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.02)',
                  color: strategy === 'compound' ? 'var(--accent-gold)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 200ms ease',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                  <i className="fa-solid fa-arrow-trend-up" style={{ marginRight: 6 }}></i>
                  Compound
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  Unit scales with current bankroll. Higher upside, higher variance.
                </div>
              </button>
            </div>
          </div>

          {/* Unit preview */}
          <div style={{
            marginTop: 14, padding: '12px 14px', background: 'rgba(212,175,55,0.08)',
            borderRadius: 8, border: '1px solid rgba(212,175,55,0.15)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>1 Unit = </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)' }}>
                ${displayUnitValue.toFixed(2)}
              </span>
            </div>
            {strategy === 'compound' && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Based on current bankroll (${currentBankroll.toFixed(2)})
              </span>
            )}
            {strategy === 'flat' && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Fixed from initial bankroll
              </span>
            )}
          </div>
        </section>

        {/* Connection */}
        <section className="glass-panel settings-card">
          <h3>
            <i className="fa-solid fa-database" style={{ marginRight: 8, color: 'var(--accent-gold)' }}></i>
            Data Connection
          </h3>
          <div className="connection-row">
            <span>Supabase Database</span>
            <span className={`status-badge ${connectionError ? 'offline' : 'online'}`}>
              {connectionError ? 'Error' : 'Connected'}
            </span>
          </div>
          <button className="btn-sync" onClick={handleSync}>
            <i className="fa-solid fa-rotate"></i> Sync Now
          </button>
        </section>

        {/* Save button full width */}
        <section className="glass-panel settings-card settings-card--full" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            Saving will automatically recalculate all KPIs and metrics.
          </p>
          <button className="btn-save" onClick={handleSave} disabled={saving} style={{ minWidth: 140 }}>
            {saving ? (
              <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Saving...</>
            ) : saved ? (
              <><i className="fa-solid fa-check" style={{ marginRight: 6 }}></i>Saved!</>
            ) : (
              <><i className="fa-solid fa-floppy-disk" style={{ marginRight: 6 }}></i>Save All</>
            )}
          </button>
        </section>
      </div>
    </main>
  );
}
