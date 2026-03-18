/**
 * FightEdge Score Engine
 *
 * Calculates a 0-100 performance score based on weighted factors:
 *   ROI        → 35%  (profitability)
 *   Win Rate   → 25%  (consistency)
 *   Drawdown   → 25%  (risk control)
 *   Stake Disc → 15%  (betting discipline)
 *
 * Each sub-score is normalised to 0-100, then combined by weight.
 * Pure function — no side effects, no database calls.
 */

import type { Bet, Settings } from '@/types';

export interface ScoreBreakdown {
  total: number;
  roi:   { score: number; weight: number; raw: number; label: string };
  wr:    { score: number; weight: number; raw: number; label: string };
  dd:    { score: number; weight: number; raw: number; label: string };
  stake: { score: number; weight: number; raw: number; label: string };
}

/**
 * Main scoring function.
 * Returns null if fewer than 3 settled bets (not enough data).
 */
export function calculateFightEdgeScore(
  bets: Bet[],
  settings: Settings | null
): ScoreBreakdown | null {
  const settled = bets.filter((b) => b.result === 'W' || b.result === 'L');
  if (settled.length < 3) return null;

  const initialBankroll = settings?.initial_bankroll ?? 500;

  const wins = settled.filter((b) => b.result === 'W').length;
  const winRate = wins / settled.length;

  // ROI
  const totalStaked = settled.reduce((s, b) => s + b.stake_usd, 0);
  const totalProfit = settled.reduce((s, b) => s + b.pl_usd, 0);
  const roi = totalStaked > 0 ? totalProfit / totalStaked : 0;

  // Max drawdown from bankroll timeline
  const chrono = [...settled].sort((a, b) => {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
    return da - db;
  });

  let bankroll = initialBankroll;
  let peak = initialBankroll;
  let maxDDPct = 0;

  for (const bet of chrono) {
    bankroll += bet.pl_usd;
    if (bankroll > peak) peak = bankroll;
    const dd = peak > 0 ? (peak - bankroll) / peak : 0;
    if (dd > maxDDPct) maxDDPct = dd;
  }

  // Stake discipline — coefficient of variation (lower = more consistent)
  const stakes = settled.map((b) => b.stake_usd).filter((s) => s > 0);
  const avgStake = stakes.reduce((a, b) => a + b, 0) / stakes.length;
  const stakeStdDev = Math.sqrt(
    stakes.reduce((s, v) => s + (v - avgStake) ** 2, 0) / stakes.length
  );
  const stakeCV = avgStake > 0 ? stakeStdDev / avgStake : 1;

  // Sub-scores (0-100)
  // ROI: 0% → 50,  +20% → 100,  -20% → 0
  const roiScore = clamp(50 + roi * 250);

  // Winrate: 40% → 0,  50% → 40,  65% → 100
  const wrScore = clamp(((winRate - 0.40) / 0.25) * 100);

  // Drawdown: 0% → 100,  50%+ → 0
  const ddScore = clamp((1 - maxDDPct * 2) * 100);

  // Stake discipline: CV 0 → 100, CV >= 1 → 0
  const stakeScore = clamp((1 - stakeCV) * 100);

  const total = Math.round(
    roiScore * 0.35 +
    wrScore * 0.25 +
    ddScore * 0.25 +
    stakeScore * 0.15
  );

  return {
    total: clamp(total),
    roi:   { score: Math.round(roiScore),   weight: 35, raw: roi * 100,       label: 'ROI' },
    wr:    { score: Math.round(wrScore),    weight: 25, raw: winRate * 100,    label: 'Win Rate' },
    dd:    { score: Math.round(ddScore),    weight: 25, raw: maxDDPct * 100,   label: 'Drawdown Control' },
    stake: { score: Math.round(stakeScore), weight: 15, raw: stakeCV * 100,    label: 'Stake Discipline' },
  };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/**
 * Returns the score tier label and color.
 */
export function getScoreTier(score: number): { text: string; color: string } {
  if (score >= 85) return { text: 'Elite Level',     color: '#D4AF37' };
  if (score >= 70) return { text: 'Skilled Bettor',  color: '#4CAF50' };
  if (score >= 40) return { text: 'Developing Edge', color: '#FF9800' };
  return             { text: 'Undisciplined',    color: '#E63946' };
}

/**
 * Returns 1-2 actionable improvement tips based on weakest sub-scores.
 */
export function getScoreTips(breakdown: ScoreBreakdown): string[] {
  const items = [
    { key: 'roi',   ...breakdown.roi },
    { key: 'wr',    ...breakdown.wr },
    { key: 'dd',    ...breakdown.dd },
    { key: 'stake', ...breakdown.stake },
  ].sort((a, b) => a.score - b.score);

  const tips: string[] = [];
  for (const item of items) {
    if (tips.length >= 2) break;
    if (item.score >= 75) continue;

    if (item.key === 'roi') {
      if (item.raw < 0) tips.push('Your ROI is negative. Consider being more selective — focus on odds ranges where you historically perform best.');
      else tips.push('Your ROI is positive but modest. Look for higher-value spots or reduce stake on lower-confidence picks.');
    }
    if (item.key === 'wr') {
      if (item.raw < 45) tips.push('Win rate is below 45%. Review your selection process — are you betting too many underdogs without edge?');
      else tips.push('Win rate has room to grow. Try narrowing your focus to fight styles and matchups you understand deeply.');
    }
    if (item.key === 'dd') {
      tips.push(`Max drawdown hit ${item.raw.toFixed(1)}%. Consider reducing stake size during losing streaks to protect your bankroll.`);
    }
    if (item.key === 'stake') {
      tips.push('Your stake sizes vary a lot. A more consistent unit-based staking strategy reduces variance and improves long-term results.');
    }
  }

  if (tips.length === 0) tips.push('Strong performance across all metrics. Stay disciplined and keep tracking.');
  return tips;
}

export function subScoreColor(score: number): string {
  if (score >= 75) return '#4CAF50';
  if (score >= 50) return '#FF9800';
  return '#E63946';
}
