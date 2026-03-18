'use client';

import { useState, useEffect, useCallback } from 'react';
import { upsertFightResult, getFightResults } from '@/services/gradingEngine';
import Toast from '@/components/Toast';
import type { FightResult } from '@/types/fightResult';

const METHODS = ['Decision', 'KO', 'TKO', 'Submission', 'DQ', 'Other'];

export default function AdminResultsPage() {
  // Form state
  const [eventName, setEventName] = useState('');
  const [fightId, setFightId] = useState('');
  const [fighterA, setFighterA] = useState('');
  const [fighterB, setFighterB] = useState('');
  const [winner, setWinner] = useState('');
  const [method, setMethod] = useState('Decision');
  const [endRound, setEndRound] = useState('3');
  const [isCompleted, setIsCompleted] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Existing results list
  const [results, setResults] = useState<FightResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);

  const loadResults = useCallback(async () => {
    try {
      const data = await getFightResults();
      setResults(data);
    } catch {
      // silent
    }
    setLoadingResults(false);
  }, []);

  useEffect(() => { loadResults(); }, [loadResults]);

  // Auto-generate fight_id from fighters
  useEffect(() => {
    if (fighterA && fighterB) {
      const slug = `${fighterA}-vs-${fighterB}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-');
      setFightId(slug);
    }
  }, [fighterA, fighterB]);

  // Set winner when fighters change (convenience)
  useEffect(() => {
    if (winner && winner !== fighterA && winner !== fighterB) {
      setWinner('');
    }
  }, [fighterA, fighterB, winner]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fightId.trim()) newErrors.fightId = 'Fight ID is required';
    if (!fighterA.trim()) newErrors.fighterA = 'Fighter A is required';
    if (!fighterB.trim()) newErrors.fighterB = 'Fighter B is required';
    if (!winner.trim()) newErrors.winner = 'Winner is required';
    if (!eventName.trim()) newErrors.eventName = 'Event name is required';

    // Winner must match one of the fighters
    if (winner && winner !== fighterA && winner !== fighterB) {
      newErrors.winner = 'Winner must be Fighter A or Fighter B';
    }

    // Check if fight_id already exists
    if (fightId && results.some((r) => r.fight_id === fightId)) {
      newErrors.fightId = 'This Fight ID already exists';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await upsertFightResult({
        fight_id: fightId.trim(),
        event_id: eventName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        event_name: eventName.trim(),
        fighter_a: fighterA.trim(),
        fighter_b: fighterB.trim(),
        winner: winner.trim(),
        method,
        end_round: parseInt(endRound) || 0,
        end_time: '',
        is_completed: isCompleted,
      });

      setToast({ message: `Result saved: ${fighterA} vs ${fighterB}`, type: 'success' });

      // Reset form
      setEventName('');
      setFightId('');
      setFighterA('');
      setFighterB('');
      setWinner('');
      setMethod('Decision');
      setEndRound('3');
      setIsCompleted(true);
      setErrors({});

      // Refresh list
      loadResults();
    } catch (err) {
      setToast({ message: 'Failed to save result. Try again.', type: 'error' });
    }
    setSubmitting(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: 'var(--font-ui)',
    outline: 'none',
    transition: 'border-color 200ms',
  };

  const errorStyle: React.CSSProperties = {
    color: 'var(--accent-red)',
    fontSize: 12,
    marginTop: 4,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  return (
    <main className="page-content">
      <div className="page-header">
        <h1 className="page-title">
          <i className="fa-solid fa-clipboard-check" style={{ marginRight: 10, color: 'var(--accent-gold)' }}></i>
          Fight Results
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Insert official fight results for automatic bet grading
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        {/* INSERT FORM */}
        <section className="glass-panel" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            <i className="fa-solid fa-plus" style={{ marginRight: 8, color: 'var(--accent-gold)' }}></i>
            New Result
          </h2>

          <form onSubmit={handleSubmit}>
            {/* Event Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Event Name</label>
              <input
                style={{ ...inputStyle, ...(errors.eventName ? { borderColor: 'var(--accent-red)' } : {}) }}
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g. UFC 310"
              />
              {errors.eventName && <div style={errorStyle}>{errors.eventName}</div>}
            </div>

            {/* Fighters - side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Fighter A</label>
                <input
                  style={{ ...inputStyle, ...(errors.fighterA ? { borderColor: 'var(--accent-red)' } : {}) }}
                  value={fighterA}
                  onChange={(e) => setFighterA(e.target.value)}
                  placeholder="e.g. Islam Makhachev"
                />
                {errors.fighterA && <div style={errorStyle}>{errors.fighterA}</div>}
              </div>
              <div>
                <label style={labelStyle}>Fighter B</label>
                <input
                  style={{ ...inputStyle, ...(errors.fighterB ? { borderColor: 'var(--accent-red)' } : {}) }}
                  value={fighterB}
                  onChange={(e) => setFighterB(e.target.value)}
                  placeholder="e.g. Charles Oliveira"
                />
                {errors.fighterB && <div style={errorStyle}>{errors.fighterB}</div>}
              </div>
            </div>

            {/* Winner selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Winner</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[fighterA, fighterB].filter(Boolean).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setWinner(f)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: winner === f ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${winner === f ? 'rgba(212,175,55,0.4)' : 'var(--border-color)'}`,
                      borderRadius: 8,
                      color: winner === f ? 'var(--accent-gold)' : 'var(--text-muted)',
                      fontSize: 14,
                      fontWeight: winner === f ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 200ms',
                      fontFamily: 'var(--font-ui)',
                    }}
                  >
                    {winner === f && <i className="fa-solid fa-trophy" style={{ marginRight: 6 }}></i>}
                    {f}
                  </button>
                ))}
                {!fighterA && !fighterB && (
                  <span style={{ ...inputStyle, color: 'var(--text-muted)', opacity: 0.5 }}>
                    Enter fighters first...
                  </span>
                )}
              </div>
              {errors.winner && <div style={errorStyle}>{errors.winner}</div>}
            </div>

            {/* Method + Round */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Method</label>
                <select
                  style={inputStyle}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>End Round</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="1"
                  max="5"
                  value={endRound}
                  onChange={(e) => setEndRound(e.target.value)}
                />
              </div>
            </div>

            {/* Fight ID (auto-generated) */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Fight ID (auto-generated)</label>
              <input
                style={{ ...inputStyle, opacity: 0.6, ...(errors.fightId ? { borderColor: 'var(--accent-red)' } : {}) }}
                value={fightId}
                onChange={(e) => setFightId(e.target.value)}
                placeholder="auto-generated from fighters"
              />
              {errors.fightId && <div style={errorStyle}>{errors.fightId}</div>}
            </div>

            {/* Completed toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <button
                type="button"
                onClick={() => setIsCompleted(!isCompleted)}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: 'none',
                  background: isCompleted ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 200ms',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 3,
                    left: isCompleted ? 23 : 3,
                    transition: 'left 200ms',
                  }}
                />
              </button>
              <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                Fight completed
              </span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn-save"
              disabled={submitting}
              style={{ width: '100%', padding: '12px 20px', fontSize: 15 }}
            >
              {submitting ? (
                <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Saving...</>
              ) : (
                <><i className="fa-solid fa-check" style={{ marginRight: 8 }}></i>Save Result</>
              )}
            </button>
          </form>
        </section>

        {/* EXISTING RESULTS LIST */}
        <section className="glass-panel" style={{ padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            <i className="fa-solid fa-list" style={{ marginRight: 8, color: 'var(--accent-gold)' }}></i>
            Recent Results
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
              ({results.length})
            </span>
          </h2>

          {loadingResults ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24 }}></i>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-inbox" style={{ fontSize: 36, marginBottom: 12, display: 'block' }}></i>
              <p style={{ fontSize: 14 }}>No fight results yet.</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Insert your first result using the form.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((r) => (
                <div
                  key={r.fight_id}
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {r.event_name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: r.is_completed ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                        color: r.is_completed ? '#22c55e' : 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {r.is_completed ? 'COMPLETED' : 'PENDING'}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    <span style={{ color: r.winner === r.fighter_a ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                      {r.fighter_a}
                    </span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 8px', fontSize: 12 }}>vs</span>
                    <span style={{ color: r.winner === r.fighter_b ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                      {r.fighter_b}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    <i className="fa-solid fa-trophy" style={{ color: 'var(--accent-gold)', marginRight: 4, fontSize: 10 }}></i>
                    {r.winner} — {r.method} R{r.end_round}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </main>
  );
}
