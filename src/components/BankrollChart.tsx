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
import { fmt } from '@/lib/helpers';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

interface BankrollChartProps {
  bets: Bet[];
}

export default function BankrollChart({ bets }: BankrollChartProps) {
  const settled = useMemo(
    () =>
      [...bets]
        .filter((b) => b.result === 'W' || b.result === 'L')
        .reverse(), // chronological
    [bets]
  );

  if (settled.length === 0) {
    return (
      <section className="chart-section glass-panel">
        <div className="panel-header">
          <h2>Evolução da Banca</h2>
        </div>
        <p className="empty-state-msg">Sem dados para exibir o gráfico.</p>
      </section>
    );
  }

  const labels = settled.map((b) => b.date);
  const data = settled.map((b) => b.bankroll_after);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Bankroll (USD)',
        data,
        borderColor: '#D4AF37',
        backgroundColor: 'rgba(212,175,55,0.08)',
        borderWidth: 2.5,
        pointBackgroundColor: data.map((_, i) =>
          settled[i].result === 'W' ? '#D4AF37' : '#E63946'
        ),
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
          label: (ctx: { parsed: { y: number }; dataIndex: number }) =>
            ` Bankroll: ${fmt(ctx.parsed.y ?? 0)}`,
          afterLabel: (ctx: { dataIndex: number }) => {
            const b = settled[ctx.dataIndex];
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
        <h2>Evolução da Banca</h2>
      </div>
      <div className="chart-container">
        <Line data={chartData} options={options} />
      </div>
    </section>
  );
}
