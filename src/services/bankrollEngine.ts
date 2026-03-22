/**
 * Bankroll Engine — Deterministic bankroll timeline calculation
 *
 * Architecture: Pure function that takes bets + initial bankroll and
 * produces a chronological timeline of bankroll progression.
 *
 * Rules:
 *   - Bets sorted by created_at ascending (oldest first)
 *   - Only settled bets (W/L) affect bankroll
 *   - bankroll_after = running total after each bet's P/L
 *   - cumulative_profit tracks total gains/losses from start
 *
 * This is the SINGLE SOURCE OF TRUTH for bankroll values.
 * No other module should calculate bankroll independently.
 */

import type { Bet } from '@/types';

export interface BankrollEntry {
  betId: string;
  bankrollBefore: number;
  bankrollAfter: number;
  cumulativeProfit: number;
  plUsd: number;
}

export interface BankrollTimeline {
  entries: BankrollEntry[];
  currentBankroll: number;
  totalProfit: number;
  totalRisked: number;
}

export function calculateBankrollTimeline(
  bets: Bet[],
  initialBankroll: number
): BankrollTimeline {
  // Sort settled bets chronologically (oldest first)
  // Include C (cancelled) with pl=0 so timeline stays complete
  const settled = [...bets]
    .filter((b) => b.result === 'W' || b.result === 'L' || b.result === 'C')
    .sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });

  let runningBankroll = initialBankroll;
  let cumulativeProfit = 0;
  let totalRisked = 0;

  const entries: BankrollEntry[] = settled.map((bet) => {
    const bankrollBefore = runningBankroll;

    // P/L calculation: W = stake * (odds - 1), L = -stake, C = 0
    const plUsd =
      bet.result === 'W'
        ? bet.stake_usd * (bet.odds - 1)
        : bet.result === 'C'
          ? 0
          : -bet.stake_usd;

    runningBankroll += plUsd;
    cumulativeProfit += plUsd;
    totalRisked += bet.stake_usd;

    return {
      betId: bet.id || '',
      bankrollBefore,
      bankrollAfter: runningBankroll,
      cumulativeProfit,
      plUsd,
    };
  });

  return {
    entries,
    currentBankroll: runningBankroll,
    totalProfit: cumulativeProfit,
    totalRisked,
  };
}
