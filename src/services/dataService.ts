/**
 * Data Service — Abstraction Layer
 *
 * Architecture: this service provides a unified API for data operations.
 * It delegates to a "provider" which can be swapped:
 *   - SupabaseProvider (default for SaaS)
 *   - GoogleSheetsProvider (legacy, read-only)
 *   - LocalStorageProvider (offline/demo)
 *
 * Dashboard components ONLY talk to this service, never directly to
 * Supabase or Google Sheets.
 */

import type { Bet, Settings } from '@/types';
import { supabaseProvider } from './supabaseProvider';

// Provider interface — implement this for each data source
export interface DataProvider {
  getBets(userId: string): Promise<Bet[]>;
  createBet(userId: string, bet: Omit<Bet, 'id' | 'user_id'>): Promise<Bet>;
  updateBet(betId: string, updates: Partial<Bet>): Promise<Bet>;
  deleteBet(betId: string): Promise<void>;
  deleteAllBets(userId: string): Promise<void>;
  getSettings(userId: string): Promise<Settings | null>;
  updateSettings(userId: string, settings: Partial<Settings>): Promise<Settings>;
}

// Active provider — can be switched at runtime if needed
let activeProvider: DataProvider = supabaseProvider;

export function setProvider(provider: DataProvider) {
  activeProvider = provider;
}

// Exported service functions
export async function getBets(userId: string): Promise<Bet[]> {
  return activeProvider.getBets(userId);
}

export async function createBet(
  userId: string,
  bet: Omit<Bet, 'id' | 'user_id'>
): Promise<Bet> {
  return activeProvider.createBet(userId, bet);
}

export async function updateBet(betId: string, updates: Partial<Bet>): Promise<Bet> {
  return activeProvider.updateBet(betId, updates);
}

export async function deleteBet(betId: string): Promise<void> {
  return activeProvider.deleteBet(betId);
}

export async function deleteAllBets(userId: string): Promise<void> {
  return activeProvider.deleteAllBets(userId);
}

export async function getSettings(userId: string): Promise<Settings | null> {
  return activeProvider.getSettings(userId);
}

export async function updateSettings(userId: string, settings: Partial<Settings>): Promise<Settings> {
  return activeProvider.updateSettings(userId, settings);
}
