'use client';

import { useState, useMemo } from 'react';
import { useBetsStore } from '@/stores/useBetsStore';
import { fmt } from '@/lib/helpers';
import BankrollChart from '@/components/BankrollChart';
import { KPISkeleton, ChartSkeleton } from '@/components/LoadingSkeleton';
import {
  getPnLTimeline,
  getSessionStats,
  getDailyStreak,
  type Timeframe,
  type PnLEntry,
} from '@/services/timelineEngine';

export default function DashboardPage() {
  const { bets, metrics, globals, loading } = useBetsStore();
  const [timeframe, setTimeframe] = useState<Timeframe>('weekly');

  // Memoize timeline calculations
  const session = useMemo(() => getSessionStats(bets), [bets]);
  const streak = useMemo(() => getDailyStreak(bets), [bets]);
  const pnlTimeline = useMemo(() => getPnLTimeline(bets, timeframe), [bets, timeframe]);

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

  const { settings } = useBetsStore();
  const isCompound = settings?.stake_strategy === 'compound';
  // Flat: unit based on initial bankroll | Compound: unit based on current bankroll
  const unitValue = isCompound
    ? currentBankroll * globals.unitSize
    : globals.bancaInicial * globals.unitSize;
  const profitInUnits = unitValue > 0 ? totalPL / (globals.bancaInicial * globals.unitSize) : 0;

  const upcoming = bets.filter((b) => b.result === '-');
  // Sort finished bets by date descending (newest first) for Recent Bets display
  const allFinished = bets
    .filter((b) => b.result === 'W' || b.result === 'L')
    .sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
  const recent = allFinished.slice(0, Math.max(upcoming.length, 1));

  const hasNoBets = bets.length === 0;
  const hasNoSettled = allFinished.length === 0;

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

      {/* Session + Streak Cards */}
      {!hasNoSettled && (
        <section className="session-grid">
          {/* This Week's Session */}
          <div className="glass-panel session-card">
            <div className="session-header">
              <i className="fa-solid fa-bolt"></i> This Week
            </div>
            {session.weekBets === 0 ? (
              <div className="session-empty">No bets graded this week</div>
            ) : (
              <>
                <div className={`session-pl ${session.weekPL >= 0 ? 'text-gold' : 'text-red'}`}>
                  {session.weekPL > 0 ? '+' : ''}{fmt(session.weekPL)}
                </div>
                <div className="session-details">
                  <span>{session.weekBets} bet{session.weekBets > 1 ? 's' : ''}</span>
                  <span className="session-dot">·</span>
                  <span>{session.weekWinRate.toFixed(0)}% win rate</span>
                  <span className="session-dot">·</span>
                  <span>{session.weekWins}W {session.weekLosses}L</span>
                </div>
              </>
            )}
          </div>

          {/* Streak */}
          <div className="glass-panel session-card">
            <div className="session-header">
              <i className="fa-solid fa-fire"></i> Daily Streak
            </div>
            {streak.type === null ? (
              <div className="session-empty">No streak data</div>
            ) : (
              <>
                <div className={`session-pl ${streak.type === 'win' ? 'text-gold' : 'text-red'}`}>
                  {streak.count} day{streak.count > 1 ? 's' : ''}
                </div>
                <div className="session-details">
                  <span>
                    {streak.type === 'win'
                      ? `${streak.count} consecutive profitable day${streak.count > 1 ? 's' : ''}`
                      : `${streak.count} consecutive losing day${streak.count > 1 ? 's' : ''}`
                    }
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Quick Stats */}
          <div className="glass-panel session-card">
            <div className="session-header">
              <i className="fa-solid fa-shield-halved"></i> Risk Profile
            </div>
            <div className="session-pl" style={{ color: 'var(--text-primary)' }}>
              {metrics?.maxDrawdownPct !== undefined ? `${metrics.maxDrawdownPct.toFixed(1)}%` : '--'}
            </div>
            <div className="session-details">
              <span>Max Drawdown</span>
              {metrics?.maxDrawdown !== undefined && (
                <>
                  <span className="session-dot">·</span>
                  <span className="text-red">{fmt(metrics.maxDrawdown)}</span>
                </>
              )}
            </div>
          </div>
        </section>
      )}

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

      {/* Performance Timeline */}
      {!hasNoSettled && (
        <section className="glass-panel" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa-solid fa-calendar-days"></i> Performance Timeline
            </h2>
            <div className="timeframe-toggle">
              {(['weekly', 'monthly'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  className={`timeframe-btn ${timeframe === tf ? 'active' : ''}`}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf.charAt(0).toUpperCase() + tf.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {pnlTimeline.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
              Start tracking your bets to see your performance over time.
            </div>
          ) : (
            <PnLBarChart data={pnlTimeline} />
          )}
        </section>
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
          <span className="label">1 Unit {isCompound ? '(compound)' : '(flat)'}</span>
          <span className="value">${unitValue.toFixed(2)}</span>
        </div>
      </section>

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

// ── PnL Bar Chart Component (Redesigned) ────────────────────────────────────

function PnLBarChart({ data }: { data: PnLEntry[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.profit)), 1);

  // Calculate cumulative P/L for the line overlay
  const cumulative = data.reduce<number[]>((acc, d) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
    acc.push(prev + d.profit);
    return acc;
  }, []);
  const cumulMax = Math.max(...cumulative.map(Math.abs), 1);

  return (
    <div style={{ position: 'relative' }}>
      {/* Summary row */}
      <div style={{
        display: 'flex', gap: 24, marginBottom: 16, padding: '0 4px',
        fontSize: 12, color: 'var(--text-muted)',
      }}>
        <span>
          Total: <strong style={{ color: data.reduce((s, d) => s + d.profit, 0) >= 0 ? 'var(--accent-gold)' : 'var(--accent-red)' }}>
            {data.reduce((s, d) => s + d.profit, 0) >= 0 ? '+' : ''}${data.reduce((s, d) => s + d.profit, 0).toFixed(2)}
          </strong>
        </span>
        <span>
          Periods: <strong style={{ color: 'var(--text-primary)' }}>{data.length}</strong>
        </span>
        <span>
          Best: <strong className="text-gold">
            +${Math.max(...data.map(d => d.profit), 0).toFixed(2)}
          </strong>
        </span>
        <span>
          Worst: <strong className="text-red">
            ${Math.min(...data.map(d => d.profit), 0).toFixed(2)}
          </strong>
        </span>
      </div>

      <div className="pnl-chart">
        {data.map((entry, i) => {
          const pct = (Math.abs(entry.profit) / maxAbs) * 100;
          const isPositive = entry.profit >= 0;
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={i}
              className={`pnl-bar-container ${isHovered ? 'pnl-hovered' : ''}`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Floating tooltip */}
              {isHovered && (
                <div className="pnl-tooltip">
                  <div className="pnl-tooltip-label">{entry.label}</div>
                  <div className={`pnl-tooltip-value ${isPositive ? 'text-gold' : 'text-red'}`}>
                    {isPositive ? '+' : ''}${entry.profit.toFixed(2)}
                  </div>
                  <div className="pnl-tooltip-meta">
                    {entry.bets} bet{entry.bets !== 1 ? 's' : ''} · {entry.winRate.toFixed(0)}% WR
                  </div>
                </div>
              )}

              <div className="pnl-bar-wrapper">
                <div className="pnl-bar-upper">
                  {isPositive && (
                    <div
                      className="pnl-bar pnl-bar-positive"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    >
                      {isHovered && pct > 20 && (
                        <span className="pnl-bar-value">+${entry.profit.toFixed(0)}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="pnl-zero-line" />
                <div className="pnl-bar-lower">
                  {!isPositive && (
                    <div
                      className="pnl-bar pnl-bar-negative"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    >
                      {isHovered && pct > 20 && (
                        <span className="pnl-bar-value">${entry.profit.toFixed(0)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <span className="pnl-bar-label">{entry.label}</span>
            </div>
          );
        })}
      </div>

      {/* Cumulative line overlay */}
      {data.length > 1 && (
        <svg
          className="pnl-cumulative-line"
          viewBox={`0 0 ${data.length * 100} 200`}
          preserveAspectRatio="none"
        >
          <polyline
            fill="none"
            stroke="rgba(212,175,55,0.4)"
            strokeWidth="2"
            strokeDasharray="4,4"
            points={cumulative.map((v, i) => {
              const x = i * 100 + 50;
              const y = 100 - (v / cumulMax) * 90;
              return `${x},${y}`;
            }).join(' ')}
          />
        </svg>
      )}
    </div>
  );
}
