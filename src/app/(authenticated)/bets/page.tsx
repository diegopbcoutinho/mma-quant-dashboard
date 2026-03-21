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
  const [deleteTarget, setDeleteTarget] = useState<Bet | null>(null);
  const [grading, setGrading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const BETS_PER_PAGE = 20;

  // ── Single dropdown state (page-level) ──
  const [dropdownBetId, setDropdownBetId] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => {
    setDropdownBetId(null);
    setDropdownPos(null);
  }, []);

  // Toggle dropdown — receives the actual clicked element for positioning
  const toggleDropdown = useCallback((betId: string, clickedEl: HTMLElement) => {
    if (dropdownBetId === betId) {
      closeDropdown();
      return;
    }
    const rect = clickedEl.getBoundingClientRect();
    const dropdownH = 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const left = Math.min(rect.left, window.innerWidth - 170);

    if (spaceBelow > dropdownH + 10) {
      setDropdownPos({ top: rect.bottom + 6, left });
    } else {
      setDropdownPos({ top: rect.top - dropdownH - 6, left });
    }
    setDropdownBetId(betId);
  }, [dropdownBetId, closeDropdown]);

  // Close dropdown on outside click / scroll
  useEffect(() => {
    if (!dropdownBetId) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      // Don't close if clicking inside the dropdown itself
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      // Don't close if clicking a result-badge (toggle handles that)
      if (target instanceof HTMLElement && target.closest('.result-badge')) return;
      closeDropdown();
    };
    const handleScroll = () => closeDropdown();
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [dropdownBetId, closeDropdown]);

  // Track rows being animated out (result just changed → leaving current tab)
  const [exitingRows, setExitingRows] = useState<Set<string>>(new Set());
  // Track rows that just got graded (flash effect) — stores betId → result type
  const [flashRows, setFlashRows] = useState<Map<string, 'W' | 'L'>>(new Map());

  // Find the bet for the active dropdown
  const dropdownBet = useMemo(() => {
    if (!dropdownBetId) return null;
    return bets.find((b) => b.id === dropdownBetId) ?? null;
  }, [dropdownBetId, bets]);

  // Handle dropdown result selection
  const handleDropdownSelect = useCallback((result: 'W' | 'L' | '-' | '') => {
    if (!dropdownBet?.id) return;
    const betId = dropdownBet.id;
    const stakeUsd = dropdownBet.stake_usd;
    const odds = dropdownBet.odds;
    closeDropdown();

    // Flash the row with the correct color based on selected result
    if (result === 'W' || result === 'L') {
      setFlashRows(prev => new Map(prev).set(betId, result));
    }

    // After flash, start exit animation
    setTimeout(() => {
      setExitingRows(prev => new Set(prev).add(betId));
      setFlashRows(prev => { const n = new Map(prev); n.delete(betId); return n; });
    }, 400);

    // After exit animation, apply the actual update
    setTimeout(() => {
      updateBetResult(betId, result, stakeUsd, odds);
      setExitingRows(prev => { const n = new Set(prev); n.delete(betId); return n; });
    }, 800);
  }, [dropdownBet, closeDropdown, updateBetResult]);

  // Wrap removeBet with animation
  const handleRemoveBet = useCallback((betId: string) => {
    setExitingRows(prev => new Set(prev).add(betId));
    setTimeout(() => {
      removeBet(betId);
      setExitingRows(prev => { const n = new Set(prev); n.delete(betId); return n; });
    }, 400);
  }, [removeBet]);

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
    if (!search) return tabFiltered;
    const s = search.toLowerCase();
    return tabFiltered.filter(
      (b) =>
        b.fight_name.toLowerCase().includes(s) ||
        b.event_name.toLowerCase().includes(s)
    );
  }, [tabFiltered, search]);

  // Reset to page 1 when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [currentTab, search]);

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
      handleRemoveBet(deleteTarget.id);
    }
    setDeleteTarget(null);
  }, [deleteTarget, handleRemoveBet]);


  // Share card handler
  const handleShare = useCallback((b: Bet) => {
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
  }, []);

  // Dropdown button style
  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '10px 14px', background: 'transparent',
    border: 'none', fontSize: 13, cursor: 'pointer',
    textAlign: 'left', borderRadius: 6, fontFamily: 'var(--font-ui)',
    fontWeight: 500,
  };

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
          <>
          {/* ── Mobile Card Layout ── */}
          <div className="bets-mobile-cards">
            {filtered.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>No bets found for this tab.</p>
            ) : paginatedBets.map((b, i) => {
              const isExiting = b.id ? exitingRows.has(b.id) : false;
              const flashResult = b.id ? flashRows.get(b.id) : undefined;
              let plClass = '';
              let plText = b.pl_usd ? fmt(b.pl_usd) : '--';
              if (b.result === 'W') { plClass = 'text-gold'; plText = '+' + fmt(b.pl_usd); }
              else if (b.result === 'L') { plClass = 'text-red'; plText = fmt(b.pl_usd); }

              return (
                <div
                  key={b.id || i}
                  className={`bet-mobile-card bet-row ${isExiting ? 'bet-row-exit' : ''} ${flashResult === 'W' ? 'bet-row-flash-win' : flashResult === 'L' ? 'bet-row-flash-loss' : ''}`}
                >
                  <div className="bmc-top">
                    <div className="bmc-fight">{b.fight_name || '--'}</div>
                    <BadgeOnly
                      bet={b}
                      isActive={dropdownBetId === b.id}
                      onToggle={(el) => b.id && toggleDropdown(b.id, el)}
                    />
                  </div>
                  <div className="bmc-event">{b.event_name || '--'}</div>
                  <div className="bmc-stats">
                    <div className="bmc-stat">
                      <span className="bmc-stat-label">Odds</span>
                      <span className="bmc-stat-value">{b.odds > 0 ? b.odds.toFixed(3) : '--'}</span>
                    </div>
                    <div className="bmc-stat">
                      <span className="bmc-stat-label">Stake</span>
                      <span className="bmc-stat-value">{fmt(b.stake_usd)}</span>
                    </div>
                    {isFinishedTab && (
                      <div className="bmc-stat">
                        <span className="bmc-stat-label">P/L</span>
                        <span className={`bmc-stat-value ${plClass}`}>{plText}</span>
                      </div>
                    )}
                    <div className="bmc-stat">
                      <span className="bmc-stat-label">Date</span>
                      <span className="bmc-stat-value" style={{ fontSize: 12 }}>{b.date || '--'}</span>
                    </div>
                  </div>
                  <div className="bmc-actions">
                    {(b.result === 'W' || b.result === 'L') && (
                      <button onClick={() => handleShare(b)} className="bmc-action-btn" title="Share">
                        <i className="fa-solid fa-share-from-square"></i>
                      </button>
                    )}
                    <button onClick={() => setEditingBet(b)} className="bmc-action-btn" title="Edit">
                      <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button onClick={() => setDeleteTarget(b)} className="bmc-action-btn bmc-action-delete" title="Delete">
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Desktop Table Layout ── */}
          <div className="bets-desktop-table table-responsive">
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

                    const isExiting = b.id ? exitingRows.has(b.id) : false;
                    const flashResult = b.id ? flashRows.get(b.id) : undefined;

                    return (
                      <tr
                        key={b.id || i}
                        className={`bet-row ${isExiting ? 'bet-row-exit' : ''} ${flashResult === 'W' ? 'bet-row-flash-win' : flashResult === 'L' ? 'bet-row-flash-loss' : ''}`}
                      >
                        <td>{b.date || '--'}</td>
                        <td className="td-event">{b.event_name || '--'}</td>
                        <td className="fighter-name">{b.fight_name || '--'}</td>
                        <td>{b.odds > 0 ? b.odds.toFixed(3) : '--'}</td>
                        <td>{fmt(b.stake_usd)}</td>
                        <td>
                          <BadgeOnly
                            bet={b}
                            isActive={dropdownBetId === b.id}
                            onToggle={(el) => b.id && toggleDropdown(b.id, el)}
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
                          <div className="action-btns">
                            {(b.result === 'W' || b.result === 'L') && (
                              <button onClick={() => handleShare(b)} className="action-icon-btn" title="Share card">
                                <i className="fa-solid fa-share-from-square"></i>
                              </button>
                            )}
                            <button onClick={() => setEditingBet(b)} className="action-icon-btn" title="Edit">
                              <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onClick={() => setDeleteTarget(b)} className="action-icon-btn action-icon-delete" title="Delete">
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
          </>
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

      {/* ── Single Result Dropdown (page-level portal) ── */}
      {dropdownBetId && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            background: 'rgba(15, 15, 18, 0.98)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: 6,
            zIndex: 9999,
            minWidth: 150,
            maxWidth: 'calc(100vw - 32px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
            backdropFilter: 'blur(12px)',
            animation: 'fadeInScale 150ms ease',
          }}
        >
          <button
            onClick={() => handleDropdownSelect('W')}
            className="result-dropdown-btn result-dropdown-win"
            style={btnStyle}
          >
            <i className="fa-solid fa-check"></i> WIN
          </button>
          <button
            onClick={() => handleDropdownSelect('L')}
            className="result-dropdown-btn result-dropdown-loss"
            style={btnStyle}
          >
            <i className="fa-solid fa-xmark"></i> LOSS
          </button>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }}></div>
          <button
            onClick={() => handleDropdownSelect('-')}
            className="result-dropdown-btn result-dropdown-pending"
            style={btnStyle}
          >
            <i className="fa-solid fa-clock"></i> PENDING
          </button>
        </div>,
        document.body
      )}

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

/** Badge-only component — passes the clicked element back for positioning */
function BadgeOnly({
  bet,
  isActive,
  onToggle,
}: {
  bet: Bet;
  isActive: boolean;
  onToggle: (el: HTMLElement) => void;
}) {
  const isAutoGraded = !!bet.graded_at;

  let badgeClass = 'badge-pending';
  let badgeText = 'PENDING';
  if (bet.result === 'W') { badgeClass = 'badge-win'; badgeText = 'WIN'; }
  else if (bet.result === 'L') { badgeClass = 'badge-loss'; badgeText = 'LOSS'; }
  else if (bet.result === '') { badgeText = 'TO DO'; }

  return (
    <span
      className={`result-badge ${badgeClass} ${isActive ? 'result-badge-active' : ''}`}
      style={{ cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
      onClick={(e) => onToggle(e.currentTarget)}
      title={isAutoGraded ? 'Auto graded by FightEdge — Click to change' : 'Click to change result'}
    >
      {badgeText}
      {isAutoGraded && <i className="fa-solid fa-robot" style={{ fontSize: 9, opacity: 0.5 }} title="Auto graded by FightEdge"></i>}
      <i className="fa-solid fa-caret-down" style={{ fontSize: 9, opacity: 0.5 }}></i>
    </span>
  );
}
