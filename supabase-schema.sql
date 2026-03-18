-- ═══════════════════════════════════════════════════════
-- MMA Quant — Supabase Database Schema
-- Run this in your Supabase SQL Editor to create the tables
-- ═══════════════════════════════════════════════════════

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Bets Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT,
  event_name TEXT NOT NULL,
  fight_name TEXT NOT NULL,
  fighter TEXT DEFAULT '',
  opponent TEXT DEFAULT '',
  odds NUMERIC(10, 4) DEFAULT 0,
  stake_usd NUMERIC(12, 2) DEFAULT 0,
  stake_brl NUMERIC(12, 2) DEFAULT 0,
  result TEXT DEFAULT '-' CHECK (result IN ('W', 'L', '-', '')),
  pl_usd NUMERIC(12, 2) DEFAULT 0,
  bankroll_before NUMERIC(12, 2) DEFAULT 0,
  bankroll_after NUMERIC(12, 2) DEFAULT 0,
  roi NUMERIC(10, 4) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Settings Table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  initial_bankroll NUMERIC(12, 2) DEFAULT 500,
  unit_size NUMERIC(6, 4) DEFAULT 0.01,
  target_units NUMERIC(6, 2) DEFAULT 1.5,
  currency TEXT DEFAULT 'USD'
);

-- ── Row Level Security (RLS) ────────────────────────────
-- Users can only access their own data

ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Bets policies
CREATE POLICY "Users can view their own bets"
  ON bets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bets"
  ON bets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bets"
  ON bets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bets"
  ON bets FOR DELETE
  USING (auth.uid() = user_id);

-- Settings policies
CREATE POLICY "Users can view their own settings"
  ON settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON settings FOR UPDATE
  USING (auth.uid() = user_id);

-- ── Fight Results Table ────────────────────────────────
-- Stores verified fight outcomes for automatic bet grading.
-- Can be populated manually or via external API in the future.
CREATE TABLE IF NOT EXISTS fight_results (
  fight_id TEXT PRIMARY KEY,
  event_id TEXT DEFAULT '',
  event_name TEXT DEFAULT '',
  fighter_a TEXT NOT NULL,
  fighter_b TEXT NOT NULL,
  winner TEXT NOT NULL,
  method TEXT DEFAULT '',
  end_round INTEGER DEFAULT 0,
  end_time TEXT DEFAULT '',
  is_completed BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── User Scores Table ─────────────────────────────────
-- Persists latest FightEdge score for each user.
CREATE TABLE IF NOT EXISTS user_scores (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  score NUMERIC(5, 2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add graded_at column to bets (for tracking auto-graded bets)
ALTER TABLE bets ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP WITH TIME ZONE;

-- ── Row Level Security for new tables ─────────────────
ALTER TABLE fight_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_scores ENABLE ROW LEVEL SECURITY;

-- Fight results: readable by all authenticated users
CREATE POLICY "Authenticated users can view fight results"
  ON fight_results FOR SELECT
  USING (auth.role() = 'authenticated');

-- Fight results: only service role can insert/update (or admin)
CREATE POLICY "Authenticated users can insert fight results"
  ON fight_results FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update fight results"
  ON fight_results FOR UPDATE
  USING (auth.role() = 'authenticated');

-- User scores: users can only see/modify their own
CREATE POLICY "Users can view their own score"
  ON user_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own score"
  ON user_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own score"
  ON user_scores FOR UPDATE
  USING (auth.uid() = user_id);

-- ── Indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_created_at ON bets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_fight_results_event ON fight_results(event_name);
CREATE INDEX IF NOT EXISTS idx_fight_results_completed ON fight_results(is_completed);
