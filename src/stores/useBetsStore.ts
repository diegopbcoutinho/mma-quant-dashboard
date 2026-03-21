/**
 * Zustand Store — Bets & App State
 *
 * Architecture: centralized state that mirrors the original appState object.
 * Uses Zustand for simplicity (no boilerplate, no context providers needed).
 * Supports optimistic UI updates for bet creation.
 *
 * Sprint 1.5: Now integrates metricsEngine + bankrollEngine.
 * All metric recalculations flow through recalculate() helper.
 */

import { create } from 'zustand';
import type { Bet, Globals, Analytics, Settings } from '@/types';
import type { GradingSummary } from '@/types/fightResult';
import { computeAnalytics } from '@/lib/analytics';
import { calculateMetrics, type Metrics } from '@/services/metricsEngine';
import * as dataService from '@/services/dataService';
import { checkAndGradePendingBets } from '@/services/gradingEngine';

interface BetsState {
  // Data
  bets: Bet[];
  globals: Globals;
  analytics: Analytics | null;
  metrics: Metrics | null;
  settings: Settings | null;

  // UI state
  loading: boolean;
  currentTab: 'finished' | 'future';
  connectionError: boolean;

  // Actions
  setCurrentTab: (tab: 'finished' | 'future') => void;
  setGlobals: (globals: Partial<Globals>) => void;
  setDolar: (rate: number) => void;

  // Data operations (talk to dataService)
  fetchBets: (userId: string) => Promise<void>;
  addBet: (userId: string, bet: Omit<Bet, 'id' | 'user_id'>) => Promise<void>;
  editBet: (betId: string, updates: Partial<Bet>) => Promise<void>;
  removeBet: (betId: string) => Promise<void>;
  updateBetResult: (betId: string, result: 'W' | 'L' | '-' | '', stakeUsd: number, odds: number) => Promise<void>;
  gradePendingBets: (userId: string) => Promise<GradingSummary>;
  fetchSettings: (userId: string) => Promise<void>;
  saveSettings: (userId: string, settings: Partial<Settings>) => Promise<void>;
  clearConnectionError: () => void;
}

/**
 * Recalculate all metrics from bets + settings.
 * Called after every bet mutation or settings change.
 * This ensures financial consistency across the entire app.
 */
function recalculate(bets: Bet[], settings: Settings | null) {
  const analytics = computeAnalytics(bets);
  const metrics = calculateMetrics(bets, settings);
  return { analytics, metrics };
}

export const useBetsStore = create<BetsState>((set, get) => ({
  bets: [],
  globals: { bancaInicial: 500, targetUnits: 1.5, unitSize: 0.01, dolarHoje: 0 },
  analytics: null,
  metrics: null,
  settings: null,
  loading: true,
  currentTab: 'finished',
  connectionError: false,

  setCurrentTab: (tab) => set({ currentTab: tab }),

  setGlobals: (partial) =>
    set((state) => ({ globals: { ...state.globals, ...partial } })),

  setDolar: (rate) =>
    set((state) => ({ globals: { ...state.globals, dolarHoje: rate } })),

  clearConnectionError: () => set({ connectionError: false }),

  fetchBets: async (userId) => {
    set({ loading: true });
    try {
      const bets = await dataService.getBets(userId);
      const { analytics, metrics } = recalculate(bets, get().settings);
      set({ bets, analytics, metrics, loading: false, connectionError: false });
    } catch {
      set({ loading: false, connectionError: true });
    }
  },

  addBet: async (userId, bet) => {
    const tempBet: Bet = {
      ...bet,
      id: 'temp-' + Date.now(),
      user_id: userId,
      created_at: bet.created_at || new Date().toISOString(),
    };
    set((state) => {
      const newBets = [tempBet, ...state.bets].sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da; // newest first
      });
      const { analytics, metrics } = recalculate(newBets, state.settings);
      return { bets: newBets, analytics, metrics };
    });

    try {
      const savedBet = await dataService.createBet(userId, bet);
      set((state) => {
        const newBets = state.bets.map((b) =>
          b.id === tempBet.id ? savedBet : b
        ).sort((a, b) => {
          const da = a.created_at ? new Date(a.created_at).getTime() : 0;
          const db = b.created_at ? new Date(b.created_at).getTime() : 0;
          return db - da;
        });
        const { analytics, metrics } = recalculate(newBets, state.settings);
        return { bets: newBets, analytics, metrics, connectionError: false };
      });
    } catch {
      set((state) => {
        const newBets = state.bets.filter((b) => b.id !== tempBet.id);
        const { analytics, metrics } = recalculate(newBets, state.settings);
        return { bets: newBets, analytics, metrics, connectionError: true };
      });
    }
  },

  editBet: async (betId, updates) => {
    set((state) => {
      const newBets = state.bets.map((b) =>
        b.id === betId ? { ...b, ...updates } : b
      );
      const { analytics, metrics } = recalculate(newBets, state.settings);
      return { bets: newBets, analytics, metrics };
    });

    try {
      await dataService.updateBet(betId, updates);
      set({ connectionError: false });
    } catch {
      const userId = get().bets.find((b) => b.id === betId)?.user_id;
      set({ connectionError: true });
      if (userId) get().fetchBets(userId);
    }
  },

  removeBet: async (betId) => {
    const prev = get().bets;
    set((state) => {
      const newBets = state.bets.filter((b) => b.id !== betId);
      const { analytics, metrics } = recalculate(newBets, state.settings);
      return { bets: newBets, analytics, metrics };
    });

    try {
      await dataService.deleteBet(betId);
      set({ connectionError: false });
    } catch {
      const { analytics, metrics } = recalculate(prev, get().settings);
      set({ bets: prev, analytics, metrics, connectionError: true });
    }
  },

  updateBetResult: async (betId, result, stakeUsd, odds) => {
    let plUsd = 0;
    if (result === 'W') plUsd = stakeUsd * (odds - 1);
    else if (result === 'L') plUsd = -stakeUsd;

    set((state) => {
      const newBets = state.bets.map((b) =>
        b.id === betId ? { ...b, result, pl_usd: plUsd } : b
      );
      const { analytics, metrics } = recalculate(newBets, state.settings);
      return { bets: newBets, analytics, metrics };
    });

    try {
      await dataService.updateBet(betId, { result, pl_usd: plUsd });
      set({ connectionError: false });
    } catch {
      set({ connectionError: true });
      const userId = get().bets.find((b) => b.id === betId)?.user_id;
      if (userId) get().fetchBets(userId);
    }
  },

  gradePendingBets: async (userId) => {
    try {
      const summary = await checkAndGradePendingBets(userId);

      // If any bets were graded, refetch to get updated data
      if (summary.totalGraded > 0) {
        const bets = await dataService.getBets(userId);
        const { analytics, metrics } = recalculate(bets, get().settings);
        set({ bets, analytics, metrics, connectionError: false });
      }

      return summary;
    } catch {
      set({ connectionError: true });
      return { totalChecked: 0, totalGraded: 0, results: [] };
    }
  },

  fetchSettings: async (userId) => {
    try {
      let settings = await dataService.getSettings(userId);

      // Auto-create default settings if none exist
      if (!settings) {
        settings = await dataService.updateSettings(userId, {
          initial_bankroll: 500,
          unit_size: 0.01,
          target_units: 1.5,
          currency: 'USD',
        });
      }

      const { analytics, metrics } = recalculate(get().bets, settings);
      set({
        settings,
        analytics,
        metrics,
        globals: {
          ...get().globals,
          bancaInicial: settings.initial_bankroll,
          unitSize: settings.unit_size,
          targetUnits: settings.target_units,
        },
        connectionError: false,
      });
    } catch {
      set({ connectionError: true });
    }
  },

  saveSettings: async (userId, settings) => {
    try {
      const saved = await dataService.updateSettings(userId, settings);

      // Recalculate everything with new settings (bankroll may change)
      const { analytics, metrics } = recalculate(get().bets, saved);
      set({
        settings: saved,
        analytics,
        metrics,
        globals: {
          ...get().globals,
          bancaInicial: saved.initial_bankroll,
          unitSize: saved.unit_size,
          targetUnits: saved.target_units,
        },
        connectionError: false,
      });
    } catch {
      set({ connectionError: true });
    }
  },
}));
