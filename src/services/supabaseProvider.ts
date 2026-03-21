/**
 * Supabase Data Provider
 *
 * Implements the DataProvider interface for Supabase/PostgreSQL.
 * This is the primary provider for the SaaS version.
 *
 * Database tables expected:
 *   - bets: id, user_id, date, event_name, fight_name, fighter, opponent,
 *           odds, stake_usd, stake_brl, result, pl_usd, bankroll_before,
 *           bankroll_after, roi, created_at
 *   - settings: id, user_id, initial_bankroll, unit_size, target_units, currency
 *
 * RLS (Row Level Security) must be enabled on both tables so users
 * can only access their own data.
 */

import { supabase } from '@/lib/supabaseClient';
import type { Bet, Settings } from '@/types';
import type { DataProvider } from './dataService';

export const supabaseProvider: DataProvider = {
  async getBets(userId: string): Promise<Bet[]> {
    const { data, error } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Supabase returns NUMERIC columns as strings — coerce to numbers
    return (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      odds: Number(row.odds) || 0,
      stake_usd: Number(row.stake_usd) || 0,
      stake_brl: Number(row.stake_brl) || 0,
      pl_usd: Number(row.pl_usd) || 0,
      bankroll_before: Number(row.bankroll_before) || 0,
      bankroll_after: Number(row.bankroll_after) || 0,
      roi: Number(row.roi) || 0,
    })) as Bet[];
  },

  async createBet(userId: string, bet: Omit<Bet, 'id' | 'user_id'>): Promise<Bet> {
    const { data, error } = await supabase
      .from('bets')
      .insert({ ...bet, user_id: userId })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Bet;
  },

  async updateBet(betId: string, updates: Partial<Bet>): Promise<Bet> {
    const { data, error } = await supabase
      .from('bets')
      .update(updates)
      .eq('id', betId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Bet;
  },

  async deleteBet(betId: string): Promise<void> {
    const { error } = await supabase
      .from('bets')
      .delete()
      .eq('id', betId);

    if (error) throw new Error(error.message);
  },

  async getSettings(userId: string): Promise<Settings | null> {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    if (!data) return null;
    // Ensure stake_strategy has a default value
    return { stake_strategy: 'flat', ...data } as Settings;
  },

  async updateSettings(userId: string, settings: Partial<Settings>): Promise<Settings> {
    // Upsert: create if not exists, update if exists
    const { data, error } = await supabase
      .from('settings')
      .upsert({ ...settings, user_id: userId }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Settings;
  },
};
