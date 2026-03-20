/**
 * Share Card Generator — Canvas-based social card for FightEdge
 *
 * Generates a 1200x630 (Twitter/OG standard) PNG image with:
 *   - FightEdge branding
 *   - FightEdge Score gauge
 *   - Key metrics: ROI, Profit, Win Rate, Record
 *   - Score tier label
 *   - Dark premium aesthetic matching the app UI
 *
 * Uses the Canvas API — runs client-side only.
 */

import type { ScoreBreakdown } from './scoreEngine';
import { getScoreTier } from './scoreEngine';

export interface ShareCardData {
  score: number;
  breakdown: ScoreBreakdown;
  roi: number;
  profit: number;
  winRate: number;
  wins: number;
  losses: number;
  totalBets: number;
  currentBankroll: number;
  username?: string;
}

/**
 * Generate a premium share card image as a data URL.
 * Returns a PNG base64 data URL ready for download or upload.
 */
export function generateShareCard(data: ShareCardData): string {
  const W = 1200;
  const H = 630;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Background ──────────────────────────────────────
  // Dark gradient matching app theme
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#0a0a0c');
  bgGrad.addColorStop(0.5, '#0f0f12');
  bgGrad.addColorStop(1, '#0a0a0c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid pattern
  ctx.strokeStyle = 'rgba(212,175,55,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Top accent line
  const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
  accentGrad.addColorStop(0, 'rgba(212,175,55,0)');
  accentGrad.addColorStop(0.3, 'rgba(212,175,55,0.8)');
  accentGrad.addColorStop(0.7, 'rgba(212,175,55,0.8)');
  accentGrad.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, W, 3);

  // ── FightEdge Logo Text ─────────────────────────────
  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 28px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('FIGHTEDGE', 50, 55);

  // Tagline
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '14px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('Build your fight edge.', 50, 78);

  // ── Score Gauge (center-left) ───────────────────────
  const gaugeX = 240;
  const gaugeY = 320;
  const gaugeR = 130;
  const tier = getScoreTier(data.score);

  // Gauge background ring
  ctx.beginPath();
  ctx.arc(gaugeX, gaugeY, gaugeR, Math.PI * 0.75, Math.PI * 2.25);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Gauge progress ring
  const progress = data.score / 100;
  const startAngle = Math.PI * 0.75;
  const endAngle = startAngle + progress * Math.PI * 1.5;

  const gaugeGrad = ctx.createLinearGradient(
    gaugeX - gaugeR, gaugeY,
    gaugeX + gaugeR, gaugeY
  );
  gaugeGrad.addColorStop(0, '#E63946');
  gaugeGrad.addColorStop(0.4, '#FF9800');
  gaugeGrad.addColorStop(0.7, '#4CAF50');
  gaugeGrad.addColorStop(1, '#D4AF37');

  ctx.beginPath();
  ctx.arc(gaugeX, gaugeY, gaugeR, startAngle, endAngle);
  ctx.strokeStyle = gaugeGrad;
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Score number
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 72px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(data.score), gaugeX, gaugeY + 20);

  // Score label
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '14px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('FIGHTEDGE SCORE', gaugeX, gaugeY - 50);

  // Tier label
  ctx.fillStyle = tier.color;
  ctx.font = 'bold 18px "Inter", "Segoe UI", sans-serif';
  ctx.fillText(tier.text, gaugeX, gaugeY + 55);

  // ── Metrics Panel (right side) ──────────────────────
  const metricsX = 520;
  const metricsY = 140;
  const colW = 310;

  const metricsData = [
    {
      label: 'ROI',
      value: `${data.roi >= 0 ? '+' : ''}${data.roi.toFixed(2)}%`,
      color: data.roi >= 0 ? '#D4AF37' : '#E63946',
    },
    {
      label: 'PROFIT',
      value: `${data.profit >= 0 ? '+' : ''}$${Math.abs(data.profit).toFixed(2)}`,
      color: data.profit >= 0 ? '#D4AF37' : '#E63946',
    },
    {
      label: 'WIN RATE',
      value: `${data.winRate.toFixed(1)}%`,
      color: '#FFFFFF',
    },
    {
      label: 'RECORD',
      value: `${data.wins}W — ${data.losses}L`,
      color: '#FFFFFF',
    },
  ];

  // Draw metrics in 2x2 grid
  metricsData.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = metricsX + col * colW;
    const y = metricsY + row * 140;

    // Card background
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    roundRect(ctx, x, y, colW - 20, 120, 12);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, colW - 20, 120, 12);
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '13px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(m.label, x + 20, y + 35);

    // Value
    ctx.fillStyle = m.color;
    ctx.font = 'bold 36px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(m.value, x + 20, y + 85);
  });

  // ── Sub-scores bar ──────────────────────────────────
  const barY = 470;
  const bars = [
    { label: 'ROI', score: data.breakdown.roi.score, color: '#D4AF37' },
    { label: 'Win Rate', score: data.breakdown.wr.score, color: '#4CAF50' },
    { label: 'Drawdown', score: data.breakdown.dd.score, color: '#FF9800' },
    { label: 'Discipline', score: data.breakdown.stake.score, color: '#E63946' },
  ];

  const barStartX = 520;
  const barW = 580;
  const barSpacing = barW / bars.length;

  bars.forEach((bar, i) => {
    const x = barStartX + i * barSpacing;

    // Mini bar background
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, x, barY + 20, barSpacing - 15, 8, 4);
    ctx.fill();

    // Mini bar fill
    ctx.fillStyle = bar.color;
    const fillW = ((barSpacing - 15) * bar.score) / 100;
    roundRect(ctx, x, barY + 20, Math.max(fillW, 4), 8, 4);
    ctx.fill();

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(bar.label, x, barY + 12);

    // Score text
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 11px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(bar.score), x + barSpacing - 15, barY + 12);
  });

  // ── Footer ──────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '13px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('fightedge.app', 50, H - 30);

  // Date
  ctx.textAlign = 'right';
  ctx.fillText(new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  }), W - 50, H - 30);

  // Bottom accent line
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, H - 3, W, 3);

  return canvas.toDataURL('image/png');
}

/**
 * Download the share card as a PNG file.
 */
export function downloadShareCard(dataUrl: string, filename?: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename || `fightedge-score-${new Date().toISOString().slice(0, 10)}.png`;
  a.click();
}

/**
 * Convert data URL to Blob for database storage.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const raw = atob(parts[1]);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Helper: draw rounded rectangle path */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
