'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBetsStore } from '@/stores/useBetsStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { fmt } from '@/lib/helpers';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import BetModal from '@/components/NewBetModal';
import ConfirmModal from '@/components/ConfirmModal';
import Toast from '@/components/Toast';
import { generateBetCard, downloadShareCard, type BetCardData } from '@/services/shareCardGenerator';
import type { Bet } from '@/types';

type Tab = 'finished' | 'future';

/** Export bets as CSV */
function exportBetsCSV(bets: Bet[]) {
  const headers = ['Date', 'Event', 'Fight', 'Fighter', 'Opponent', 'Odds', 'Stake', 'Result', 'P/L'];
  const rows = bets.map((b) => [
    b.date,
    b.event_name,
    b.fight_name,
    b.fighter,
    b.opponent,
    b.odds.toFixed(3),
    b.stake_usd.toFixed(2),
    b.result === 'W' ? 'Win' : b.result === 'L' ? 'Loss' : 'Pending',
    b.pl_usd.toFixed(2),
  ]);

  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `fightedge-bets-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BetsPage() {
  const { bets, loading, currentTab, setCurrentTab, updateBetResult, removeBet, gradePendingBets, metrics } = useBetsStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBet, setEditingBet] = useState<Bet | null>(null);
  const [editingBetId, setEditingBetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bet | null>(null);
  const [grading, setGrading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const BETS_PER_PAGE = 20;

  const handleGradeResults = useCallback(async () => {
    if (!user || grading) return;
    setGrading(true);
    try {
      const summary = await gradePendingBets(user.id);
      if (summary.totalGraded > 0) {
        setToast({
          message: `${summary.totalGraded} bet${summary.totalGraded > 1 ? 's' : ''} graded automatically.`,
          type: 'success',
        });
      } else if (summary.totalChecked > 0) {
        setToast({ message: 'No completed fights found for your pending bets.', type: 'info' });
      } else {
        setToast({ message: 'No pending bets to check.', type: 'info' });
      }
    } catch {
      setToast({ message: 'Failed to check results. Try again.', type: 'error' });
    }
    setGrading(false);
  }, [user, grading, gradePendingBets]);

  const tabFiltered = useMemo(() => {
    return bets
      .filter((b) => {
        const isFinished = b.result === 'W' || b.result === 'L';
        const isFuture = b.result === '-' || b.result === '';

        if (currentTab === 'finished') return isFinished;
        if (currentTab === 'future') return isFuture;
        return true;
      })
      .sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da; // newest first in table
      });
  }, [bets, currentTab]);

  const filtered = useMemo(() => {
    // Reset to page 1 when data changes
    setCurrentPage(1);
    if (!search) return tabFiltered;
    const s = search.toLowerCase();
    return tabFiltered.filter(
      (b) =>
        b.fight_name.toLowerCase().includes(s) ||
        b.event_name.toLowerCase().includes(s)
    );
  }, [tabFiltered, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / BETS_PER_PAGE));
  const paginatedBets = filtered.slice(
    (currentPage - 1) * BETS_PER_PAGE,
    currentPage * BETS_PER_PAGE
  );

  const futureTotal = useMemo(() => {
    if (currentTab !== 'future') return null;
    const totalStake = tabFiltered.reduce((s, b) => s + b.stake_usd, 0);
    const totalProfit = tabFiltered.reduce(
      (s, b) => s + b.stake_usd * (b.odds - 1),
      0
    );
    return { totalStake, totalProfit, count: tabFiltered.length };
  }, [tabFiltered, currentTab]);

  // Map betId → bankrollAfter from the metrics timeline
  const bankrollMap = useMemo(() => {
    const map = new Map<string, number>();
    if (metrics?.timeline?.entries) {
      for (const entry of metrics.timeline.entries) {
        map.set(entry.betId, entry.bankrollAfter);
      }
    }
    return map;
  }, [metrics]);

  const isFinishedTab = currentTab === 'finished';
  const tabs: { id: Tab; label: string }[] = [
    { id: 'finished', label: 'Recent Bets' },
    { id: 'future', label: 'Upcoming Bets' },
  ];

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget?.id) {
      removeBet(deleteTarget.id);
    }
    setDeleteTarget(null);
  }, [deleteTarget, removeBet]);

  return (
    <main className="page-content">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="page-title">Bets</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn-sync"
            onClick={handleGradeResults}
            disabled={grading}
            title="Auto-grade pending bets using fight results"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <i className={`fa-solid fa-rotate ${grading ? 'fa-spin' : ''}`}></i>
            {grading ? 'Checking...' : 'Check Results'}
          </button>
          <button
            className="btn-sync"
            onClick={() => exportBetsCSV(bets)}
            title="Export CSV"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <i className="fa-solid fa-file-csv"></i>
            Export
          </button>
          <button className="btn-save" onClick={() => setShowModal(true)}>
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }}></i>
            New Bet
          </button>
        </div>
      </div>

      <section className="fights-section glass-panel">
        <div className="panel-header">
          <div className="tabs-container">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn ${currentTab === tab.id ? 'active' : ''}`}
                onClick={() => setCurrentTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="table-filters">
            <input
              type="text"
              placeholder="Search fighter or event..."
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Future summary bar */}
        {futureTotal && (
          <div className="future-summary-bar">
            <div className="future-summary-item">
              <span className="future-summary-label">
                <i className="fa-solid fa-coins"></i> Total Staked
              </span>
              <span className="future-summary-value">{fmt(futureTotal.totalStake)}</span>
            </div>
            <div className="future-summary-item">
              <span className="future-summary-label">
                <i className="fa-solid fa-arrow-trend-up"></i> Potential Profit
              </span>
              <span className="future-summary-value text-gold">
                +{fmt(futureTotal.totalProfit)}
              </span>
            </div>
            <div className="future-summary-item">
              <span className="future-summary-label">
                <i className="fa-solid fa-list-check"></i> Bets
              </span>
              <span className="future-summary-value">{futureTotal.count}</span>
            </div>
          </div>
        )}

        {loading ? (
          <TableSkeleton />
        ) : bets.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <i className="fa-solid fa-receipt" style={{ fontSize: 48, color: 'var(--text-muted)', marginBottom: 16 }}></i>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
              No bets recorded yet.
            </p>
            <button className="btn-save" onClick={() => setShowModal(true)}>
              <i className="fa-solid fa-plus" style={{ marginRight: 6 }}></i>
              Create First Bet
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event</th>
                  <th>Fight</th>
                  <th>Odds</th>
                  <th>Stake</th>
                  <th>Result</th>
                  {isFinishedTab && (
                    <>
                      <th>P/L</th>
                      <th>Bankroll</th>
                    </>
                  )}
                  <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isFinishedTab ? 9 : 7}
                      style={{ textAlign: 'center', color: 'var(--text-muted)' }}
                    >
                      No bets found for this tab.
                    </td>
                  </tr>
                ) : (
                  paginatedBets.map((b, i) => {
                    let plClass = '';
                    let plText = b.pl_usd ? fmt(b.pl_usd) : '--';

                    if (b.result === 'W') {
                      plClass = 'text-gold';
                      plText = '+' + fmt(b.pl_usd);
                    } else if (b.result === 'L') {
                      plClass = 'text-red';
                      plText = fmt(b.pl_usd);
                    }

                    return (
                      <tr key={b.id || i}>
                        <td>{b.date || '--'}</td>
                        <td
                          style={{
                            color: 'var(--text-muted)',
                            maxWidth: 180,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {b.event_name || '--'}
                        </td>
                        <td className="fighter-name">{b.fight_name || '--'}</td>
                        <td>{b.odds > 0 ? b.odds.toFixed(3) : '--'}</td>
                        <td>{fmt(b.stake_usd)}</td>
                        <td style={{ position: 'relative' }}>
                          <ResultBadge
                            bet={b}
                            isEditing={editingBetId === b.id}
                            onToggle={() => setEditingBetId(editingBetId === b.id ? null : (b.id ?? null))}
                            onSelect={(result) => {
                              if (b.id) updateBetResult(b.id, result, b.stake_usd, b.odds);
                              setEditingBetId(null);
                            }}
                          />
                        </td>
                        {isFinishedTab && (
                          <>
                            <td className={plClass}>{plText}</td>
                            <td>
                              {b.id && bankrollMap.has(b.id) ? fmt(bankrollMap.get(b.id)!) : '--'}
                            </td>
                          </>
                        )}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            {(b.result === 'W' || b.result === 'L') && (
                              <button
                                onClick={() => {
                                  const cardData: BetCardData = {
                                    event: b.event_name || '',
                                    fight: b.fight_name || '',
                                    fighter: b.fighter || '',
                                    opponent: b.opponent || '',
                                    odds: b.odds,
                                    stake: b.stake_usd,
                                    result: b.result as 'W' | 'L',
                                    pl: b.pl_usd,
                                    date: b.date || '',
                                  };
                                  const img = generateBetCard(cardData);
                                  downloadShareCard(img, `FightEdge_${(b.fight_name || 'bet').replace(/[^a-zA-Z0-9]/g, '_')}.png`);
                                }}
                                title="Share card"
                                style={{
                                  background: 'transparent', border: '1px solid var(--border-color)',
                                  color: 'var(--text-muted)', width: 30, height: 30, borderRadius: 6,
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 12, transition: 'color 200ms, border-color 200ms',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-gold)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                              >
                                <i className="fa-solid fa-share-from-square"></i>
                              </button>
                            )}
                            <button
                              onClick={() => setEditingBet(b)}
                              title="Edit"
                              style={{
                                background: 'transparent', border: '1px solid var(--border-color)',
                                color: 'var(--text-muted)', width: 30, height: 30, borderRadius: 6,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, transition: 'color 200ms, border-color 200ms',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-gold)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            >
                              <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(b)}
                              title="Delete"
                              style={{
                                background: 'transparent', border: '1px solid var(--border-color)',
                                color: 'var(--text-muted)', width: 30, height: 30, borderRadius: 6,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, transition: 'color 200ms, border-color 200ms',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.borderColor = 'rgba(230,57,70,0.4)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filtered.length > BETS_PER_PAGE && (
          <div className="pagination-bar">
            <span className="pagination-info">
              Showing {(currentPage - 1) * BETS_PER_PAGE + 1}–{Math.min(currentPage * BETS_PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <i className="fa-solid fa-angles-left"></i>
              </button>
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                let page: number;
                if (totalPages <= 5) {
                  page = idx + 1;
                } else if (currentPage <= 3) {
                  page = idx + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + idx;
                } else {
                  page = currentPage - 2 + idx;
                }
                return (
                  <button
                    key={page}
                    className={`pagination-btn pagination-num ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                className="pagination-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <i className="fa-solid fa-angles-right"></i>
              </button>
            </div>
          </div>
        )}
      </section>

      {showModal && <BetModal onClose={() => setShowModal(false)} />}
      {editingBet && <BetModal editBet={editingBet} onClose={() => setEditingBet(null)} />}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Bet"
          message={`Are you sure you want to delete the bet "${deleteTarget.fight_name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}

/** Clickable result badge — dropdown via portal */
function ResultBadge({
  bet,
  isEditing,
  onToggle,
  onSelect,
}: {
  bet: { result: string; id?: string };
  isEditing: boolean;
  onToggle: () => void;
  onSelect: (result: 'W' | 'L' | '-' | '') => void;
}) {
  const badgeRef = useRef<HTMLSpanElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isEditing && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setPos({ top: rect.top - 6, left: rect.left });
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: MouseEvent) => {
      if (
        badgeRef.current && !badgeRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        onToggle();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isEditing, onToggle]);

  // Access graded_at from the full bet object if available
  const fullBet = bet as Bet;
  const isAutoGraded = !!fullBet.graded_at;

  let badgeClass = 'badge-pending';
  let badgeText = 'PENDING';
  if (bet.result === 'W') { badgeClass = 'badge-win'; badgeText = 'WIN'; }
  else if (bet.result === 'L') { badgeClass = 'badge-loss'; badgeText = 'LOSS'; }
  else if (bet.result === '') { badgeText = 'TO DO'; }

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '10px 14px', background: 'transparent',
    border: 'none', fontSize: 13, cursor: 'pointer',
    textAlign: 'left', borderRadius: 6, fontFamily: 'var(--font-ui)',
    fontWeight: 500,
  };

  const dropdown = isEditing
    ? createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: 'translateY(-100%)',
            background: 'rgba(15, 15, 18, 0.98)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: 6,
            zIndex: 9999,
            minWidth: 150,
            boxShadow: '0 -8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <button
            onClick={() => onSelect('W')}
            style={{ ...btnStyle, color: 'var(--accent-gold)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(212,175,55,0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <i className="fa-solid fa-check"></i> WIN
          </button>
          <button
            onClick={() => onSelect('L')}
            style={{ ...btnStyle, color: 'var(--accent-red)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(230,57,70,0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <i className="fa-solid fa-xmark"></i> LOSS
          </button>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }}></div>
          <button
            onClick={() => onSelect('-')}
            style={{ ...btnStyle, color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <i className="fa-solid fa-clock"></i> PENDING
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <span
        ref={badgeRef}
        className={`result-badge ${badgeClass}`}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={onToggle}
        title={isAutoGraded ? 'Auto graded by FightEdge — Click to change' : 'Click to change result'}
      >
        {badgeText}
        {isAutoGraded && <i className="fa-solid fa-robot" style={{ fontSize: 9, marginLeft: 4, opacity: 0.5 }} title="Auto graded by FightEdge"></i>}
        {' '}<i className="fa-solid fa-caret-down" style={{ fontSize: 10, marginLeft: 2, opacity: 0.6 }}></i>
      </span>
      {dropdown}
    </>
  );
}
