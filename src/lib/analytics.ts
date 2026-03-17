/**
 * FightEdge — Performance Analytics Engine
 * Ported from performanceAnalytics.js — pure computation, no DOM.
 */

import type { Bet, Analytics, RoiBucket, EventProfit, FighterStat } from '@/types';

function pickedFighter(fight: string): string | null {
  if (!fight) return null;
  const vsIdx = fight.toLowerCase().indexOf(' vs ');
  return vsIdx > 0 ? fight.slice(0, vsIdx).trim() : fight.trim();
}

export function computeAnalytics(bets: Bet[]): Analytics | null {
  const settled = [...bets]
    .filter(b => b.result === 'W' || b.result === 'L')
    .reverse(); // chronological order

  if (settled.length === 0) return null;

  // 1. ROI by odds range
  const buckets = [
    { label: '1.00 – 1.40', min: 1.00, max: 1.40 },
    { label: '1.41 – 1.80', min: 1.41, max: 1.80 },
    { label: '1.81 – 2.50', min: 1.81, max: 2.50 },
    { label: '2.51+', min: 2.51, max: Infinity },
  ];

  const roiByOdds: RoiBucket[] = buckets.map(b => {
    const items = settled.filter(s => s.odds >= b.min && s.odds <= b.max);
    const wins = items.filter(s => s.result === 'W').length;
    const stake = items.reduce((acc, x) => acc + x.stake_usd, 0);
    const profit = items.reduce((acc, x) => acc + x.pl_usd, 0);
    return {
      label: b.label,
      count: items.length,
      wins,
      losses: items.length - wins,
      winRate: items.length > 0 ? (wins / items.length) * 100 : 0,
      totalProfit: profit,
      roi: stake > 0 ? (profit / stake) * 100 : 0,
    };
  });

  // 2. Profit by event
  const eventMap: Record<string, { bets: number; wins: number; stake: number; profit: number }> = {};
  settled.forEach(b => {
    const key = b.event_name || 'Unknown';
    if (!eventMap[key]) eventMap[key] = { bets: 0, wins: 0, stake: 0, profit: 0 };
    eventMap[key].bets++;
    if (b.result === 'W') eventMap[key].wins++;
    eventMap[key].stake += b.stake_usd;
    eventMap[key].profit += b.pl_usd;
  });

  const profitByEvent: EventProfit[] = Object.entries(eventMap)
    .map(([event, d]) => ({
      event,
      bets: d.bets,
      wins: d.wins,
      winRate: (d.wins / d.bets) * 100,
      profit: d.profit,
      roi: d.stake > 0 ? (d.profit / d.stake) * 100 : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  // 3. Profit by fighter
  const fighterMap: Record<string, { bets: number; wins: number; stake: number; profit: number }> = {};
  settled.forEach(b => {
    const fighter = pickedFighter(b.fight_name);
    if (!fighter) return;
    if (!fighterMap[fighter]) fighterMap[fighter] = { bets: 0, wins: 0, stake: 0, profit: 0 };
    fighterMap[fighter].bets++;
    if (b.result === 'W') fighterMap[fighter].wins++;
    fighterMap[fighter].stake += b.stake_usd;
    fighterMap[fighter].profit += b.pl_usd;
  });

  const fighterStats: FighterStat[] = Object.entries(fighterMap)
    .map(([fighter, d]) => ({
      fighter,
      bets: d.bets,
      wins: d.wins,
      losses: d.bets - d.wins,
      winRate: (d.wins / d.bets) * 100,
      profit: d.profit,
      roi: d.stake > 0 ? (d.profit / d.stake) * 100 : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  // 4. Streaks
  let longestWin = 0, longestLoss = 0, tmpW = 0, tmpL = 0;
  settled.forEach(b => {
    if (b.result === 'W') { tmpW++; tmpL = 0; longestWin = Math.max(longestWin, tmpW); }
    else { tmpL++; tmpW = 0; longestLoss = Math.max(longestLoss, tmpL); }
  });

  let curStreak = 0, curType: string | null = null;
  for (const b of [...settled].reverse()) {
    if (!curType) { curType = b.result; curStreak = 1; }
    else if (b.result === curType) curStreak++;
    else break;
  }

  // 5. Max drawdown
  let peak = 0, maxDD = 0, maxDDPct = 0;
  settled.filter(b => b.bankroll_after > 0).forEach(b => {
    if (b.bankroll_after > peak) peak = b.bankroll_after;
    const dd = peak - b.bankroll_after;
    if (dd > maxDD) { maxDD = dd; maxDDPct = (dd / peak) * 100; }
  });

  // 6. Avg odds W vs L
  const winBets = settled.filter(b => b.result === 'W');
  const lossBets = settled.filter(b => b.result === 'L');
  const avgOddsWin = winBets.length ? winBets.reduce((s, b) => s + b.odds, 0) / winBets.length : 0;
  const avgOddsLoss = lossBets.length ? lossBets.reduce((s, b) => s + b.odds, 0) / lossBets.length : 0;

  const bestRange = [...roiByOdds]
    .filter(b => b.count > 0)
    .sort((a, b) => b.roi - a.roi)[0] || null;

  return {
    roiByOdds,
    profitByEvent,
    fighterStats,
    streaks: { current: curStreak, currentType: curType, longestWin, longestLoss },
    drawdown: { peak, maxDD, maxDDPct },
    avgOdds: { win: avgOddsWin, loss: avgOddsLoss },
    bestRange,
  };
}
