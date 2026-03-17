'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBetsStore } from '@/stores/useBetsStore';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { globals, settings, saveSettings, fetchBets, connectionError } = useBetsStore();

  const [banca, setBanca] = useState('');
  const [unit, setUnit] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBanca(String(globals.bancaInicial));
    setUnit(String((globals.unitSize * 100).toFixed(1)));
    setTarget(String(globals.targetUnits));
  }, [globals, settings]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    await saveSettings(user.id, {
      initial_bankroll: parseFloat(banca) || 500,
      unit_size: (parseFloat(unit) || 1) / 100,
      target_units: parseFloat(target) || 1.5,
      currency: 'USD',
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleSync = () => {
    if (user) fetchBets(user.id);
  };

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
              Percentage of bankroll per unit. E.g. 1% of $500 = $5 per unit.
            </span>
          </div>
          <div className="settings-field">
            <label htmlFor="set-target">Target Units</label>
            <input
              type="number"
              id="set-target"
              className="settings-input"
              placeholder="1.5"
              step="0.1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
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
