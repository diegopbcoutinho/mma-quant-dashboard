'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBetsStore } from '@/stores/useBetsStore';
import {
  parseCSVFile,
  convertToBets,
  downloadCSVTemplate,
  type CSVParseResult,
  type ParsedRow,
} from '@/services/csvImportService';

interface ImportCSVModalProps {
  onClose: () => void;
  onComplete: (imported: number, skipped: number) => void;
}

export default function ImportCSVModal({ onClose, onComplete }: ImportCSVModalProps) {
  const { user } = useAuthStore();
  const { addBet } = useBetsStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setParseResult({
        rows: [], validCount: 0, invalidCount: 0,
        headerError: 'Please upload a .csv file.',
      });
      setStep('preview');
      return;
    }
    const result = await parseCSVFile(file);
    setParseResult(result);
    setStep('preview');
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = useCallback(async () => {
    if (!user || !parseResult) return;
    setImporting(true);

    const betData = convertToBets(parseResult.rows);
    let imported = 0;

    for (const bet of betData) {
      try {
        await addBet(user.id, bet);
        imported++;
      } catch {
        // Skip failed rows silently
      }
    }

    setImporting(false);
    onComplete(imported, parseResult.invalidCount);
    onClose();
  }, [user, parseResult, addBet, onComplete, onClose]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setParseResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 620, width: '95vw' }}>
        <div className="modal-title">
          <span><i className="fa-solid fa-file-import" style={{ marginRight: 8 }}></i>Import CSV</span>
          <button className="modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {step === 'upload' && (
          <div style={{ padding: '8px 0' }}>
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--gold)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 12,
                padding: '40px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(212,175,55,0.05)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              <i className="fa-solid fa-cloud-arrow-up" style={{
                fontSize: 36, color: dragOver ? 'var(--gold)' : 'var(--text-muted)',
                marginBottom: 12, display: 'block',
              }}></i>
              <p style={{ color: 'var(--text-primary)', fontSize: 14, margin: '0 0 4px' }}>
                Drop your CSV file here or <span style={{ color: 'var(--gold)', textDecoration: 'underline' }}>browse</span>
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
                Only .csv files are supported
              </p>
            </div>

            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange}
              style={{ display: 'none' }} />

            {/* Instructions */}
            <div style={{
              margin: '16px 0 0',
              padding: '14px 16px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 8px', lineHeight: 1.5 }}>
                Upload your bets using the template format. Only moneyline bets are supported.
                Required columns: <strong style={{ color: 'var(--text-primary)' }}>event_name, fighter_a, fighter_b, selection, odds, stake</strong>.
                Optional: <strong style={{ color: 'var(--text-primary)' }}>date, result</strong>.
              </p>
              <button onClick={(e) => { e.stopPropagation(); downloadCSVTemplate(); }}
                style={{
                  background: 'none', border: 'none', color: 'var(--gold)',
                  fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'var(--font-ui)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <i className="fa-solid fa-download"></i> Download CSV Template
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && parseResult && (
          <div style={{ padding: '8px 0' }}>
            {parseResult.headerError ? (
              <div style={{
                padding: '20px 16px', background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, textAlign: 'center',
              }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ color: '#ef4444', fontSize: 24, marginBottom: 8, display: 'block' }}></i>
                <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{parseResult.headerError}</p>
              </div>
            ) : (
              <>
                {/* Summary bar */}
                <div style={{
                  display: 'flex', gap: 12, marginBottom: 12,
                }}>
                  {parseResult.validCount > 0 && (
                    <div style={{
                      flex: 1, padding: '10px 14px', borderRadius: 8,
                      background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                      textAlign: 'center',
                    }}>
                      <div style={{ color: '#22c55e', fontSize: 20, fontWeight: 700 }}>{parseResult.validCount}</div>
                      <div style={{ color: '#22c55e', fontSize: 11, opacity: 0.8 }}>Ready to import</div>
                    </div>
                  )}
                  {parseResult.invalidCount > 0 && (
                    <div style={{
                      flex: 1, padding: '10px 14px', borderRadius: 8,
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                      textAlign: 'center',
                    }}>
                      <div style={{ color: '#ef4444', fontSize: 20, fontWeight: 700 }}>{parseResult.invalidCount}</div>
                      <div style={{ color: '#ef4444', fontSize: 11, opacity: 0.8 }}>Will be skipped</div>
                    </div>
                  )}
                </div>

                {/* Preview table */}
                <div style={{
                  maxHeight: 300, overflowY: 'auto', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>Event</th>
                        <th style={thStyle}>Fight</th>
                        <th style={thStyle}>Pick</th>
                        <th style={thStyle}>Odds</th>
                        <th style={thStyle}>Stake</th>
                        <th style={thStyle}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.rows.map((r, i) => (
                        <PreviewRow key={i} parsed={r} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn-sync" onClick={handleReset}>
                <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }}></i> Back
              </button>
              {parseResult.validCount > 0 && !parseResult.headerError && (
                <button className="btn-save" onClick={handleImport} disabled={importing}>
                  {importing ? (
                    <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Importing...</>
                  ) : (
                    <><i className="fa-solid fa-file-import" style={{ marginRight: 6 }}></i>Import {parseResult.validCount} Bet{parseResult.validCount > 1 ? 's' : ''}</>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  color: 'var(--text-muted)',
  fontWeight: 500,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  position: 'sticky',
  top: 0,
  background: 'rgb(15, 15, 18)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

function PreviewRow({ parsed }: { parsed: ParsedRow }) {
  const { row, valid, errors } = parsed;
  const bg = valid ? 'transparent' : 'rgba(239,68,68,0.04)';

  return (
    <tr style={{ background: bg, borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      title={!valid ? errors.join(', ') : undefined}>
      <td style={tdStyle}>
        {valid ? (
          <i className="fa-solid fa-check" style={{ color: '#22c55e', fontSize: 10 }}></i>
        ) : (
          <i className="fa-solid fa-xmark" style={{ color: '#ef4444', fontSize: 10 }}></i>
        )}
      </td>
      <td style={tdStyle}>{row.event_name || '--'}</td>
      <td style={tdStyle}>{row.fighter_a && row.fighter_b ? `${row.fighter_a} vs ${row.fighter_b}` : '--'}</td>
      <td style={{ ...tdStyle, color: 'var(--gold)', fontWeight: 500 }}>{row.selection || '--'}</td>
      <td style={tdStyle}>{row.odds > 0 ? row.odds.toFixed(3) : '--'}</td>
      <td style={tdStyle}>${row.stake > 0 ? row.stake.toFixed(2) : '--'}</td>
      <td style={tdStyle}>
        {!valid ? (
          <span style={{ color: '#ef4444', fontSize: 10 }}>{errors[0]}</span>
        ) : (
          <span style={{ color: '#22c55e', fontSize: 10 }}>OK</span>
        )}
      </td>
    </tr>
  );
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  color: 'var(--text-primary)',
  fontSize: 12,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 120,
};
