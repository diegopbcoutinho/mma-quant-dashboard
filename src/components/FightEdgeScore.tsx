'use client';

import { useMemo, useEffect, useRef } from 'react';
import { useBetsStore } from '@/stores/useBetsStore';
import {
  calculateFightEdgeScore,
  getScoreTier,
  getScoreTips,
  subScoreColor,
} from '@/services/scoreEngine';

export default function FightEdgeScore() {
  const { bets, settings } = useBetsStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  const breakdown = useMemo(
    () => calculateFightEdgeScore(bets, settings),
    [bets, settings]
  );

  // Animate on mount / data change
  useEffect(() => {
    if (!breakdown || !containerRef.current) return;

    // Animate the ring
    const ring = containerRef.current.querySelector('.score-ring-fill') as SVGCircleElement;
    if (ring) {
      requestAnimationFrame(() => {
        ring.style.strokeDashoffset = ring.dataset.target || '0';
      });
    }

    // Animate bars
    containerRef.current.querySelectorAll('.score-factor-bar').forEach((bar) => {
      const el = bar as HTMLDivElement;
      const w = el.dataset.width || '0%';
      el.style.width = '0%';
      requestAnimationFrame(() => {
        el.style.width = w;
      });
    });

    // Animate number
    if (!hasAnimated.current) {
      const numEl = containerRef.current.querySelector('.score-number') as HTMLElement;
      if (numEl) {
        const target = breakdown.total;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / 800, 1);
          numEl.textContent = String(Math.round(p * target));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
      hasAnimated.current = true;
    }
  }, [breakdown]);

  if (!breakdown) {
    return (
      <div className="analytics-score-section glass-panel">
        <div className="bet-score-empty">
          <i
            className="fa-solid fa-chart-pie"
            style={{ fontSize: 28, color: 'var(--text-muted)', opacity: 0.4 }}
          ></i>
          <p>Need at least 3 settled bets to calculate score</p>
        </div>
      </div>
    );
  }

  const { total } = breakdown;
  const tier = getScoreTier(total);
  const tips = getScoreTips(breakdown);
  const factors = [breakdown.roi, breakdown.wr, breakdown.dd, breakdown.stake];

  // SVG gauge arc (270 degrees)
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const offset = arcLength - (arcLength * total) / 100;

  return (
    <div className="analytics-score-section glass-panel" ref={containerRef}>
      <div className="score-layout">
        {/* Left: Gauge */}
        <div className="score-gauge-col">
          <div className="bet-score-gauge">
            <svg viewBox="0 0 120 120" className="score-ring">
              {/* Background arc */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="8"
                strokeDasharray={arcLength}
                strokeDashoffset="0"
                strokeLinecap="round"
                transform="rotate(135 60 60)"
              />
              {/* Filled arc */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={tier.color}
                strokeWidth="8"
                strokeDasharray={arcLength}
                strokeDashoffset={arcLength}
                strokeLinecap="round"
                transform="rotate(135 60 60)"
                className="score-ring-fill"
                data-target={offset}
              />
            </svg>
            <div className="score-center">
              <span className="score-number" style={{ color: tier.color }}>
                {total}
              </span>
            </div>
          </div>
          <div className="score-label" style={{ color: tier.color }}>
            {tier.text}
          </div>
        </div>

        {/* Right: Breakdown + Tips */}
        <div className="score-details-col">
          <h3 className="score-section-title">Score Breakdown</h3>
          <div className="score-factors">
            {factors.map((f, i) => {
              const barColor = subScoreColor(f.score);
              return (
                <div className="score-factor" key={i}>
                  <div className="score-factor-header">
                    <span className="score-factor-label">{f.label}</span>
                    <span className="score-factor-value" style={{ color: barColor }}>
                      {f.score}
                      <span style={{ fontSize: 10, opacity: 0.6 }}>/100</span>
                    </span>
                  </div>
                  <div className="score-factor-bar-bg">
                    <div
                      className="score-factor-bar"
                      data-width={`${f.score}%`}
                      style={{ width: `${f.score}%`, background: barColor }}
                    />
                  </div>
                  <span className="score-factor-weight">{f.weight}% weight</span>
                </div>
              );
            })}
          </div>

          <h3 className="score-section-title" style={{ marginTop: 20 }}>
            <i
              className="fa-solid fa-arrow-trend-up"
              style={{ color: 'var(--accent-gold)', marginRight: 6 }}
            ></i>
            How to Improve
          </h3>
          <div className="score-tips">
            {tips.map((t, i) => (
              <div className="score-tip" key={i}>
                <i className="fa-solid fa-lightbulb"></i>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
