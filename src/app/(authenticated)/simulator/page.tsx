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
import { runSimulation, type SimulationResult } from '@/services/simulatorEngine';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function SimulatorPage() {
  const { metrics, settings } = useBetsStore();

  // Input state
  const [winRate, setWinRate] = useState(55);
  const [avgOdds, setAvgOdds] = useState(1.85);
  const [stakePercent, setStakePercent] = useState(2);
  const [numberOfBets, setNumberOfBets] = useState(100);
  const [useRealData, setUseRealData] = useState(false);

  // Result state (local only — never saved to DB)
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [hasRun, setHasRun] = useState(false);

  // When "Use my real data" is toggled, auto-fill from metrics
  const handleToggleRealData = useCallback(() => {
    const next = !useRealData;
    setUseRealData(next);
    if (next && metrics) {
      if (metrics.winRate > 0) setWinRate(Math.round(metrics.winRate * 10) / 10);
      if (metrics.avgOddsWin > 0) setAvgOdds(Math.round(metrics.avgOddsWin * 1000) / 1000);
      if (settings?.unit_size) setStakePercent(Math.round(settings.unit_size * 10000) / 100);
    }
  }, [useRealData, metrics, settings]);

  const initialBankroll = settings?.initial_bankroll ?? 500;

  const handleRun = useCallback(() => {
    const sim = runSimulation({
      initialBankroll,
      winRate,
      avgOdds,
      stakePercent,
      numberOfBets,
    });
    setResult(sim);
    setHasRun(true);
  }, [initialBankroll, winRate, avgOdds, stakePercent, numberOfBets]);

  // Memoize chart data to avoid re-creating on every render
  const chartData = useMemo(() => {
    if (!result) return null;

    // Downsample for performance if > 200 points
    const step = result.expected.length > 200 ? Math.ceil(result.expected.length / 200) : 1;
    const labels: string[] = [];
    const expected: number[] = [];
    const best: number[] = [];
    const worst: number[] = [];

    for (let i = 0; i < result.expected.length; i += step) {
      labels.push(String(result.expected[i].betNumber));
      expected.push(result.expected[i].bankroll);
      best.push(result.bestCase[i].bankroll);
      worst.push(result.worstCase[i].bankroll);
    }

    // Always include last point
    const last = result.expected.length - 1;
    if ((last % step) !== 0) {
      labels.push(String(result.expected[last].betNumber));
      expected.push(result.expected[last].bankroll);
      best.push(result.bestCase[last].bankroll);
      worst.push(result.worstCase[last].bankroll);
    }

    return {
      labels,
      datasets: [
        {
          label: 'Best Case',
          data: best,
          borderColor: 'rgba(76, 175, 80, 0.7)',
          backgroundColor: 'rgba(76, 175, 80, 0.05)',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
          borderDash: [4, 4],
        },
        {
          label: 'Expected',
          data: expected,
          borderColor: '#D4AF37',
          backgroundColor: 'rgba(212, 175, 55, 0.08)',
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Worst Case',
          data: worst,
          borderColor: 'rgba(230, 57, 70, 0.7)',
          backgroundColor: 'rgba(230, 57, 70, 0.05)',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
          borderDash: [4, 4],
        },
      ],
    };
  }, [result]);

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
          },
        },
        tooltip: {
          backgroundColor: 'rgba(20, 20, 25, 0.95)',
          titleColor: '#ffffff',
          bodyColor: '#888891',
          borderColor: 'rgba(212, 175, 55, 0.3)',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label: (ctx: any) =>
              `${ctx.dataset.label}: $${(ctx.parsed?.y ?? 0).toFixed(2)}`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            title: (items: any[]) => `Bet #${items[0]?.label ?? ''}`,
          },
        },
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Bet Number',
            color: '#888891',
            font: { size: 12 },
          },
          ticks: { color: '#555', maxTicksLimit: 10 },
          grid: { color: 'rgba(255,255,255,0.03)' },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: 'Bankroll ($)',
            color: '#888891',
            font: { size: 12 },
          },
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

  return (
    <main className="page-content">
      <div className="page-header">
        <h1 className="page-title">Bankroll Simulator</h1>
      </div>

      {/* Input Panel */}
      <section className="glass-panel" style={{ padding: 24 }}>
        <div className="sim-inputs-grid">
          {/* Win Rate */}
          <div className="sim-input-group">
            <label className="sim-label">Win Rate (%)</label>
            <input
              type="number"
              className="sim-input"
              value={winRate}
              onChange={(e) => setWinRate(parseFloat(e.target.value) || 0)}
              min={0}
              max={100}
              step={0.5}
            />
          </div>

          {/* Average Odds */}
          <div className="sim-input-group">
            <label className="sim-label">Average Odds</label>
            <input
              type="number"
              className="sim-input"
              value={avgOdds}
              onChange={(e) => setAvgOdds(parseFloat(e.target.value) || 0)}
              min={1.01}
              step={0.01}
            />
          </div>

          {/* Stake Size */}
          <div className="sim-input-group">
            <label className="sim-label">Stake Size (% of bankroll)</label>
            <input
              type="number"
              className="sim-input"
              value={stakePercent}
              onChange={(e) => setStakePercent(parseFloat(e.target.value) || 0)}
              min={0.1}
              max={100}
              step={0.1}
            />
          </div>

          {/* Initial Bankroll (read-only from settings) */}
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
          <input
            type="range"
            className="sim-slider"
            value={numberOfBets}
            onChange={(e) => setNumberOfBets(parseInt(e.target.value))}
            min={10}
            max={1000}
            step={10}
          />
          <div className="sim-slider-ticks">
            <span>10</span>
            <span>250</span>
            <span>500</span>
            <span>750</span>
            <span>1000</span>
          </div>
        </div>

        {/* Toggle + Run Button */}
        <div className="sim-actions">
          <label className="sim-toggle">
            <input
              type="checkbox"
              checked={useRealData}
              onChange={handleToggleRealData}
            />
            <span className="sim-toggle-slider"></span>
            <span className="sim-toggle-text">Use my real performance data</span>
          </label>

          <button className="sim-run-btn" onClick={handleRun}>
            <i className="fa-solid fa-play"></i>
            Run Simulation
          </button>
        </div>
      </section>

      {/* Results */}
      {!hasRun ? (
        <section className="glass-panel sim-empty-state">
          <i className="fa-solid fa-chart-line"></i>
          <h3>Simulate your future bankroll trajectory</h3>
          <p>Configure parameters above and click Run Simulation</p>
        </section>
      ) : result ? (
        <>
          {/* Summary Cards */}
          <div className="sim-summary-grid">
            <div className="sim-summary-card">
              <span className="sim-summary-label">Expected Final</span>
              <span className="sim-summary-value" style={{ color: result.summary.expectedProfit >= 0 ? 'var(--accent-gold)' : 'var(--accent-red)' }}>
                {fmt(result.summary.finalExpected)}
              </span>
              <span className="sim-summary-sub">
                {result.summary.expectedProfit >= 0 ? '+' : ''}{fmt(result.summary.expectedProfit)} ({result.summary.expectedROI}%)
              </span>
            </div>
            <div className="sim-summary-card">
              <span className="sim-summary-label">Best Case</span>
              <span className="sim-summary-value" style={{ color: '#4CAF50' }}>
                {fmt(result.summary.finalBest)}
              </span>
              <span className="sim-summary-sub">
                +{fmt(result.summary.finalBest - initialBankroll)}
              </span>
            </div>
            <div className="sim-summary-card">
              <span className="sim-summary-label">Worst Case</span>
              <span className="sim-summary-value" style={{ color: 'var(--accent-red)' }}>
                {fmt(result.summary.finalWorst)}
              </span>
              <span className="sim-summary-sub">
                {fmt(result.summary.finalWorst - initialBankroll)}
              </span>
            </div>
            <div className="sim-summary-card">
              <span className="sim-summary-label">Max Drawdown</span>
              <span className="sim-summary-value" style={{ color: 'var(--accent-red)' }}>
                {fmt(result.summary.maxDrawdownExpected)}
              </span>
              <span className="sim-summary-sub">
                {result.summary.maxDrawdownExpectedPct}% of peak
              </span>
            </div>
          </div>

          {/* Chart */}
          <section className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              Bankroll Projection
            </h3>
            <div style={{ height: 400, position: 'relative' }}>
              {chartData && <Line data={chartData} options={chartOptions} />}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
