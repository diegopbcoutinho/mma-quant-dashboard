'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBetsStore } from '@/stores/useBetsStore';
import type { UpcomingEvent, UpcomingFight } from '@/types/ufcCard';

type StakeMode = 'usd' | 'units';

interface QuickBetModalProps {
  event: UpcomingEvent;
  fight: UpcomingFight;
  pickedSide: 'A' | 'B';
  onClose: () => void;
  onSaved?: () => void;
  /** Batch mode: when true, after saving call onAdvance instead of closing */
  batchMode?: boolean;
  onAdvance?: () => void;
  onSkip?: () => void;
  progress?: { current: number; total: number };
}

export default function QuickBetModal({
  event,
  fight,
  pickedSide,
  onClose,
  onSaved,
  batchMode,
  onAdvance,
  onSkip,
  progress,
}: QuickBetModalProps) {
  const { user } = useAuthStore();
  const { addBet, settings, globals, metrics } = useBetsStore();

  const fighter = pickedSide === 'A' ? fight.fighterA : fight.fighterB;
  const opponent = pickedSide === 'A' ? fight.fighterB : fight.fighterA;

  const [odds, setOdds] = useState('');
  const [stakeInput, setStakeInput] = useState('');
  const [stakeMode, setStakeMode] = useState<StakeMode>('usd');
  const [submitting, setSubmitting] = useState(false);
  const oddsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    oddsRef.current?.focus();
  }, [fight.fightId]);

  const unitValue = useMemo(() => {
    const initialBankroll = settings?.initial_bankroll ?? globals.bancaInicial;
    const unitPct = settings?.unit_size ?? globals.unitSize;
    const isCompound = settings?.stake_strategy === 'compound';
    if (isCompound) {
      const currentBankroll = metrics?.currentBankroll ?? initialBankroll;
      return currentBankroll * unitPct;
    }
    return initialBankroll * unitPct;
  }, [settings, globals, metrics]);

  const resolvedStakeUsd = useMemo(() => {
    const val = parseFloat(stakeInput) || 0;
    return stakeMode === 'units' ? val * unitValue : val;
  }, [stakeInput, stakeMode, unitValue]);

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
    const eventDate = event.date ? new Date(event.date) : new Date();
    const y = eventDate.getFullYear();
    const m = String(eventDate.getMonth() + 1).padStart(2, '0');
    const d = String(eventDate.getDate()).padStart(2, '0');
    const displayDate = `${m}/${d}/${y}`;

    await addBet(user.id, {
      date: displayDate,
      created_at: new Date().toISOString(),
      event_name: event.name,
      fight_name: `${fight.fighterA.name} vs ${fight.fighterB.name}`,
      fighter: fighter.name,
      opponent: opponent.name,
      odds: oddsNum,
      stake_usd: stakeNum,
      stake_brl: 0,
      result: '-',
      pl_usd: 0,
      bankroll_before: 0,
      bankroll_after: 0,
      roi: 0,
    });

    setSubmitting(false);
    onSaved?.();
    if (batchMode && onAdvance) {
      onAdvance();
    } else {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card quick-bet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <span>
            {batchMode && progress ? `Quick Add (${progress.current}/${progress.total})` : 'Quick Bet'}
          </span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="qbm-context">
          <div className="qbm-event-name">{event.name}</div>
          <div className="qbm-fight-line">
            <FighterChip fighter={fight.fighterA} picked={pickedSide === 'A'} />
            <span className="qbm-vs">vs</span>
            <FighterChip fighter={fight.fighterB} picked={pickedSide === 'B'} />
          </div>
          {fight.weightClass && <div className="qbm-weight">{fight.weightClass}</div>}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="modal-field">
              <label>Odds</label>
              <input
                ref={oddsRef}
                className="auth-input"
                type="number"
                step="0.001"
                inputMode="decimal"
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
                placeholder="1.750"
                required
              />
            </div>

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
                inputMode="decimal"
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                placeholder={stakeMode === 'units' ? '1.0' : '5.00'}
                required
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                {stakeMode === 'units'
                  ? `= $${resolvedStakeUsd.toFixed(2)} (1u = $${unitValue.toFixed(2)})`
                  : unitValue > 0
                    ? `= ${(resolvedStakeUsd / unitValue).toFixed(2)}u`
                    : ''}
              </span>
            </div>
          </div>

          <div className="modal-actions">
            {batchMode ? (
              <>
                <button type="button" className="btn-sync" onClick={onSkip}>
                  Skip
                </button>
                <button type="submit" className="btn-save" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save & Next'}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-sync" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-save" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Bet'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function FighterChip({ fighter, picked }: { fighter: { name: string; photo?: string }; picked: boolean }) {
  return (
    <span className={`qbm-fighter-chip ${picked ? 'picked' : 'dim'}`}>
      <FighterAvatar name={fighter.name} photo={fighter.photo} size={28} />
      <span className="qbm-fighter-name">{fighter.name}</span>
      {picked && <i className="fa-solid fa-check qbm-pick-check"></i>}
    </span>
  );
}

function FighterAvatar({ name, photo, size = 32 }: { name: string; photo?: string; size?: number }) {
  const [errored, setErrored] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');

  if (photo && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={name}
        width={size}
        height={size}
        className="fighter-avatar-img"
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <span className="fighter-avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials || '?'}
    </span>
  );
}
