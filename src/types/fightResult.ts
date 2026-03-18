/**
 * FightEdge — Fight Results Types
 *
 * Architecture: these types support the grading engine.
 * fight_results table stores verified fight outcomes.
 * The grading engine matches pending bets against these results.
 */

export interface FightResult {
  fight_id: string;
  event_id: string;
  event_name: string;
  fighter_a: string;
  fighter_b: string;
  winner: string;
  method: string;        // e.g. "KO/TKO", "Decision", "Submission"
  end_round: number;
  end_time: string;
  is_completed: boolean;
  updated_at?: string;
}

export interface GradingResult {
  betId: string;
  newResult: 'W' | 'L';
  matchedFight: string;
  reason: string;        // Human-readable explanation
}

export interface GradingSummary {
  totalChecked: number;
  totalGraded: number;
  results: GradingResult[];
}
