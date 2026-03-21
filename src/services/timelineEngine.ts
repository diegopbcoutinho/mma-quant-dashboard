/**
 * Timeline Engine — Time-based performance analysis
 *
 * Groups settled bets by day/week/month to produce PnL time series.
 * Also calculates session stats (today) and daily streaks.
 * All calculations are pure functions — no side effects, no DB calls.
 */

import type { Bet } from '@/types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PnLEntry {
  label: string;       // date label for display
  date: string;        // ISO date key (YYYY-MM-DD or YYYY-WXX or YYYY-MM)
  profit: number;
  bets: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface SessionStats {
  weekPL: number;
  weekBets: number;
  weekWins: number;
  weekLosses: number;
  weekWinRate: number;
}

export interface StreakInfo {
  count: number;
  type: 'win' | 'loss' | null;
}

export type Timeframe = 'daily' | 'weekly' | 'monthly';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Get only settled bets sorted by date ascending */
function getSettledSorted(bets: Bet[]): Bet[] {
  return bets
    .filter((b) => b.result === 'W' || b.result === 'L')
    .sort((a, b) => {
      const da = a.created_at || a.date || '';
      const db = b.created_at || b.date || '';
      return da.localeCompare(db);
    });
}

/** Parse a bet's date into a Date object */
function parseBetDate(bet: Bet): Date {
  // Try created_at first (ISO timestamp), then date field (MM/DD/YYYY)
  if (bet.created_at) {
    return new Date(bet.created_at);
  }
  if (bet.date) {
    // Handle various date formats
    const parts = bet.date.split('/');
    if (parts.length === 3) {
      // MM/DD/YYYY or DD/MM/YYYY — assume en-US format
      return new Date(bet.date);
    }
    return new Date(bet.date);
  }
  return new Date();
}

/** Get YYYY-MM-DD key from date */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Get ISO week key: YYYY-WXX */
function weekKey(d: Date): string {
  const year = d.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Get month key: YYYY-MM */
function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** Format date label for display */
function formatLabel(key: string, timeframe: Timeframe): string {
  if (timeframe === 'daily') {
    const d = new Date(key + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (timeframe === 'weekly') {
    return key; // "2026-W12"
  }
  // monthly
  const d = new Date(key + '-15');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ── Main Functions ──────────────────────────────────────────────────────────

/**
 * Group bets by timeframe and compute PnL per period.
 */
export function getPnLTimeline(bets: Bet[], timeframe: Timeframe): PnLEntry[] {
  const settled = getSettledSorted(bets);
  if (settled.length === 0) return [];

  const keyFn = timeframe === 'daily' ? dayKey
    : timeframe === 'weekly' ? weekKey
    : monthKey;

  const groups = new Map<string, { profit: number; bets: number; wins: number; losses: number }>();

  for (const bet of settled) {
    const d = parseBetDate(bet);
    const key = keyFn(d);

    if (!groups.has(key)) {
      groups.set(key, { profit: 0, bets: 0, wins: 0, losses: 0 });
    }
    const g = groups.get(key)!;
    g.profit += bet.pl_usd;
    g.bets += 1;
    if (bet.result === 'W') g.wins += 1;
    else g.losses += 1;
  }

  // Sort by key (chronological)
  const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return sorted.map(([key, g]) => ({
    label: formatLabel(key, timeframe),
    date: key,
    profit: g.profit,
    bets: g.bets,
    wins: g.wins,
    losses: g.losses,
    winRate: g.bets > 0 ? (g.wins / g.bets) * 100 : 0,
  }));
}

/**
 * Get current week's session stats from settled bets.
 * Uses ISO week (Mon-Sun) to align with weekly fight cards.
 */
export function getSessionStats(bets: Bet[]): SessionStats {
  const now = new Date();
  const currentWeek = weekKey(now);
  const settled = bets.filter((b) => {
    if (b.result !== 'W' && b.result !== 'L') return false;
    const d = parseBetDate(b);
    return weekKey(d) === currentWeek;
  });

  const wins = settled.filter((b) => b.result === 'W').length;
  const losses = settled.filter((b) => b.result === 'L').length;
  const total = settled.length;
  const profit = settled.reduce((sum, b) => sum + b.pl_usd, 0);

  return {
    weekPL: profit,
    weekBets: total,
    weekWins: wins,
    weekLosses: losses,
    weekWinRate: total > 0 ? (wins / total) * 100 : 0,
  };
}

/**
 * Calculate daily streak (consecutive profitable/unprofitable days).
 * Iterates from most recent day backwards.
 */
export function getDailyStreak(bets: Bet[]): StreakInfo {
  const daily = getPnLTimeline(bets, 'daily');
  if (daily.length === 0) return { count: 0, type: null };

  // Start from the most recent day
  const last = daily[daily.length - 1];
  const streakType: 'win' | 'loss' = last.profit >= 0 ? 'win' : 'loss';
  let count = 0;

  for (let i = daily.length - 1; i >= 0; i--) {
    const isPositive = daily[i].profit >= 0;
    if ((streakType === 'win' && isPositive) || (streakType === 'loss' && !isPositive)) {
      count++;
    } else {
      break;
    }
  }

  return { count, type: streakType };
}
