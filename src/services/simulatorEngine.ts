/**
 * Simulator Engine — Forward-looking bankroll projection tool
 *
 * Architecture: Pure function that runs Monte Carlo-style bankroll simulations.
 * This module NEVER touches real data — it's a projection-only tool.
 *
 * Three scenarios:
 *   1. Expected — random distribution using winRate probability
 *   2. Best case — wins clustered early (builds bankroll before losses)
 *   3. Worst case — losses clustered early (drains bankroll before wins)
 *
 * Formulas:
 *   stake = currentBankroll * stakePercent
 *   if win  → profit = stake * (avgOdds - 1)
 *   if loss → profit = -stake
 *   bankroll updated after each simulated bet
 *
 * Seeded PRNG ensures reproducibility for the "expected" scenario.
 */

export interface SimulationInput {
  initialBankroll: number;
  winRate: number;       // 0-100 percentage
  avgOdds: number;       // decimal odds (e.g. 1.85)
  stakePercent: number;  // 0-100 percentage of bankroll per bet
  numberOfBets: number;  // 10-1000
}

export interface SimulationPoint {
  betNumber: number;
  bankroll: number;
}

export interface SimulationResult {
  expected: SimulationPoint[];
  bestCase: SimulationPoint[];
  worstCase: SimulationPoint[];
  summary: {
    finalExpected: number;
    finalBest: number;
    finalWorst: number;
    maxDrawdownExpected: number;
    maxDrawdownExpectedPct: number;
    expectedROI: number;
    expectedProfit: number;
  };
}

/**
 * Simple seeded PRNG (Mulberry32) for deterministic "expected" scenario.
 * Ensures same inputs always produce same chart — no flickering on re-render.
 */
function seededRandom(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6D2B79F5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Run a single scenario simulation.
 * @param outcomes - pre-determined array of booleans (true = win, false = loss)
 */
function runScenario(
  outcomes: boolean[],
  initialBankroll: number,
  avgOdds: number,
  stakePercent: number
): SimulationPoint[] {
  const points: SimulationPoint[] = [{ betNumber: 0, bankroll: initialBankroll }];
  let bankroll = initialBankroll;
  const stakeFraction = stakePercent / 100;

  for (let i = 0; i < outcomes.length; i++) {
    // Bankroll can't go below 0
    if (bankroll <= 0) {
      points.push({ betNumber: i + 1, bankroll: 0 });
      continue;
    }

    const stake = bankroll * stakeFraction;
    if (outcomes[i]) {
      // Win: profit = stake * (odds - 1)
      bankroll += stake * (avgOdds - 1);
    } else {
      // Loss: lose the stake
      bankroll -= stake;
    }

    // Prevent negative bankroll (busted)
    bankroll = Math.max(0, bankroll);
    points.push({ betNumber: i + 1, bankroll: Math.round(bankroll * 100) / 100 });
  }

  return points;
}

/**
 * Calculate max drawdown from a scenario's timeline.
 */
function calcMaxDrawdown(points: SimulationPoint[]): { amount: number; pct: number } {
  let peak = points[0]?.bankroll ?? 0;
  let maxDd = 0;
  let maxDdPct = 0;

  for (const p of points) {
    if (p.bankroll > peak) peak = p.bankroll;
    const dd = peak - p.bankroll;
    if (dd > maxDd) {
      maxDd = dd;
      maxDdPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }

  return { amount: Math.round(maxDd * 100) / 100, pct: Math.round(maxDdPct * 100) / 100 };
}

/**
 * Main simulation function.
 * Runs 3 scenarios and returns complete results for charting.
 */
export function runSimulation(input: SimulationInput): SimulationResult {
  const { initialBankroll, winRate, avgOdds, stakePercent, numberOfBets } = input;
  const winFraction = winRate / 100;
  const totalWins = Math.round(numberOfBets * winFraction);
  const totalLosses = numberOfBets - totalWins;

  // --- Expected Path (seeded random distribution) ---
  const rng = seededRandom(42);
  const expectedOutcomes: boolean[] = [];
  for (let i = 0; i < numberOfBets; i++) {
    expectedOutcomes.push(rng() < winFraction);
  }

  // --- Best Case (wins first, then losses) ---
  const bestOutcomes: boolean[] = [
    ...Array(totalWins).fill(true),
    ...Array(totalLosses).fill(false),
  ];

  // --- Worst Case (losses first, then wins) ---
  const worstOutcomes: boolean[] = [
    ...Array(totalLosses).fill(false),
    ...Array(totalWins).fill(true),
  ];

  const expected = runScenario(expectedOutcomes, initialBankroll, avgOdds, stakePercent);
  const bestCase = runScenario(bestOutcomes, initialBankroll, avgOdds, stakePercent);
  const worstCase = runScenario(worstOutcomes, initialBankroll, avgOdds, stakePercent);

  const finalExpected = expected[expected.length - 1]?.bankroll ?? initialBankroll;
  const finalBest = bestCase[bestCase.length - 1]?.bankroll ?? initialBankroll;
  const finalWorst = worstCase[worstCase.length - 1]?.bankroll ?? initialBankroll;

  const ddExpected = calcMaxDrawdown(expected);

  return {
    expected,
    bestCase,
    worstCase,
    summary: {
      finalExpected: Math.round(finalExpected * 100) / 100,
      finalBest: Math.round(finalBest * 100) / 100,
      finalWorst: Math.round(finalWorst * 100) / 100,
      maxDrawdownExpected: ddExpected.amount,
      maxDrawdownExpectedPct: ddExpected.pct,
      expectedROI: initialBankroll > 0
        ? Math.round(((finalExpected - initialBankroll) / initialBankroll) * 10000) / 100
        : 0,
      expectedProfit: Math.round((finalExpected - initialBankroll) * 100) / 100,
    },
  };
}
