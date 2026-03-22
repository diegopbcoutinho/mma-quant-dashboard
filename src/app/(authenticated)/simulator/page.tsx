'use client';

import { useState, useMemo, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { useBetsStore } from '@/stores/useBetsStore';
import { runMonteCarloSimulation, type MonteCarloResult } from '@/services/simulatorEngine';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function SimulatorPage() {
  const { metrics, settings } = useBetsStore();

  // Input state
  const [winRate, setWinRate] = useState(55);
  const [avgOdds, setAvgOdds] = useState(1.85);
  const [stakePercent, setStakePercent] = useState(2);
  const [numberOfBets, setNumberOfBets] = useState(100);
  const [useRealData, setUseRealData] = useState(false);

  // Result state
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const initialBankroll = settings?.initial_bankroll ?? 500;

  const handleToggleRealData = useCallback(() => {
    const next = !useRealData;
    setUseRealData(next);
    if (next && metrics) {
      if (metrics.winRate > 0) setWinRate(Math.round(metrics.winRate * 10) / 10);
      if (metrics.avgOddsWin > 0) setAvgOdds(Math.round(metrics.avgOddsWin * 1000) / 1000);
      if (settings?.unit_size) setStakePercent(Math.round(settings.unit_size * 10000) / 100);
    }
  }, [useRealData, metrics, settings]);

  const handleRun = useCallback(() => {
    setRunning(true);
    // Run async to keep UI responsive
    setTimeout(() => {
      const sim = runMonteCarloSimulation({
        initialBankroll,
        winRate,
        avgOdds,
        stakePercent,
        numberOfBets,
        simulations: 1000,
        stakeStrategy: settings?.stake_strategy ?? 'flat',
      });
      setResult(sim);
      setHasRun(true);
      setRunning(false);
    }, 50);
  }, [initialBankroll, winRate, avgOdds, stakePercent, numberOfBets]);

  // ── Fan Chart Data ──
  const chartData = useMemo(() => {
    if (!result) return null;

    const labels = result.percentiles.map(p => String(p.betNumber));
    const median = result.percentiles.map(p => p.median);
    const p90 = result.percentiles.map(p => p.p90);
    const p75 = result.percentiles.map(p => p.p75);
    const p25 = result.percentiles.map(p => p.p25);
    const p10 = result.percentiles.map(p => p.p10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: any[] = [];

    // Sample paths (faint background lines)
    result.samplePaths.forEach((sp, i) => {
      datasets.push({
        label: i === 0 ? 'Sample paths' : '',
        data: sp.points,
        borderColor: 'rgba(212, 175, 55, 0.08)',
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
        order: 10,
      });
    });

    // P10-P90 band (outer fan)
    datasets.push({
      label: '10th–90th percentile',
      data: p90,
      borderColor: 'transparent',
      backgroundColor: 'rgba(212, 175, 55, 0.06)',
      pointRadius: 0,
      tension: 0.3,
      fill: '+1', // fill down to next dataset (p10)
      order: 5,
    });
    datasets.push({
      label: '_p10_bound',
      data: p10,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      pointRadius: 0,
      tension: 0.3,
      fill: false,
      order: 5,
    });

    // P25-P75 band (inner fan)
    datasets.push({
      label: '25th–75th percentile',
      data: p75,
      borderColor: 'transparent',
      backgroundColor: 'rgba(212, 175, 55, 0.12)',
      pointRadius: 0,
      tension: 0.3,
      fill: '+1', // fill down to p25
      order: 4,
    });
    datasets.push({
      label: '_p25_bound',
      data: p25,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      pointRadius: 0,
      tension: 0.3,
      fill: false,
      order: 4,
    });

    // Median line (hero)
    datasets.push({
      label: 'Median',
      data: median,
      borderColor: '#D4AF37',
      backgroundColor: 'transparent',
      borderWidth: 2.5,
      pointRadius: 0,
      tension: 0.3,
      fill: false,
      order: 1,
    });

    // Initial bankroll reference line
    datasets.push({
      label: 'Starting bankroll',
      data: labels.map(() => initialBankroll),
      borderColor: 'rgba(255, 255, 255, 0.12)',
      borderWidth: 1,
      borderDash: [6, 4],
      pointRadius: 0,
      fill: false,
      order: 8,
    });

    return { labels, datasets };
  }, [result, initialBankroll]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: '#888891',
            font: { size: 12, family: "'Inter', sans-serif" },
            usePointStyle: true,
            pointStyle: 'line' as const,
            padding: 20,
            filter: (item: { text: string }) => !item.text.startsWith('_') && item.text !== '',
          },
        },
        tooltip: {
          backgroundColor: 'rgba(20, 20, 25, 0.95)',
          titleColor: '#ffffff',
          bodyColor: '#888891',
          borderColor: 'rgba(212, 175, 55, 0.3)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          filter: (item: any) => {
            const lbl = item?.dataset?.label || '';
            return !lbl.startsWith('_') && lbl !== '' && lbl !== 'Starting bankroll';
          },
          callbacks: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            title: (items: any[]) => `Bet #${items[0]?.label ?? ''}`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label: (ctx: any) => {
              const label = ctx.dataset.label;
              const val = '$' + (ctx.parsed?.y ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              if (label === 'Median') return `Median: ${val}`;
              if (label === '10th–90th percentile') return `90th pct: ${val}`;
              if (label === '25th–75th percentile') return `75th pct: ${val}`;
              return `${label}: ${val}`;
            },
          },
        },
      },
      scales: {
        x: {
          display: true,
          title: { display: true, text: 'Bet Number', color: '#888891', font: { size: 12 } },
          ticks: { color: '#555', maxTicksLimit: 10 },
          grid: { color: 'rgba(255,255,255,0.03)' },
        },
        y: {
          display: true,
          title: { display: true, text: 'Bankroll ($)', color: '#888891', font: { size: 12 } },
          ticks: {
            color: '#555',
            callback: (val: string | number) => '$' + Number(val).toLocaleString(),
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
      },
    }),
    []
  );

  const fmt = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (v: number) => v.toFixed(1) + '%';

  return (
    <main className="page-content">
      <div className="page-header">
        <h1 className="page-title">Monte Carlo Simulator</h1>
      </div>

      {/* Input Panel */}
      <section className="glass-panel" style={{ padding: 24 }}>
        <div className="sim-inputs-grid">
          <div className="sim-input-group">
            <label className="sim-label">Win Rate (%)</label>
            <input type="number" className="sim-input" value={winRate}
              onChange={(e) => setWinRate(parseFloat(e.target.value) || 0)}
              min={0} max={100} step={0.5} />
          </div>
          <div className="sim-input-group">
            <label className="sim-label">Average Odds</label>
            <input type="number" className="sim-input" value={avgOdds}
              onChange={(e) => setAvgOdds(parseFloat(e.target.value) || 0)}
              min={1.01} step={0.01} />
          </div>
          <div className="sim-input-group">
            <label className="sim-label">Stake Size (% of bankroll)</label>
            <input type="number" className="sim-input" value={stakePercent}
              onChange={(e) => setStakePercent(parseFloat(e.target.value) || 0)}
              min={0.1} max={100} step={0.1} />
          </div>
          <div className="sim-input-group">
            <label className="sim-label">Initial Bankroll</label>
            <div className="sim-input sim-input-readonly">{fmt(initialBankroll)}</div>
          </div>
        </div>

        {/* Number of Bets Slider */}
        <div className="sim-slider-group">
          <label className="sim-label">
            Number of Bets: <span className="sim-slider-value">{numberOfBets}</span>
          </label>
          <input type="range" className="sim-slider" value={numberOfBets}
            onChange={(e) => setNumberOfBets(parseInt(e.target.value))}
            min={10} max={1000} step={10} />
          <div className="sim-slider-ticks">
            <span>10</span><span>250</span><span>500</span><span>750</span><span>1000</span>
          </div>
        </div>

        {/* Toggle + Run */}
        <div className="sim-actions">
          <label className="sim-toggle">
            <input type="checkbox" checked={useRealData} onChange={handleToggleRealData} />
            <span className="sim-toggle-slider"></span>
            <span className="sim-toggle-text">Use my real performance data</span>
          </label>

          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa-solid fa-layer-group" style={{ fontSize: 10 }}></i>
            {settings?.stake_strategy === 'compound' ? 'Compound staking' : 'Flat staking'}
          </span>

          <button className="sim-run-btn" onClick={handleRun} disabled={running}>
            {running ? (
              <><i className="fa-solid fa-spinner fa-spin"></i> Running 1,000 simulations...</>
            ) : (
              <><i className="fa-solid fa-play"></i> Run Simulation</>
            )}
          </button>
        </div>
      </section>

      {/* Results */}
      {!hasRun ? (
        <section className="glass-panel sim-empty-state">
          <i className="fa-solid fa-dice"></i>
          <h3>Monte Carlo Bankroll Simulator</h3>
          <p>Run 1,000 independent simulations to see the expected distribution of your bankroll over time. Configure parameters above and click Run Simulation.</p>
        </section>
      ) : running ? (
        <section className="glass-panel sim-empty-state">
          <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--gold)' }}></i>
          <h3>Running simulations...</h3>
          <p>Calculating 1,000 independent paths</p>
        </section>
      ) : result ? (
        <>
          {/* Summary Cards */}
          <div className="sim-summary-grid">
            <div className="sim-summary-card">
              <span className="sim-summary-label">Median Outcome</span>
              <span className="sim-summary-value" style={{ color: result.summary.expectedProfit >= 0 ? 'var(--accent-gold)' : 'var(--accent-red)' }}>
                {fmt(result.summary.medianFinal)}
              </span>
              <span className="sim-summary-sub">
                {result.summary.expectedProfit >= 0 ? '+' : ''}{fmt(result.summary.expectedProfit)} ({pct(result.summary.medianROI)})
              </span>
            </div>
            <div className="sim-summary-card">
              <span className="sim-summary-label">
                <i className="fa-solid fa-arrow-trend-up" style={{ marginRight: 6, fontSize: 11, color: '#22c55e' }}></i>
                Upside (90th pct)
              </span>
              <span className="sim-summary-value" style={{ color: '#22c55e' }}>
                {fmt(result.summary.p90Final)}
              </span>
              <span className="sim-summary-sub">
                +{fmt(result.summary.p90Final - initialBankroll)}
              </span>
            </div>
            <div className="sim-summary-card">
              <span className="sim-summary-label">
                <i className="fa-solid fa-arrow-trend-down" style={{ marginRight: 6, fontSize: 11, color: 'var(--accent-red)' }}></i>
                Downside (10th pct)
              </span>
              <span className="sim-summary-value" style={{ color: 'var(--accent-red)' }}>
                {fmt(result.summary.p10Final)}
              </span>
              <span className="sim-summary-sub">
                {fmt(result.summary.p10Final - initialBankroll)}
              </span>
            </div>
            <div className="sim-summary-card">
              <span className="sim-summary-label">
                <i className="fa-solid fa-skull-crossbones" style={{ marginRight: 6, fontSize: 11, opacity: 0.6 }}></i>
                Risk of Ruin
              </span>
              <span className="sim-summary-value" style={{ color: result.summary.riskOfRuin > 5 ? 'var(--accent-red)' : result.summary.riskOfRuin > 0 ? '#f59e0b' : '#22c55e' }}>
                {pct(result.summary.riskOfRuin)}
              </span>
              <span className="sim-summary-sub">
                of {result.summary.simulationsRun.toLocaleString()} simulations
              </span>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="sim-summary-grid" style={{ marginTop: 0 }}>
            <div className="sim-summary-card sim-summary-card-sm">
              <span className="sim-summary-label">Probability of Profit</span>
              <span className="sim-summary-value" style={{ fontSize: 22, color: result.summary.probProfit >= 50 ? 'var(--accent-gold)' : 'var(--accent-red)' }}>
                {pct(result.summary.probProfit)}
              </span>
            </div>
            <div className="sim-summary-card sim-summary-card-sm">
              <span className="sim-summary-label">Avg Max Drawdown</span>
              <span className="sim-summary-value" style={{ fontSize: 22, color: 'var(--accent-red)' }}>
                {fmt(result.summary.avgMaxDrawdown)}
              </span>
              <span className="sim-summary-sub">{pct(result.summary.avgMaxDrawdownPct)} of peak</span>
            </div>
          </div>

          {/* Fan Chart */}
          <section className="glass-panel" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                Expected Distribution
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {result.summary.simulationsRun.toLocaleString()} simulations &middot; {numberOfBets} bets
              </span>
            </div>
            <div style={{ height: 400, position: 'relative' }}>
              {chartData && <Line data={chartData} options={chartOptions} />}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
