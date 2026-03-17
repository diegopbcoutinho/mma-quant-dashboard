'use client';

import { useState, useEffect, useRef } from 'react';
import { useBetsStore } from '@/stores/useBetsStore';
import RoiChart from '@/components/RoiChart';
import { KPISkeleton } from '@/components/LoadingSkeleton';
import type { EventProfit, FighterStat } from '@/types';

export default function AnalyticsPage() {
  const { analytics, loading } = useBetsStore();
  const [profitTab, setProfitTab] = useState<'event' | 'fighter'>('event');
  const [showAll, setShowAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fade in effect
  useEffect(() => {
    if (analytics && panelRef.current) {
      requestAnimationFrame(() => {
        if (panelRef.current) {
          panelRef.current.style.transition = 'opacity 0.7s ease';
          panelRef.current.style.opacity = '1';
        }
      });
    }
  }, [analytics]);

  if (loading) {
    return (
      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">Analytics</h1>
        </div>
        <KPISkeleton />
      </main>
    );
  }

  if (!analytics) {
    return (
      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">Analytics</h1>
        </div>
        <p className="empty-state-msg">Sem dados suficientes para análise.</p>
      </main>
    );
  }

  const { streaks, drawdown, bestRange, roiByOdds, profitByEvent, fighterStats } =
    analytics;

  const insightCards = [
    {
      icon: 'fa-solid fa-trophy',
      color: 'var(--accent-gold)',
      label: 'Maior Série Win',
      value: String(streaks.longestWin),
      unit: 'seguidas',
      gold: true,
    },
    {
      icon: 'fa-solid fa-skull',
      color: 'var(--accent-red)',
      label: 'Maior Série Loss',
      value: String(streaks.longestLoss),
      unit: 'seguidas',
      gold: false,
    },
    {
      icon: 'fa-solid fa-arrow-trend-down',
      color: 'var(--accent-red)',
      label: 'Drawdown Máximo',
      value: `${drawdown.maxDDPct.toFixed(1)}%`,
      unit: `$${drawdown.maxDD.toFixed(2)} a partir de $${drawdown.peak.toFixed(2)}`,
      gold: false,
    },
    {
      icon: 'fa-solid fa-bullseye',
      color: 'var(--accent-gold)',
      label: 'Melhor Faixa de Odds',
      value: bestRange ? bestRange.label : '--',
      unit: bestRange
        ? `ROI ${bestRange.roi.toFixed(1)}% · ${bestRange.count} apostas`
        : '',
      gold: true,
    },
  ];

  const tableData =
    profitTab === 'event' ? profitByEvent : (fighterStats as (EventProfit | FighterStat)[]);
  const displayData = showAll ? tableData : tableData.slice(0, 5);
  const hasMore = tableData.length > 5;

  return (
    <main className="page-content">
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
      </div>

      <div ref={panelRef} style={{ opacity: 0, display: 'contents' }}>
        {/* Insight Cards */}
        <div className="analytics-insights-row">
          {insightCards.map((c, i) => (
            <div className="analytics-insight-card" key={i}>
              <div className="aic-icon">
                <i className={c.icon} style={{ color: c.color }}></i>
              </div>
              <div className="aic-body">
                <div className="aic-label">{c.label}</div>
                <div className={`aic-value ${c.gold ? 'text-gold' : 'text-red-soft'}`}>
                  {c.value}
                </div>
                <div className="aic-unit">{c.unit}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Chart + Table grid */}
        <div className="analytics-grid">
          <div className="analytics-block">
            <div className="analytics-block-title">
              <i className="fa-solid fa-chart-bar"></i> ROI por Faixa de Odds
            </div>
            <RoiChart roiByOdds={roiByOdds} />
          </div>

          <div className="analytics-block">
            <div className="analytics-block-header">
              <div className="analytics-block-title">
                <i className="fa-solid fa-ranking-star"></i> Análise por Grupo
              </div>
              <div className="analytics-mini-tabs">
                <button
                  className={`analytics-mini-tab ${profitTab === 'event' ? 'active' : ''}`}
                  onClick={() => {
                    setProfitTab('event');
                    setShowAll(false);
                  }}
                >
                  Por Evento
                </button>
                <button
                  className={`analytics-mini-tab ${profitTab === 'fighter' ? 'active' : ''}`}
                  onClick={() => {
                    setProfitTab('fighter');
                    setShowAll(false);
                  }}
                >
                  Por Lutador
                  <span className="tooltip-wrapper">
                    <i
                      className="fa-solid fa-circle-info"
                      style={{
                        fontSize: 9,
                        marginLeft: 3,
                        color: 'var(--text-muted)',
                      }}
                    ></i>
                    <span className="tooltip-text" style={{ fontSize: 11 }}>
                      Rentabilidade histórica apostando em cada lutador.
                    </span>
                  </span>
                </button>
              </div>
            </div>

            <div className="analytics-table-scroll">
              <table className="analytics-inner-table">
                <thead>
                  <tr>
                    <th>{profitTab === 'event' ? 'Evento' : 'Lutador'}</th>
                    <th>Apostas</th>
                    <th>Win%</th>
                    <th>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((item, i) => {
                    const name =
                      'event' in item ? item.event : (item as FighterStat).fighter;
                    const profit = item.profit;
                    const cls = profit >= 0 ? 'text-gold' : 'text-red';
                    const sign = profit >= 0 ? '+' : '';

                    if (profitTab === 'fighter') {
                      const f = item as FighterStat;
                      const initials = f.fighter
                        .split(' ')
                        .map((n) => n[0] || '')
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      const avatarCls =
                        f.profit >= 0 ? 'fighter-avatar--gold' : 'fighter-avatar--red';
                      const wrCls =
                        f.winRate >= 60 ? 'wr-gold' : f.winRate < 40 ? 'wr-red' : '';

                      return (
                        <tr key={i}>
                          <td className="fighter-cell">
                            <span className={`fighter-avatar ${avatarCls}`}>
                              {initials}
                            </span>
                            <span className="fighter-cell-name" title={f.fighter}>
                              {f.fighter}
                            </span>
                          </td>
                          <td>{f.bets}</td>
                          <td className={wrCls}>{f.winRate.toFixed(0)}%</td>
                          <td className={cls}>
                            {sign}${f.profit.toFixed(2)}
                          </td>
                        </tr>
                      );
                    }

                    const e = item as EventProfit;
                    return (
                      <tr key={i}>
                        <td className="evt-name" title={e.event}>
                          {e.event}
                        </td>
                        <td>{e.bets}</td>
                        <td>{e.winRate.toFixed(0)}%</td>
                        <td className={cls}>
                          {sign}${e.profit.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <button
                className="view-all-btn"
                onClick={() => setShowAll((prev) => !prev)}
              >
                {showAll
                  ? '↑ Ver menos'
                  : `↓ Ver todos (${tableData.length})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
