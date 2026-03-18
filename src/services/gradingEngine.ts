/**
 * Grading Engine — Automatic Bet Result Verification
 *
 * Architecture:
 *   1. User clicks "Check Fight Results"
 *   2. Engine fetches all pending bets for the user
 *   3. Looks up fight_results table for completed fights
 *   4. Matches bets to results using fighter name matching
 *   5. Grades each bet as WIN or LOSS
 *   6. Updates bet records in database
 *
 * Matching Strategy:
 *   - Normalize fighter names (lowercase, trim)
 *   - Match bet.fighter against fight_result.winner
 *   - Uses fuzzy matching: checks if fighter name is contained in winner name
 *     (handles "Oliveira" matching "Charles Oliveira")
 *
 * Future-ready for:
 *   - External MMA results API integration
 *   - Background auto-checking (scheduled jobs)
 *   - Real-time grading via webhooks
 */

import { supabase } from '@/lib/supabaseClient';
import type { Bet } from '@/types';
import type { FightResult, GradingResult, GradingSummary } from '@/types/fightResult';

/**
 * Normalize a fighter name for matching.
 * Strips whitespace, lowercases, removes common prefixes/suffixes.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, '') // remove special chars
    .replace(/\s+/g, ' ');    // normalize spaces
}

/**
 * Check if two fighter names match.
 * Uses containment check to handle partial names.
 * e.g. "Oliveira" matches "Charles Oliveira"
 */
function fighterNamesMatch(betFighter: string, resultFighter: string): boolean {
  const a = normalizeName(betFighter);
  const b = normalizeName(resultFighter);

  if (!a || !b) return false;

  // Exact match
  if (a === b) return true;

  // Containment: either name contains the other
  if (b.includes(a) || a.includes(b)) return true;

  // Last name match: compare last words
  const aLast = a.split(' ').pop() || '';
  const bLast = b.split(' ').pop() || '';
  if (aLast.length >= 3 && aLast === bLast) return true;

  return false;
}

/**
 * Find a matching fight result for a given bet.
 * Searches by event name similarity and fighter names.
 */
function findMatchingResult(bet: Bet, results: FightResult[]): FightResult | null {
  for (const result of results) {
    if (!result.is_completed) continue;

    // Check if fighters match (bet fighter is in this fight)
    const betFighter = bet.fighter || '';
    const betOpponent = bet.opponent || '';
    const fightName = bet.fight_name || '';

    // Strategy 1: Direct fighter field match
    if (betFighter) {
      const matchesA = fighterNamesMatch(betFighter, result.fighter_a);
      const matchesB = fighterNamesMatch(betFighter, result.fighter_b);
      if (matchesA || matchesB) return result;
    }

    // Strategy 2: Check fight_name contains both fighters from result
    if (fightName) {
      const fightLower = normalizeName(fightName);
      const aLast = normalizeName(result.fighter_a).split(' ').pop() || '';
      const bLast = normalizeName(result.fighter_b).split(' ').pop() || '';

      if (aLast.length >= 3 && bLast.length >= 3 &&
          fightLower.includes(aLast) && fightLower.includes(bLast)) {
        return result;
      }
    }
  }

  return null;
}

/**
 * Grade a single bet against a fight result.
 * Returns the grading result with WIN/LOSS determination.
 */
function gradeBet(bet: Bet, result: FightResult): GradingResult | null {
  const betFighter = bet.fighter || '';

  if (!betFighter) {
    // Can't grade without knowing who was bet on
    return null;
  }

  // Check if the bet fighter is the winner
  const isWinner = fighterNamesMatch(betFighter, result.winner);

  return {
    betId: bet.id!,
    newResult: isWinner ? 'W' : 'L',
    matchedFight: `${result.fighter_a} vs ${result.fighter_b}`,
    reason: isWinner
      ? `${betFighter} won by ${result.method} in round ${result.end_round}`
      : `${betFighter} lost — ${result.winner} won by ${result.method}`,
  };
}

/**
 * Main grading function.
 * Checks all pending bets and grades them against available fight results.
 *
 * @param userId - The authenticated user's ID
 * @returns GradingSummary with all grading results
 */
export async function checkAndGradePendingBets(userId: string): Promise<GradingSummary> {
  // 1. Fetch all pending bets for this user
  const { data: pendingBets, error: betsError } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .eq('result', '-');

  if (betsError) throw new Error(`Failed to fetch bets: ${betsError.message}`);
  if (!pendingBets || pendingBets.length === 0) {
    return { totalChecked: 0, totalGraded: 0, results: [] };
  }

  // 2. Fetch all completed fight results
  const { data: fightResults, error: resultsError } = await supabase
    .from('fight_results')
    .select('*')
    .eq('is_completed', true);

  if (resultsError) throw new Error(`Failed to fetch results: ${resultsError.message}`);
  if (!fightResults || fightResults.length === 0) {
    return { totalChecked: pendingBets.length, totalGraded: 0, results: [] };
  }

  // 3. Grade each pending bet
  const gradingResults: GradingResult[] = [];

  for (const bet of pendingBets as Bet[]) {
    const matchedResult = findMatchingResult(bet, fightResults as FightResult[]);
    if (!matchedResult) continue;

    const grading = gradeBet(bet, matchedResult);
    if (!grading) continue;

    // 4. Update the bet in database
    const plUsd = grading.newResult === 'W'
      ? bet.stake_usd * (bet.odds - 1)
      : -bet.stake_usd;

    const { error: updateError } = await supabase
      .from('bets')
      .update({
        result: grading.newResult,
        pl_usd: plUsd,
        graded_at: new Date().toISOString(),
      })
      .eq('id', bet.id);

    if (!updateError) {
      gradingResults.push(grading);
    }
  }

  return {
    totalChecked: pendingBets.length,
    totalGraded: gradingResults.length,
    results: gradingResults,
  };
}

/**
 * Insert or update fight results manually.
 * This is the admin/user input path — later can be replaced by API.
 */
export async function upsertFightResult(result: FightResult): Promise<void> {
  const { error } = await supabase
    .from('fight_results')
    .upsert(result, { onConflict: 'fight_id' });

  if (error) throw new Error(`Failed to save fight result: ${error.message}`);
}

/**
 * Fetch all fight results (for display/management).
 */
export async function getFightResults(): Promise<FightResult[]> {
  const { data, error } = await supabase
    .from('fight_results')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch results: ${error.message}`);
  return (data || []) as FightResult[];
}
