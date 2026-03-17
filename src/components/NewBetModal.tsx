'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBetsStore } from '@/stores/useBetsStore';
import type { Bet } from '@/types';

interface BetModalProps {
  onClose: () => void;
  editBet?: Bet | null;
}

export default function BetModal({ onClose, editBet }: BetModalProps) {
  const { user } = useAuthStore();
  const { addBet, editBet: updateBet } = useBetsStore();
  const isEdit = !!editBet;

  const [eventName, setEventName] = useState('');
  const [fightName, setFightName] = useState('');
  const [fighter, setFighter] = useState('');
  const [opponent, setOpponent] = useState('');
  const [odds, setOdds] = useState('');
  const [stakeUsd, setStakeUsd] = useState('');
  const [result, setResult] = useState<'' | 'W' | 'L' | '-'>('-');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editBet) {
      setEventName(editBet.event_name || '');
      setFightName(editBet.fight_name || '');
      setFighter(editBet.fighter || '');
      setOpponent(editBet.opponent || '');
      setOdds(editBet.odds ? String(editBet.odds) : '');
      setStakeUsd(editBet.stake_usd ? String(editBet.stake_usd) : '');
      setResult((editBet.result as '' | 'W' | 'L' | '-') || '-');
    }
  }, [editBet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);

    const oddsNum = parseFloat(odds);
    const stakeNum = parseFloat(stakeUsd);

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
            <div className="modal-field">
              <label>Stake (USD)</label>
              <input
                className="auth-input"
                type="number"
                step="0.01"
                value={stakeUsd}
                onChange={(e) => setStakeUsd(e.target.value)}
                placeholder="5.00"
                required
              />
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
