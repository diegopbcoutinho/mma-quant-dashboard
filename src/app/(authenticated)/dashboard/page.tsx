'use client';

import { useBetsStore } from '@/stores/useBetsStore';
import { fmt } from '@/lib/helpers';
import BankrollChart from '@/components/BankrollChart';
import { KPISkeleton, ChartSkeleton } from '@/components/LoadingSkeleton';

/**
 * Dashboard Page — Sprint 1.5
 *
 * All KPI values now come from metricsEngine via the store.
 * No local calculations — single source of truth.
 */
export default function DashboardPage() {
  const { bets, metrics, globals, loading } = useBetsStore();

  if (loading) {
    return (
      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
        </div>
        <KPISkeleton />
        <ChartSkeleton />
      </main>
    );
  }

  // Use metricsEngine values (fallback to defaults for empty state)
  const currentBankroll = metrics?.currentBankroll ?? globals.bancaInicial;
  const totalPL = metrics?.totalProfit ?? 0;
  const roi = metrics?.roi ?? 0;
  const winRate = metrics?.winRate ?? 0;
  const wins = metrics?.wins ?? 0;
  const losses = metrics?.losses ?? 0;
  const totalBets = metrics?.totalBets ?? 0;

  const upcoming = bets.filter((b) => b.result === '-');
  const allFinished = bets.filter((b) => b.result === 'W' || b.result === 'L');
  const recent = allFinished.slice(0, Math.max(upcoming.length, 1));

  // Empty state
  const hasNoBets = bets.length === 0;

  return (
    <main className="page-content">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      {/* KPIs — sourced from metricsEngine */}
      <section className="kpi-grid">
        <div className="kpi-card glass-panel">
          <div className="kpi-header">
            <i className="fa-solid fa-wallet"></i> Bankroll Atual (USD)
          </div>
          <div className="kpi-value">{fmt(currentBankroll)}</div>
          <div className="kpi-subtitle">
            {totalBets > 0 ? `Após ${totalBets} apostas` : 'Banca Inicial'}
          </div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-header">
            <i className="fa-solid fa-chart-line"></i> ROI
          </div>
          <div className={`kpi-value ${roi >= 0 ? 'text-gold' : 'text-red'}`}>
            {roi.toFixed(2)}%
          </div>
          <div className="kpi-subtitle">
            {totalBets > 0 ? `${wins}W — ${losses}L de ${totalBets}` : 'Sem dados'}
          </div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-header">
            <i className="fa-solid fa-money-bill-trend-up"></i> Profit / Loss (USD)
          </div>
          <div className={`kpi-value ${totalPL >= 0 ? 'text-gold' : 'text-red'}`}>
            {totalPL > 0 ? '+' : ''}
            {fmt(totalPL)}
          </div>
          <div className="kpi-subtitle">Lucro Total</div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-header">
            <i className="fa-solid fa-percent"></i> Win Rate
          </div>
          <div className="kpi-value">{winRate.toFixed(1)}%</div>
          <div className="kpi-subtitle">Vitórias vs Derrotas</div>
        </div>
      </section>

      {/* Bankroll Chart */}
      {hasNoBets ? (
        <section className="glass-panel" style={{ padding: 40, textAlign: 'center' }}>
          <i className="fa-solid fa-chart-area" style={{ fontSize: 48, color: 'var(--text-muted)', marginBottom: 16 }}></i>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Adicione apostas para ver o gráfico de evolução da banca.
          </p>
        </section>
      ) : (
        <BankrollChart bets={bets} />
      )}

      {/* Global Controls */}
      <section className="global-controls glass-panel">
        <div className="control-group">
          <span className="label">Banca Inicial</span>
          <span className="value">${globals.bancaInicial.toFixed(2)}</span>
        </div>
        <div className="control-group">
          <span className="label">Target Units</span>
          <span className="value">{globals.targetUnits.toFixed(2)}</span>
        </div>
        <div className="control-group">
          <span className="label">Unit Size</span>
          <span className="value">{(globals.unitSize * 100).toFixed(1)}%</span>
        </div>
        <div className="control-group highlight">
          <span className="label">Dólar Hoje (R$)</span>
          <span className="value">
            {globals.dolarHoje > 0 ? `R$ ${globals.dolarHoje.toFixed(2)}` : 'R$ --'}
          </span>
        </div>
      </section>

      {/* Bottom grid: recent bets + upcoming */}
      <div className="dashboard-bottom-grid">
        <section className="glass-panel">
          <div className="panel-header" style={{ padding: '20px 20px 0' }}>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 16,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Últimas Apostas
            </h2>
          </div>
          <div style={{ padding: '0 20px 20px' }}>
            {recent.length === 0 ? (
              <p className="empty-state-msg">Sem apostas finalizadas.</p>
            ) : (
              recent.map((b, i) => (
                <div className="recent-bet-row" key={i}>
                  <span
                    className={`result-badge ${
                      b.result === 'W' ? 'badge-win' : 'badge-loss'
                    }`}
                  >
                    {b.result === 'W' ? 'WIN' : 'LOSS'}
                  </span>
                  <span className="recent-bet-fight">{b.fight_name || '--'}</span>
                  <span className={b.result === 'W' ? 'text-gold' : 'text-red'}>
                    {b.result === 'W' ? '+' : ''}
                    {fmt(b.pl_usd)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="glass-panel">
          <div className="panel-header" style={{ padding: '20px 20px 0' }}>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 16,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Apostas em Andamento
            </h2>
          </div>
          <div style={{ padding: '0 20px 20px' }}>
            {upcoming.length === 0 ? (
              <p className="empty-state-msg">Nenhuma aposta em andamento.</p>
            ) : (
              upcoming.map((b, i) => (
                <div className="recent-bet-row" key={i}>
                  <span className="result-badge badge-pending">PEND.</span>
                  <span className="recent-bet-fight">{b.fight_name || '--'}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {b.odds > 0 ? b.odds.toFixed(3) : '--'}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
