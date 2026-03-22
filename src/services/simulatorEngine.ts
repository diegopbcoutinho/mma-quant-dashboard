/**
 * Monte Carlo Simulator Engine — Probabilistic bankroll projection
 *
 * Architecture: Pure functions that run N independent random simulations.
 * Each simulation generates random bet outcomes based on win probability.
 * Results are aggregated into percentile bands for fan chart visualization.
 *
 * This module NEVER touches real data — it's a projection-only tool.
 *
 * Core formulas:
 *   stake = currentBankroll * stakePercent
 *   if win  → profit = stake * (avgOdds - 1)
 *   if loss → profit = -stake
 *   bankroll updated dynamically after each simulated bet
 *
 * Output:
 *   - Percentile bands (p10, p25, median, p75, p90) at each bet number
 *   - Sample paths for visual depth
 *   - Aggregate statistics: probability of profit, risk of ruin, avg drawdown
 */

export interface MonteCarloInput {
  initialBankroll: number;
  winRate: number;       // 0-100 percentage
  avgOdds: number;       // decimal odds (e.g. 1.85)
  stakePercent: number;  // 0-100 percentage of bankroll per bet
  numberOfBets: number;  // 10-1000
  simulations?: number;  // default 1000
  stakeStrategy?: 'flat' | 'compound'; // flat = fixed unit, compound = scales with bankroll
}

export interface PercentilePoint {
  betNumber: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
}

export interface SamplePath {
  points: number[]; // bankroll at each bet (index = betNumber)
}

export interface MonteCarloResult {
  /** Percentile bands at each bet number (for fan chart) */
  percentiles: PercentilePoint[];

  /** 10 random sample paths for visual depth */
  samplePaths: SamplePath[];

  /** Aggregate statistics */
  summary: {
    medianFinal: number;
    p90Final: number;      // upside (90th percentile)
    p10Final: number;      // downside (10th percentile)
    probProfit: number;    // % of simulations ending above initial
    riskOfRuin: number;    // % of simulations where bankroll hit 0
    avgMaxDrawdown: number;     // average max drawdown in USD
    avgMaxDrawdownPct: number;  // average max drawdown as % of peak
    medianROI: number;
    expectedProfit: number;
    simulationsRun: number;
  };
}

// ── Legacy exports for backward compatibility ──
export type SimulationInput = MonteCarloInput;
export type SimulationResult = MonteCarloResult;

/**
 * Run a single simulation path.
 * Returns the bankroll at each step (array of length numberOfBets + 1).
 */
function runSinglePath(
  initialBankroll: number,
  winFraction: number,
  avgOdds: number,
  stakeFraction: number,
  numberOfBets: number,
  isCompound: boolean,
): number[] {
  const path = new Float64Array(numberOfBets + 1);
  path[0] = initialBankroll;
  let bankroll = initialBankroll;
  const flatStake = initialBankroll * stakeFraction; // fixed for flat mode

  for (let i = 0; i < numberOfBets; i++) {
    if (bankroll <= 0) {
      for (let j = i + 1; j <= numberOfBets; j++) path[j] = 0;
      return Array.from(path);
    }

    // Compound: stake scales with current bankroll. Flat: fixed unit from initial.
    const stake = isCompound ? bankroll * stakeFraction : Math.min(flatStake, bankroll);
    if (Math.random() < winFraction) {
      bankroll += stake * (avgOdds - 1);
    } else {
      bankroll -= stake;
    }
    bankroll = Math.max(0, bankroll);
    path[i + 1] = bankroll;
  }

  return Array.from(path);
}

/**
 * Calculate max drawdown for a single path.
 */
function calcPathDrawdown(path: number[]): { amount: number; pct: number } {
  let peak = path[0];
  let maxDd = 0;
  let maxDdPct = 0;

  for (let i = 1; i < path.length; i++) {
    if (path[i] > peak) peak = path[i];
    const dd = peak - path[i];
    if (dd > maxDd) {
      maxDd = dd;
      maxDdPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }

  return { amount: maxDd, pct: maxDdPct };
}

/**
 * Get percentile value from a sorted array.
 */
function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Main Monte Carlo simulation.
 * Runs N independent simulations and aggregates results.
 */
export function runMonteCarloSimulation(input: MonteCarloInput): MonteCarloResult {
  const {
    initialBankroll,
    winRate,
    avgOdds,
    stakePercent,
    numberOfBets,
    simulations = 1000,
    stakeStrategy = 'compound',
  } = input;

  const winFraction = winRate / 100;
  const stakeFraction = stakePercent / 100;
  const isCompound = stakeStrategy === 'compound';
  const numSims = Math.min(simulations, 1000); // cap at 1000

  // Run all simulations
  const allPaths: number[][] = [];
  for (let s = 0; s < numSims; s++) {
    allPaths.push(
      runSinglePath(initialBankroll, winFraction, avgOdds, stakeFraction, numberOfBets, isCompound)
    );
  }

  // ── Calculate percentile bands at each bet number ──
  const percentiles: PercentilePoint[] = [];
  // Downsample if > 200 points for chart performance
  const step = numberOfBets > 200 ? Math.ceil(numberOfBets / 200) : 1;
  const sampleIndices: number[] = [];
  for (let i = 0; i <= numberOfBets; i += step) {
    sampleIndices.push(i);
  }
  if (sampleIndices[sampleIndices.length - 1] !== numberOfBets) {
    sampleIndices.push(numberOfBets);
  }

  for (const betIdx of sampleIndices) {
    // Collect bankroll values at this bet number across all simulations
    const values = new Float64Array(numSims);
    for (let s = 0; s < numSims; s++) {
      values[s] = allPaths[s][betIdx];
    }
    // Sort for percentile calculation
    values.sort();
    const sorted = Array.from(values);

    percentiles.push({
      betNumber: betIdx,
      p10: percentile(sorted, 10),
      p25: percentile(sorted, 25),
      median: percentile(sorted, 50),
      p75: percentile(sorted, 75),
      p90: percentile(sorted, 90),
    });
  }

  // ── Pick 10 random sample paths ──
  const samplePaths: SamplePath[] = [];
  const pathIndices = new Set<number>();
  while (pathIndices.size < Math.min(10, numSims)) {
    pathIndices.add(Math.floor(Math.random() * numSims));
  }
  for (const idx of pathIndices) {
    // Downsample the path to match percentile points
    const points = sampleIndices.map(i => allPaths[idx][i]);
    samplePaths.push({ points });
  }

  // ── Aggregate statistics ──
  const finalBankrolls = allPaths.map(p => p[numberOfBets]);
  finalBankrolls.sort((a, b) => a - b);

  let profitCount = 0;
  let ruinCount = 0;
  let totalMaxDd = 0;
  let totalMaxDdPct = 0;

  for (let s = 0; s < numSims; s++) {
    const final = allPaths[s][numberOfBets];
    if (final > initialBankroll) profitCount++;

    // Check if bankroll ever hit 0
    let hitZero = false;
    for (let i = 1; i <= numberOfBets; i++) {
      if (allPaths[s][i] <= 0) { hitZero = true; break; }
    }
    if (hitZero) ruinCount++;

    const dd = calcPathDrawdown(allPaths[s]);
    totalMaxDd += dd.amount;
    totalMaxDdPct += dd.pct;
  }

  const medianFinal = percentile(finalBankrolls, 50);

  const summary = {
    medianFinal: round2(medianFinal),
    p90Final: round2(percentile(finalBankrolls, 90)),
    p10Final: round2(percentile(finalBankrolls, 10)),
    probProfit: round2((profitCount / numSims) * 100),
    riskOfRuin: round2((ruinCount / numSims) * 100),
    avgMaxDrawdown: round2(totalMaxDd / numSims),
    avgMaxDrawdownPct: round2(totalMaxDdPct / numSims),
    medianROI: initialBankroll > 0
      ? round2(((medianFinal - initialBankroll) / initialBankroll) * 100)
      : 0,
    expectedProfit: round2(medianFinal - initialBankroll),
    simulationsRun: numSims,
  };

  return { percentiles, samplePaths, summary };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Legacy wrapper ──
export function runSimulation(input: SimulationInput): MonteCarloResult {
  return runMonteCarloSimulation(input);
}
