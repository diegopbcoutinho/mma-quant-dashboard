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

// ── EVENT / FIGHTER PERFORMANCE CARD ────────────────────────────────────────

export interface EventCardFight {
  fight: string;
  odds: number;
  result: string;
  pl: number;
}

export interface EventCardData {
  name: string;
  mode: 'event' | 'fighter';
  wins: number;
  losses: number;
  profit: number;
  roi: number;
  winRate: number;
  fights: EventCardFight[];
}

/**
 * Build EventCardData from bets for a given event or fighter name.
 */
export function buildEventCardData(
  bets: { event_name: string; fighter: string; opponent: string; fight_name: string; result: string; pl_usd: number; stake_usd: number; odds: number }[],
  name: string,
  mode: 'event' | 'fighter'
): EventCardData | null {
  const settled = bets.filter(b => {
    if (b.result !== 'W' && b.result !== 'L') return false;
    return mode === 'event'
      ? b.event_name === name
      : (b.fighter === name || b.opponent === name);
  });
  if (settled.length === 0) return null;

  const wins = settled.filter(b => b.result === 'W').length;
  const losses = settled.filter(b => b.result === 'L').length;
  const profit = settled.reduce((s, b) => s + b.pl_usd, 0);
  const staked = settled.reduce((s, b) => s + b.stake_usd, 0);
  const roi = staked > 0 ? (profit / staked) * 100 : 0;
  const winRate = (wins / settled.length) * 100;

  const fights = [...settled].reverse().map(b => ({
    fight: b.fight_name || '--',
    odds: b.odds,
    result: b.result,
    pl: b.pl_usd,
  }));

  return { name, mode, wins, losses, profit, roi, winRate, fights };
}

/**
 * Generate a premium event/fighter performance card (1200x675, Twitter optimal).
 * Matches the style from the main branch card generator.
 */
export function generateEventCard(data: EventCardData): string {
  const W = 1200, H = 675;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Background ──
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0c0c10');
  grad.addColorStop(0.5, '#0a0a0e');
  grad.addColorStop(1, '#08080c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // FE watermark pattern
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.font = 'bold 80px "Inter", sans-serif';
  ctx.fillStyle = '#D4AF37';
  for (let y = -40; y < H + 80; y += 100) {
    for (let x = -40; x < W + 80; x += 160) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.25);
      ctx.fillText('FE', 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();

  // Top accent line
  const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
  accentGrad.addColorStop(0, 'rgba(212,175,55,0)');
  accentGrad.addColorStop(0.3, 'rgba(212,175,55,0.8)');
  accentGrad.addColorStop(0.7, 'rgba(212,175,55,0.8)');
  accentGrad.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, W, 4);

  // ── Logo text ──
  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 22px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('FIGHTEDGE', 40, 50);

  // ── Label ──
  ctx.font = '500 13px "Inter", sans-serif';
  ctx.fillStyle = '#888891';
  ctx.fillText(data.mode === 'event' ? 'MY PERFORMANCE AT' : 'MY RECORD BETTING ON', 40, 105);

  // ── Name ──
  ctx.font = 'bold 42px "Inter", sans-serif';
  ctx.fillStyle = '#ffffff';
  const displayName = data.name.length > 45 ? data.name.slice(0, 42) + '...' : data.name;
  ctx.fillText(displayName.toUpperCase(), 40, 155);

  // ── Divider ──
  ctx.fillStyle = 'rgba(212,175,55,0.3)';
  ctx.fillRect(40, 175, W - 80, 1);

  // ── Stats Grid ──
  const statsY = 220;
  const statBoxW = 180;
  const stats = [
    { label: 'RECORD', value: `${data.wins}W – ${data.losses}L`, color: '#ffffff' },
    { label: 'WIN RATE', value: `${data.winRate.toFixed(1)}%`, color: data.winRate >= 50 ? '#D4AF37' : '#E63946' },
    { label: 'ROI', value: `${data.roi >= 0 ? '+' : ''}${data.roi.toFixed(1)}%`, color: data.roi >= 0 ? '#D4AF37' : '#E63946' },
    { label: 'PROFIT', value: `${data.profit >= 0 ? '+' : ''}$${data.profit.toFixed(2)}`, color: data.profit >= 0 ? '#D4AF37' : '#E63946' },
  ];

  stats.forEach((s, i) => {
    const x = 40 + i * (statBoxW + 40);

    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    roundRect(ctx, x, statsY, statBoxW, 90, 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, statsY, statBoxW, 90, 10);
    ctx.stroke();

    ctx.font = '500 11px "Inter", sans-serif';
    ctx.fillStyle = '#888891';
    ctx.textAlign = 'left';
    ctx.fillText(s.label, x + 16, statsY + 28);

    ctx.font = 'bold 28px "Inter", sans-serif';
    ctx.fillStyle = s.color;
    ctx.fillText(s.value, x + 16, statsY + 65);
  });

  // ── Fight Results List ──
  const listY = 345;
  ctx.font = '500 12px "Inter", sans-serif';
  ctx.fillStyle = '#888891';
  ctx.textAlign = 'left';
  ctx.fillText('FIGHT RESULTS', 40, listY);

  const maxFights = Math.min(data.fights.length, 6);
  data.fights.slice(0, maxFights).forEach((f, i) => {
    const y = listY + 18 + i * 38;

    const badgeColor = f.result === 'W' ? '#D4AF37' : '#E63946';
    const badgeText = f.result === 'W' ? 'WIN' : 'LOSS';

    ctx.fillStyle = f.result === 'W' ? 'rgba(212,175,55,0.12)' : 'rgba(230,57,70,0.12)';
    roundRect(ctx, 40, y, 50, 24, 5);
    ctx.fill();

    ctx.font = 'bold 11px "Inter", sans-serif';
    ctx.fillStyle = badgeColor;
    ctx.textAlign = 'left';
    ctx.fillText(badgeText, 49, y + 16);

    ctx.font = '500 14px "Inter", sans-serif';
    ctx.fillStyle = '#cccccc';
    const fightText = f.fight.length > 40 ? f.fight.slice(0, 37) + '...' : f.fight;
    ctx.fillText(fightText, 105, y + 16);

    ctx.font = '400 13px "Inter", sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText(`@${f.odds.toFixed(2)}`, 600, y + 16);

    ctx.font = 'bold 14px "Inter", sans-serif';
    ctx.fillStyle = f.pl >= 0 ? '#D4AF37' : '#E63946';
    ctx.fillText(`${f.pl >= 0 ? '+' : ''}$${f.pl.toFixed(2)}`, 700, y + 16);
  });

  // ── Bottom bar ──
  ctx.fillStyle = 'rgba(212,175,55,0.08)';
  ctx.fillRect(0, H - 50, W, 50);
  ctx.fillStyle = 'rgba(212,175,55,0.2)';
  ctx.fillRect(0, H - 50, W, 1);

  ctx.font = 'bold 14px "Inter", sans-serif';
  ctx.fillStyle = '#D4AF37';
  ctx.textAlign = 'left';
  ctx.fillText('FIGHTEDGE', 40, H - 20);
  ctx.font = '400 12px "Inter", sans-serif';
  ctx.fillStyle = '#666';
  ctx.fillText('  ·  Build your fight edge.', 130, H - 20);

  ctx.font = '400 12px "Inter", sans-serif';
  ctx.fillStyle = '#555';
  ctx.textAlign = 'right';
  ctx.fillText(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), W - 40, H - 20);

  // Bottom accent
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, H - 3, W, 3);

  return canvas.toDataURL('image/png');
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
