'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { RoiBucket } from '@/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface RoiChartProps {
  roiByOdds: RoiBucket[];
}

export default function RoiChart({ roiByOdds }: RoiChartProps) {
  const { chartData, options } = useMemo(() => {
    const values = roiByOdds.map((b) => parseFloat(b.roi.toFixed(1)));
    const bgColors = values.map((v) =>
      v >= 0 ? 'rgba(212,175,55,0.82)' : 'rgba(230,57,70,0.82)'
    );
    const borders = values.map((v) => (v >= 0 ? '#D4AF37' : '#E63946'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: any = {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (c: { label: string }[]) => c[0].label,
            label: (c: { dataIndex: number }) => {
              const b = roiByOdds[c.dataIndex];
              return [
                ` ROI: ${b.roi.toFixed(1)}%`,
                ` ${b.wins}W / ${b.losses}L de ${b.count} apostas`,
                ` Win Rate: ${b.winRate.toFixed(1)}%`,
              ];
            },
          },
          backgroundColor: 'rgba(15,15,18,0.96)',
          titleColor: '#fff',
          bodyColor: '#aaa',
          borderColor: 'rgba(212,175,55,0.25)',
          borderWidth: 1,
          padding: 12,
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#888891',
            callback: (v: number) => v + '%',
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#bbb', font: { size: 12, family: 'Inter' } },
        },
      },
    };

    return {
      chartData: {
        labels: roiByOdds.map((b) => b.label),
        datasets: [
          {
            data: values,
            backgroundColor: bgColors,
            borderColor: borders,
            borderWidth: 1.5,
            borderRadius: 6,
            borderSkipped: false as const,
          },
        ],
      },
      options: opts,
    };
  }, [roiByOdds]);

  return (
    <div className="analytics-chart-wrap">
      <Bar data={chartData} options={options} />
    </div>
  );
}
