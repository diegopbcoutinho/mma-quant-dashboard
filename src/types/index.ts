/**
 * MMA Quant — Core Type Definitions
 * Architecture: these types are shared across all data providers
 */

export interface Bet {
  id?: string;
  user_id?: string;
  date: string;
  event_name: string;
  fight_name: string;
  fighter: string;
  opponent: string;
  odds: number;
  stake_usd: number;
  stake_brl: number;
  result: 'W' | 'L' | '-' | '';
  pl_usd: number;
  bankroll_before: number;
  bankroll_after: number;
  roi: number;
  created_at?: string;
}

export interface Settings {
  id?: string;
  user_id?: string;
  initial_bankroll: number;
  unit_size: number;
  target_units: number;
  currency: string;
}

export interface Globals {
  bancaInicial: number;
  targetUnits: number;
  unitSize: number;
  dolarHoje: number;
}

export interface Analytics {
  roiByOdds: RoiBucket[];
  profitByEvent: EventProfit[];
  fighterStats: FighterStat[];
  streaks: {
    current: number;
    currentType: string | null;
    longestWin: number;
    longestLoss: number;
  };
  drawdown: {
    peak: number;
    maxDD: number;
    maxDDPct: number;
  };
  avgOdds: {
    win: number;
    loss: number;
  };
  bestRange: RoiBucket | null;
}

export interface RoiBucket {
  label: string;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
  roi: number;
}

export interface EventProfit {
  event: string;
  bets: number;
  wins: number;
  winRate: number;
  profit: number;
  roi: number;
}

export interface FighterStat {
  fighter: string;
  bets: number;
  wins: number;
  losses: number;
  winRate: number;
  profit: number;
  roi: number;
}
