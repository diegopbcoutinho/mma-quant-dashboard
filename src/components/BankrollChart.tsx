'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { Bet } from '@/types';
import type { BankrollTimeline } from '@/services/bankrollEngine';
import { fmt } from '@/lib/helpers';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

interface BankrollChartProps {
  bets: Bet[];
  timeline: BankrollTimeline;
  initialBankroll: number;
}

export default function BankrollChart({ bets, timeline, initialBankroll }: BankrollChartProps) {
  const settledBets = useMemo(
    () =>
      [...bets]
        .filter((b) => b.result === 'W' || b.result === 'L')
        .sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateA - dateB;
        }),
    [bets]
  );

  if (settledBets.length === 0 || timeline.entries.length === 0) {
    return (
      <section className="chart-section glass-panel">
        <div className="panel-header">
          <h2>Bankroll Evolution</h2>
        </div>
        <p className="empty-state-msg">No data to display chart.</p>
      </section>
    );
  }

  const labels = ['Start', ...settledBets.map((b) => b.date || '')];
  const data = [initialBankroll, ...timeline.entries.map((e) => e.bankrollAfter)];

  const pointColors = [
    '#D4AF37',
    ...settledBets.map((b) => (b.result === 'W' ? '#D4AF37' : '#E63946')),
  ];

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Bankroll (USD)',
        data,
        borderColor: '#D4AF37',
        backgroundColor: 'rgba(212,175,55,0.08)',
        borderWidth: 2.5,
        pointBackgroundColor: pointColors,
        pointBorderColor: 'transparent',
        pointRadius: 4,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.35,
      },
    ],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number } }) =>
            ` Bankroll: ${fmt(ctx.parsed.y ?? 0)}`,
          afterLabel: (ctx: { dataIndex: number }) => {
            if (ctx.dataIndex === 0) return ' Starting Bankroll';
            const b = settledBets[ctx.dataIndex - 1];
            if (!b) return '';
            return ` ${b.fight_name} — ${b.result === 'W' ? 'WIN' : 'LOSS'}`;
          },
        },
        backgroundColor: 'rgba(15,15,18,0.95)',
        titleColor: '#aaa',
        bodyColor: '#D4AF37',
        borderColor: 'rgba(212,175,55,0.3)',
        borderWidth: 1,
        padding: 12,
      },
    },
    scales: {
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#888891',
          callback: (v: number) => '$' + v.toFixed(0),
        },
      },
      x: {
        grid: { display: false },
        ticks: { display: false },
      },
    },
  };

  return (
    <section className="chart-section glass-panel">
      <div className="panel-header">
        <h2>Bankroll Evolution</h2>
      </div>
      <div className="chart-container">
        <Line data={chartData} options={options} />
      </div>
    </section>
  );
}
