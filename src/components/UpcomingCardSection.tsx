'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getUpcomingUfcCard, clearUfcCardCache } from '@/services/ufcCardService';
import { useBetsStore } from '@/stores/useBetsStore';
import type { UpcomingEvent, UpcomingFight } from '@/types/ufcCard';
import QuickBetModal from './QuickBetModal';

interface ActivePick {
  fight: UpcomingFight;
  side: 'A' | 'B';
}

export default function UpcomingCardSection() {
  const { bets } = useBetsStore();
  const [event, setEvent] = useState<UpcomingEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [activePick, setActivePick] = useState<ActivePick | null>(null);

  // Batch mode state
  const [batchActive, setBatchActive] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchPick, setBatchPick] = useState<ActivePick | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (force) clearUfcCardCache();
      const data = await getUpcomingUfcCard({ force });
      setEvent(data);
    } catch {
      setError('Could not load upcoming card from ESPN.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Map of fightId → array of bets the user already placed for that fight. */
  const existingBetsByFight = useMemo(() => {
    if (!event) return new Map<string, { fighter: string }[]>();
    const map = new Map<string, { fighter: string }[]>();
    const eventNameLower = event.name.toLowerCase();
    for (const bet of bets) {
      if (!bet.event_name) continue;
      // Loose match: either event name matches, or fight contains both fighters
      const matchesEvent = bet.event_name.toLowerCase() === eventNameLower;
      for (const fight of event.fights) {
        const aName = fight.fighterA.name.toLowerCase();
        const bName = fight.fighterB.name.toLowerCase();
        const fightStr = (bet.fight_name || '').toLowerCase();
        const matchesFight = fightStr.includes(aName) && fightStr.includes(bName);
        if (matchesEvent && matchesFight) {
          const arr = map.get(fight.fightId) ?? [];
          arr.push({ fighter: bet.fighter || '' });
          map.set(fight.fightId, arr);
        }
      }
    }
    return map;
  }, [event, bets]);

  const formattedDate = useMemo(() => {
    if (!event?.date) return '';
    try {
      return new Date(event.date).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return event.date;
    }
  }, [event]);

  const handlePick = (fight: UpcomingFight, side: 'A' | 'B') => {
    setActivePick({ fight, side });
  };

  const startBatchMode = () => {
    if (!event || event.fights.length === 0) return;
    setBatchActive(true);
    setBatchIndex(0);
    setBatchPick(null);
  };

  const advanceBatch = () => {
    if (!event) return;
    const next = batchIndex + 1;
    if (next >= event.fights.length) {
      setBatchActive(false);
      setBatchIndex(0);
      setBatchPick(null);
    } else {
      setBatchIndex(next);
      setBatchPick(null);
    }
  };

  if (loading) {
    return (
      <section className="upcoming-card-section glass-panel">
        <div className="ucs-header">
          <div>
            <div className="ucs-eyebrow">Upcoming UFC Card</div>
            <div className="ucs-title-skel skeleton" style={{ width: 220, height: 28 }} />
          </div>
        </div>
        <div className="ucs-fight-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ucs-fight-card skeleton" style={{ height: 84 }} />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="upcoming-card-section glass-panel">
        <div className="ucs-header">
          <div>
            <div className="ucs-eyebrow">Upcoming UFC Card</div>
            <div className="ucs-title">Card unavailable</div>
          </div>
          <button className="btn-sync" onClick={() => load(true)}>
            <i className="fa-solid fa-rotate"></i> Retry
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 4px' }}>{error}</p>
      </section>
    );
  }

  if (!event) {
    return (
      <section className="upcoming-card-section glass-panel">
        <div className="ucs-header">
          <div>
            <div className="ucs-eyebrow">Upcoming UFC Card</div>
            <div className="ucs-title">No upcoming events</div>
          </div>
          <button className="btn-sync" onClick={() => load(true)}>
            <i className="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 4px' }}>
          ESPN doesn&apos;t have an upcoming UFC card scheduled.
        </p>
      </section>
    );
  }

  const totalFights = event.fights.length;
  const fightsWithBets = Array.from(existingBetsByFight.keys()).length;

  return (
    <>
      <section className="upcoming-card-section glass-panel">
        <div className="ucs-header">
          <div className="ucs-header-left">
            <div className="ucs-eyebrow">
              <span className="pulse-dot" /> Upcoming UFC Card
            </div>
            <div className="ucs-title">{event.name}</div>
            <div className="ucs-meta">
              <span><i className="fa-regular fa-calendar"></i> {formattedDate}</span>
              <span><i className="fa-solid fa-list-check"></i> {totalFights} fights</span>
              {fightsWithBets > 0 && (
                <span className="text-gold">
                  <i className="fa-solid fa-circle-check"></i> {fightsWithBets} picked
                </span>
              )}
            </div>
          </div>
          <div className="ucs-header-actions">
            <button className="btn-sync" onClick={() => load(true)} title="Refresh from ESPN">
              <i className="fa-solid fa-rotate"></i>
            </button>
            <button className="btn-save ucs-batch-btn" onClick={startBatchMode}>
              <i className="fa-solid fa-bolt"></i> Quick Add All
            </button>
            <button
              className="btn-sync ucs-collapse-btn"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand' : 'Collapse'}
            >
              <i className={`fa-solid ${collapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="ucs-fight-list">
            {event.fights.map((fight) => {
              const picks = existingBetsByFight.get(fight.fightId) ?? [];
              const pickedA = picks.some((p) => p.fighter && fight.fighterA.name.toLowerCase().includes(p.fighter.toLowerCase()));
              const pickedB = picks.some((p) => p.fighter && fight.fighterB.name.toLowerCase().includes(p.fighter.toLowerCase()));
              return (
                <FightRow
                  key={fight.fightId}
                  fight={fight}
                  pickedA={pickedA}
                  pickedB={pickedB}
                  onPick={handlePick}
                />
              );
            })}
          </div>
        )}
      </section>

      {activePick && (
        <QuickBetModal
          event={event}
          fight={activePick.fight}
          pickedSide={activePick.side}
          onClose={() => setActivePick(null)}
          onSaved={() => setActivePick(null)}
        />
      )}

      {batchActive && event.fights[batchIndex] && (
        <BatchModalShell
          event={event}
          fight={event.fights[batchIndex]}
          activePick={batchPick}
          progress={{ current: batchIndex + 1, total: event.fights.length }}
          onPickSide={(side) => setBatchPick({ fight: event.fights[batchIndex], side })}
          onSkip={advanceBatch}
          onClose={() => {
            setBatchActive(false);
            setBatchPick(null);
          }}
          onSaved={advanceBatch}
        />
      )}
    </>
  );
}

function FightRow({
  fight,
  pickedA,
  pickedB,
  onPick,
}: {
  fight: UpcomingFight;
  pickedA: boolean;
  pickedB: boolean;
  onPick: (fight: UpcomingFight, side: 'A' | 'B') => void;
}) {
  const time = fight.scheduledTime
    ? new Date(fight.scheduledTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={`ucs-fight-card ${fight.isMainEvent ? 'is-main' : ''}`}>
      <div className="ucs-fight-meta">
        {fight.isMainEvent && <span className="ucs-tag tag-main">Main Event</span>}
        {fight.isTitleFight && <span className="ucs-tag tag-title">Title</span>}
        {fight.weightClass && <span className="ucs-fight-weight">{fight.weightClass}</span>}
        {time && <span className="ucs-fight-time"><i className="fa-regular fa-clock"></i> {time}</span>}
      </div>
      <div className="ucs-fight-fighters">
        <FighterButton fighter={fight.fighterA} picked={pickedA} onClick={() => onPick(fight, 'A')} side="A" />
        <span className="ucs-vs">VS</span>
        <FighterButton fighter={fight.fighterB} picked={pickedB} onClick={() => onPick(fight, 'B')} side="B" />
      </div>
    </div>
  );
}

function FighterButton({
  fighter,
  picked,
  onClick,
  side,
}: {
  fighter: UpcomingFight['fighterA'];
  picked: boolean;
  onClick: () => void;
  side: 'A' | 'B';
}) {
  return (
    <button
      type="button"
      className={`ucs-fighter-btn side-${side.toLowerCase()} ${picked ? 'picked' : ''}`}
      onClick={onClick}
      title={picked ? 'You already picked this fighter — click to add another bet' : `Bet on ${fighter.name}`}
    >
      <FighterAvatar name={fighter.name} photo={fighter.photo} size={42} />
      <span className="ucs-fighter-info">
        <span className="ucs-fighter-name">{fighter.name}</span>
        {fighter.record && <span className="ucs-fighter-record">{fighter.record}</span>}
      </span>
      {picked && <i className="fa-solid fa-circle-check ucs-picked-icon"></i>}
    </button>
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

/**
 * Batch mode: shows a fight one at a time, user picks a side, then enters odds+stake.
 * If user skips, advances without saving.
 */
function BatchModalShell({
  event,
  fight,
  activePick,
  progress,
  onPickSide,
  onSkip,
  onClose,
  onSaved,
}: {
  event: UpcomingEvent;
  fight: UpcomingFight;
  activePick: ActivePick | null;
  progress: { current: number; total: number };
  onPickSide: (side: 'A' | 'B') => void;
  onSkip: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Step 1: pick side
  if (!activePick || activePick.fight.fightId !== fight.fightId) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card quick-bet-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-title">
            <span>Quick Add ({progress.current}/{progress.total})</span>
            <button className="modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="qbm-context">
            <div className="qbm-event-name">{event.name}</div>
            {fight.weightClass && <div className="qbm-weight">{fight.weightClass}</div>}
          </div>

          <div className="qbm-pick-prompt">Pick a fighter — or skip this one</div>

          <div className="qbm-batch-fighters">
            <button className="ucs-fighter-btn side-a" onClick={() => onPickSide('A')}>
              <FighterAvatar name={fight.fighterA.name} photo={fight.fighterA.photo} size={48} />
              <span className="ucs-fighter-info">
                <span className="ucs-fighter-name">{fight.fighterA.name}</span>
                {fight.fighterA.record && <span className="ucs-fighter-record">{fight.fighterA.record}</span>}
              </span>
            </button>
            <span className="ucs-vs">VS</span>
            <button className="ucs-fighter-btn side-b" onClick={() => onPickSide('B')}>
              <FighterAvatar name={fight.fighterB.name} photo={fight.fighterB.photo} size={48} />
              <span className="ucs-fighter-info">
                <span className="ucs-fighter-name">{fight.fighterB.name}</span>
                {fight.fighterB.record && <span className="ucs-fighter-record">{fight.fighterB.record}</span>}
              </span>
            </button>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-sync" onClick={onSkip}>
              <i className="fa-solid fa-forward"></i> Skip
            </button>
            <button type="button" className="btn-sync" onClick={onClose}>
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: enter odds & stake (delegates to QuickBetModal in batch mode)
  return (
    <QuickBetModal
      event={event}
      fight={fight}
      pickedSide={activePick.side}
      onClose={onClose}
      onSaved={onSaved}
      batchMode
      onAdvance={onSaved}
      onSkip={onSkip}
      progress={progress}
    />
  );
}
