'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBetsStore } from '@/stores/useBetsStore';
import type { Bet } from '@/types';

interface BetModalProps {
  onClose: () => void;
  editBet?: Bet | null; // If provided, modal is in edit mode
}

export default function BetModal({ onClose, editBet }: BetModalProps) {
  const { user } = useAuthStore();
  const { addBet, editBet: updateBet, globals } = useBetsStore();
  const isEdit = !!editBet;

  const [eventName, setEventName] = useState('');
  const [fightName, setFightName] = useState('');
  const [fighter, setFighter] = useState('');
  const [opponent, setOpponent] = useState('');
  const [odds, setOdds] = useState('');
  const [stakeUsd, setStakeUsd] = useState('');
  const [result, setResult] = useState<'' | 'W' | 'L' | '-'>('-');
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill fields when editing
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
    const stakeBrl = stakeNum * (globals.dolarHoje || 1);

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
        stake_brl: stakeBrl,
        result,
        pl_usd: plUsd,
      });
    } else {
      const today = new Date().toLocaleDateString('pt-BR');
      await addBet(user.id, {
        date: today,
        event_name: eventName,
        fight_name: fightName,
        fighter,
        opponent,
        odds: oddsNum,
        stake_usd: stakeNum,
        stake_brl: stakeBrl,
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
          <span>{isEdit ? 'Editar Aposta' : 'Nova Aposta'}</span>
          <button className="modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label>Evento</label>
            <input
              className="auth-input"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Ex: UFC 310"
              required
            />
          </div>

          <div className="modal-field">
            <label>Luta</label>
            <input
              className="auth-input"
              value={fightName}
              onChange={(e) => setFightName(e.target.value)}
              placeholder="Ex: Fighter A vs Fighter B"
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
                placeholder="Lutador apostado"
              />
            </div>
            <div className="modal-field">
              <label>Oponente</label>
              <input
                className="auth-input"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder="Adversário"
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
            <label>Resultado</label>
            <select
              className="auth-input"
              value={result}
              onChange={(e) => setResult(e.target.value as '' | 'W' | 'L' | '-')}
            >
              <option value="-">Pendente</option>
              <option value="W">Win</option>
              <option value="L">Loss</option>
              <option value="">A Fazer</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-sync" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-save" disabled={submitting}>
              {submitting ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Salvar Aposta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
