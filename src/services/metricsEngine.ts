/**
 * Metrics Engine — Central metrics calculation layer
 *
 * Architecture: Pure function that computes ALL dashboard KPI values.
 * Uses BankrollEngine's timeline for drawdown and bankroll-based metrics.
 *
 * This is the SINGLE SOURCE OF TRUTH for all KPIs displayed on the dashboard.
 * All dashboard cards, analytics, and summary sections must consume from here.
 *
 * Formulas:
 *   ROI = totalProfit / totalRisked * 100 (NOT profit / bankroll)
 *   winRate = wins / totalBets * 100
 *   maxDrawdown = largest peak-to-trough drop in bankroll timeline
 *   streaks = consecutive W or L in chronological order
 */

import type { Bet, Settings } from '@/types';
import { calculateBankrollTimeline, type BankrollTimeline } from './bankrollEngine';

export interface Metrics {
  // Core KPIs
  totalProfit: number;
  totalRisked: number;
  roi: number;           // totalProfit / totalRisked * 100
  winRate: number;       // wins / totalBets * 100
  currentBankroll: number;

  // Counts
  totalBets: number;
  wins: number;
  losses: number;
  pendingBets: number;

  // Risk metrics
  maxDrawdown: number;      // absolute USD value
  maxDrawdownPct: number;   // percentage of peak
  drawdownPeak: number;     // bankroll value at which max drawdown started

  // Streaks (chronological)
  bestWinStreak: number;
  worstLossStreak: number;
  currentStreak: number;
  currentStreakType: 'W' | 'L' | null;

  // Average odds
  avgOddsWin: number;
  avgOddsLoss: number;

  // Bankroll timeline (for charts)
  timeline: BankrollTimeline;
}

export function calculateMetrics(
  bets: Bet[],
  settings: Settings | null
): Metrics {
  const initialBankroll = settings?.initial_bankroll ?? 500;

  // Build bankroll timeline using the engine
  const timeline = calculateBankrollTimeline(bets, initialBankroll);

  // Filter settled bets in chronological order (W/L only for stats, C excluded)
  const settled = [...bets]
    .filter((b) => b.result === 'W' || b.result === 'L')
    .sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });

  const wins = settled.filter((b) => b.result === 'W').length;
  const losses = settled.filter((b) => b.result === 'L').length;
  const cancelled = bets.filter((b) => b.result === 'C').length;
  const totalBets = settled.length; // W+L only (cancelled excluded from win rate)
  const pendingBets = bets.filter((b) => b.result === '-').length + cancelled;

  // ROI = totalProfit / totalRisked (NOT initial bankroll)
  const roi = timeline.totalRisked > 0
    ? (timeline.totalProfit / timeline.totalRisked) * 100
    : 0;

  const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;

  // --- Max Drawdown ---
  // Uses bankroll timeline to find largest peak-to-trough decline
  let peak = initialBankroll;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  let drawdownPeak = initialBankroll;

  for (const entry of timeline.entries) {
    if (entry.bankrollAfter > peak) {
      peak = entry.bankrollAfter;
    }
    const dd = peak - entry.bankrollAfter;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      maxDrawdownPct = peak > 0 ? (dd / peak) * 100 : 0;
      drawdownPeak = peak;
    }
  }

  // --- Streaks (chronological order) ---
  let bestWinStreak = 0;
  let worstLossStreak = 0;
  let tmpW = 0;
  let tmpL = 0;

  for (const b of settled) {
    if (b.result === 'W') {
      tmpW++;
      tmpL = 0;
      bestWinStreak = Math.max(bestWinStreak, tmpW);
    } else {
      tmpL++;
      tmpW = 0;
      worstLossStreak = Math.max(worstLossStreak, tmpL);
    }
  }

  // Current streak (from most recent bet backwards)
  let currentStreak = 0;
  let currentStreakType: 'W' | 'L' | null = null;
  for (let i = settled.length - 1; i >= 0; i--) {
    const r = settled[i].result as 'W' | 'L';
    if (!currentStreakType) {
      currentStreakType = r;
      currentStreak = 1;
    } else if (r === currentStreakType) {
      currentStreak++;
    } else {
      break;
    }
  }

  // --- Average Odds ---
  const winBets = settled.filter((b) => b.result === 'W');
  const lossBets = settled.filter((b) => b.result === 'L');
  const avgOddsWin = winBets.length > 0
    ? winBets.reduce((s, b) => s + b.odds, 0) / winBets.length
    : 0;
  const avgOddsLoss = lossBets.length > 0
    ? lossBets.reduce((s, b) => s + b.odds, 0) / lossBets.length
    : 0;

  return {
    totalProfit: timeline.totalProfit,
    totalRisked: timeline.totalRisked,
    roi,
    winRate,
    currentBankroll: timeline.currentBankroll,
    totalBets,
    wins,
    losses,
    pendingBets,
    maxDrawdown,
    maxDrawdownPct,
    drawdownPeak,
    bestWinStreak,
    worstLossStreak,
    currentStreak,
    currentStreakType,
    avgOddsWin,
    avgOddsLoss,
    timeline,
  };
}
