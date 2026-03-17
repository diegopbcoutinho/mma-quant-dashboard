'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBetsStore } from '@/stores/useBetsStore';
import type { Bet } from '@/types';

type StakeMode = 'usd' | 'units';

interface BetModalProps {
  onClose: () => void;
  editBet?: Bet | null;
}

export default function BetModal({ onClose, editBet }: BetModalProps) {
  const { user } = useAuthStore();
  const { addBet, editBet: updateBet, settings, globals } = useBetsStore();
  const isEdit = !!editBet;

  const [eventName, setEventName] = useState('');
  const [fightName, setFightName] = useState('');
  const [fighter, setFighter] = useState('');
  const [opponent, setOpponent] = useState('');
  const [odds, setOdds] = useState('');
  const [stakeInput, setStakeInput] = useState('');
  const [stakeMode, setStakeMode] = useState<StakeMode>('usd');
  const [result, setResult] = useState<'' | 'W' | 'L' | '-'>('-');
  const [submitting, setSubmitting] = useState(false);

  // Calculate 1 unit value in USD
  const unitValue = useMemo(() => {
    const bankroll = settings?.initial_bankroll ?? globals.bancaInicial;
    const unitPct = settings?.unit_size ?? globals.unitSize;
    return bankroll * unitPct;
  }, [settings, globals]);

  // Resolve actual USD stake from input
  const resolvedStakeUsd = useMemo(() => {
    const val = parseFloat(stakeInput) || 0;
    return stakeMode === 'units' ? val * unitValue : val;
  }, [stakeInput, stakeMode, unitValue]);

  // Pre-fill fields when editing
  useEffect(() => {
    if (editBet) {
      setEventName(editBet.event_name || '');
      setFightName(editBet.fight_name || '');
      setFighter(editBet.fighter || '');
      setOpponent(editBet.opponent || '');
      setOdds(editBet.odds ? String(editBet.odds) : '');
      setStakeInput(editBet.stake_usd ? String(editBet.stake_usd) : '');
      setStakeMode('usd');
      setResult((editBet.result as '' | 'W' | 'L' | '-') || '-');
    }
  }, [editBet]);

  // When toggling mode, convert the current value
  const handleModeSwitch = (mode: StakeMode) => {
    const val = parseFloat(stakeInput) || 0;
    if (mode === 'units' && stakeMode === 'usd' && unitValue > 0) {
      setStakeInput((val / unitValue).toFixed(2));
    } else if (mode === 'usd' && stakeMode === 'units') {
      setStakeInput((val * unitValue).toFixed(2));
    }
    setStakeMode(mode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);

    const oddsNum = parseFloat(odds);
    const stakeNum = resolvedStakeUsd;

    let plUsd = 0;
    if (result === 'W') plUsd = stakeNum * (oddsNum - 1);
    else if (result === 'L') plUsd = -stakeNum;

    if (isEdit && editBet?.id) {
      await updateBet(editBet.id, {
        event_name: eventName,
        fight_name: fightName,
        fighter,
        opponent,
        odds: oddsNum,
        stake_usd: stakeNum,
        stake_brl: 0,
        result,
        pl_usd: plUsd,
      });
    } else {
      const today = new Date().toLocaleDateString('en-US');
      await addBet(user.id, {
        date: today,
        event_name: eventName,
        fight_name: fightName,
        fighter,
        opponent,
        odds: oddsNum,
        stake_usd: stakeNum,
        stake_brl: 0,
        result,
        pl_usd: plUsd,
        bankroll_before: 0,
        bankroll_after: 0,
        roi: 0,
      });
    }

    setSubmitting(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <span>{isEdit ? 'Edit Bet' : 'New Bet'}</span>
          <button className="modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label>Event</label>
            <input
              className="auth-input"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. UFC 310"
              required
            />
          </div>

          <div className="modal-field">
            <label>Fight</label>
            <input
              className="auth-input"
              value={fightName}
              onChange={(e) => setFightName(e.target.value)}
              placeholder="e.g. Fighter A vs Fighter B"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="modal-field">
              <label>Fighter</label>
              <input
                className="auth-input"
                value={fighter}
                onChange={(e) => setFighter(e.target.value)}
                placeholder="Fighter picked"
              />
            </div>
            <div className="modal-field">
              <label>Opponent</label>
              <input
                className="auth-input"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder="Opponent"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="modal-field">
              <label>Odds</label>
              <input
                className="auth-input"
                type="number"
                step="0.001"
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
                placeholder="1.750"
                required
              />
            </div>

            {/* Stake field with USD/Units toggle */}
            <div className="modal-field">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Stake</span>
                <div className="stake-mode-toggle">
                  <button
                    type="button"
                    className={`stake-mode-btn ${stakeMode === 'usd' ? 'active' : ''}`}
                    onClick={() => handleModeSwitch('usd')}
                  >
                    USD
                  </button>
                  <button
                    type="button"
                    className={`stake-mode-btn ${stakeMode === 'units' ? 'active' : ''}`}
                    onClick={() => handleModeSwitch('units')}
                  >
                    Units
                  </button>
                </div>
              </label>
              <input
                className="auth-input"
                type="number"
                step={stakeMode === 'units' ? '0.5' : '0.01'}
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                placeholder={stakeMode === 'units' ? '1.0' : '5.00'}
                required
              />
              {/* Preview: show converted value */}
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                {stakeMode === 'units'
                  ? `= $${resolvedStakeUsd.toFixed(2)} (1u = $${unitValue.toFixed(2)})`
                  : unitValue > 0
                    ? `= ${(resolvedStakeUsd / unitValue).toFixed(2)}u`
                    : ''
                }
              </span>
            </div>
          </div>

          <div className="modal-field">
            <label>Result</label>
            <select
              className="auth-input"
              value={result}
              onChange={(e) => setResult(e.target.value as '' | 'W' | 'L' | '-')}
            >
              <option value="-">Pending</option>
              <option value="W">Win</option>
              <option value="L">Loss</option>
              <option value="">To Do</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-sync" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-save" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Bet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
