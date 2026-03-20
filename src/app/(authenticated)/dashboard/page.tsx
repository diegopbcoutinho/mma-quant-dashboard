'use client';

import { useBetsStore } from '@/stores/useBetsStore';
import { fmt } from '@/lib/helpers';
import BankrollChart from '@/components/BankrollChart';
import { KPISkeleton, ChartSkeleton } from '@/components/LoadingSkeleton';
import ShareCard from '@/components/ShareCard';

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

  const currentBankroll = metrics?.currentBankroll ?? globals.bancaInicial;
  const totalPL = metrics?.totalProfit ?? 0;
  const roi = metrics?.roi ?? 0;
  const winRate = metrics?.winRate ?? 0;
  const wins = metrics?.wins ?? 0;
  const losses = metrics?.losses ?? 0;
  const totalBets = metrics?.totalBets ?? 0;

  // Unit value for profit-in-units display
  const unitValue = globals.bancaInicial * globals.unitSize;
  const profitInUnits = unitValue > 0 ? totalPL / unitValue : 0;

  const upcoming = bets.filter((b) => b.result === '-');
  const allFinished = bets.filter((b) => b.result === 'W' || b.result === 'L');
  const recent = allFinished.slice(0, Math.max(upcoming.length, 1));

  const hasNoBets = bets.length === 0;

  return (
    <main className="page-content">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      {/* KPIs */}
      <section className="kpi-grid">
        <div className="kpi-card glass-panel">
          <div className="kpi-header">
            <i className="fa-solid fa-wallet"></i> Current Bankroll
          </div>
          <div className="kpi-value">{fmt(currentBankroll)}</div>
          <div className="kpi-subtitle">
            {totalBets > 0 ? `After ${totalBets} bets` : 'Starting Bankroll'}
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
            {totalBets > 0 ? `${wins}W — ${losses}L of ${totalBets}` : 'No data'}
          </div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-header">
            <i className="fa-solid fa-money-bill-trend-up"></i> Profit / Loss
          </div>
          <div className={`kpi-value ${totalPL >= 0 ? 'text-gold' : 'text-red'}`}>
            {totalPL > 0 ? '+' : ''}
            {fmt(totalPL)}
          </div>
          <div className="kpi-subtitle">
            {unitValue > 0 ? (
              <span>
                {profitInUnits >= 0 ? '+' : ''}{profitInUnits.toFixed(2)}u
              </span>
            ) : 'Total Profit'}
          </div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-header">
            <i className="fa-solid fa-percent"></i> Win Rate
          </div>
          <div className="kpi-value">{winRate.toFixed(1)}%</div>
          <div className="kpi-subtitle">Wins vs Losses</div>
        </div>
      </section>

      {/* Bankroll Chart */}
      {hasNoBets ? (
        <section className="glass-panel" style={{ padding: 40, textAlign: 'center' }}>
          <i className="fa-solid fa-chart-area" style={{ fontSize: 48, color: 'var(--text-muted)', marginBottom: 16 }}></i>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Add bets to see your bankroll progression chart.
          </p>
        </section>
      ) : (
        <BankrollChart
          bets={bets}
          timeline={metrics?.timeline ?? { entries: [], currentBankroll: globals.bancaInicial, totalProfit: 0, totalRisked: 0 }}
          initialBankroll={globals.bancaInicial}
        />
      )}

      {/* Global Controls */}
      <section className="global-controls glass-panel">
        <div className="control-group">
          <span className="label">Starting Bankroll</span>
          <span className="value">${globals.bancaInicial.toFixed(2)}</span>
        </div>
        <div className="control-group">
          <span className="label">Unit Size</span>
          <span className="value">{(globals.unitSize * 100).toFixed(1)}%</span>
        </div>
        <div className="control-group">
          <span className="label">1 Unit</span>
          <span className="value">${unitValue.toFixed(2)}</span>
        </div>
      </section>

      {/* Share Card */}
      <ShareCard />

      {/* Bottom grid */}
      <div className="dashboard-bottom-grid">
        <section className="glass-panel">
          <div className="panel-header" style={{ padding: '20px 20px 0' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Recent Bets
            </h2>
          </div>
          <div style={{ padding: '0 20px 20px' }}>
            {recent.length === 0 ? (
              <p className="empty-state-msg">No settled bets yet.</p>
            ) : (
              recent.map((b, i) => (
                <div className="recent-bet-row" key={i}>
                  <span className={`result-badge ${b.result === 'W' ? 'badge-win' : 'badge-loss'}`}>
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
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Upcoming Bets
            </h2>
          </div>
          <div style={{ padding: '0 20px 20px' }}>
            {upcoming.length === 0 ? (
              <p className="empty-state-msg">No upcoming bets.</p>
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
