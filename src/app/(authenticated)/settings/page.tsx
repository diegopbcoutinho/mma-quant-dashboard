'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBetsStore } from '@/stores/useBetsStore';

/**
 * Settings Page — Sprint 1.5
 *
 * Manages user bankroll parameters with persistence in Supabase.
 * Changes trigger global metrics recalculation via the store.
 */
export default function SettingsPage() {
  const { user } = useAuthStore();
  const { globals, settings, saveSettings, fetchBets, connectionError } = useBetsStore();

  const [banca, setBanca] = useState('');
  const [unit, setUnit] = useState('');
  const [target, setTarget] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync form with store values
  useEffect(() => {
    setBanca(String(globals.bancaInicial));
    setUnit(String((globals.unitSize * 100).toFixed(1)));
    setTarget(String(globals.targetUnits));
    if (settings?.currency) setCurrency(settings.currency);
  }, [globals, settings]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    await saveSettings(user.id, {
      initial_bankroll: parseFloat(banca) || 500,
      unit_size: (parseFloat(unit) || 1) / 100,
      target_units: parseFloat(target) || 1.5,
      currency,
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
        <h1 className="page-title">Configurações</h1>
      </div>

      <div className="settings-grid">
        {/* Parâmetros da Banca */}
        <section className="glass-panel settings-card">
          <h3>
            <i className="fa-solid fa-wallet" style={{ marginRight: 8, color: 'var(--accent-gold)' }}></i>
            Banca Inicial
          </h3>
          <div className="settings-field">
            <label htmlFor="set-banca">Valor Inicial ({currency})</label>
            <input
              type="number"
              id="set-banca"
              className="settings-input"
              placeholder="500"
              value={banca}
              onChange={(e) => setBanca(e.target.value)}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Valor da banca no início do tracking. Usado para calcular ROI e evolução.
            </span>
          </div>
        </section>

        {/* Unit Size */}
        <section className="glass-panel settings-card">
          <h3>
            <i className="fa-solid fa-sliders" style={{ marginRight: 8, color: 'var(--accent-gold)' }}></i>
            Gestão de Stake
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
              Percentual da banca por unidade. Ex: 1% de $500 = $5 por unit.
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

        {/* Currency */}
        <section className="glass-panel settings-card">
          <h3>
            <i className="fa-solid fa-coins" style={{ marginRight: 8, color: 'var(--accent-gold)' }}></i>
            Moeda
          </h3>
          <div className="settings-field">
            <label htmlFor="set-currency">Moeda Principal</label>
            <select
              id="set-currency"
              className="settings-input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="USD">USD — Dólar Americano</option>
              <option value="BRL">BRL — Real Brasileiro</option>
            </select>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Define a moeda padrão exibida nos KPIs e relatórios.
            </span>
          </div>
        </section>

        {/* Conexão com Dados */}
        <section className="glass-panel settings-card">
          <h3>
            <i className="fa-solid fa-database" style={{ marginRight: 8, color: 'var(--accent-gold)' }}></i>
            Conexão com Dados
          </h3>
          <div className="connection-row">
            <span>Supabase Database</span>
            <span className={`status-badge ${connectionError ? 'offline' : 'online'}`}>
              {connectionError ? 'Erro' : 'Conectado'}
            </span>
          </div>
          <div className="connection-row">
            <span>Câmbio (AwesomeAPI)</span>
            <span className={`status-badge ${globals.dolarHoje > 0 ? 'online' : 'offline'}`}>
              {globals.dolarHoje > 0 ? 'Ao Vivo' : 'Offline'}
            </span>
          </div>
          <button className="btn-sync" onClick={handleSync}>
            <i className="fa-solid fa-rotate"></i> Sincronizar agora
          </button>
        </section>

        {/* Save button full width */}
        <section className="glass-panel settings-card settings-card--full" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            Ao salvar, todos os KPIs e métricas são recalculados automaticamente.
          </p>
          <button className="btn-save" onClick={handleSave} disabled={saving} style={{ minWidth: 140 }}>
            {saving ? (
              <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Salvando...</>
            ) : saved ? (
              <><i className="fa-solid fa-check" style={{ marginRight: 6 }}></i>Salvo!</>
            ) : (
              <><i className="fa-solid fa-floppy-disk" style={{ marginRight: 6 }}></i>Salvar Tudo</>
            )}
          </button>
        </section>
      </div>
    </main>
  );
}
