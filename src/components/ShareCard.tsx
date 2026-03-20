'use client';

import { useState, useCallback } from 'react';
import { useBetsStore } from '@/stores/useBetsStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { calculateFightEdgeScore } from '@/services/scoreEngine';
import {
  generateShareCard,
  downloadShareCard,
  dataUrlToBlob,
  type ShareCardData,
} from '@/services/shareCardGenerator';
import { supabase } from '@/lib/supabaseClient';

/**
 * ShareCard — Generates and previews a social performance card.
 * Placed on the dashboard, allows download and optional public snapshot storage.
 */
export default function ShareCard() {
  const { bets, metrics, settings } = useBetsStore();
  const { user } = useAuthStore();
  const [preview, setPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const score = calculateFightEdgeScore(bets, settings);

  const handleGenerate = useCallback(() => {
    if (!score || !metrics) return;
    setGenerating(true);

    // Small delay for UI feedback
    requestAnimationFrame(() => {
      const data: ShareCardData = {
        score: score.total,
        breakdown: score,
        roi: metrics.roi,
        profit: metrics.totalProfit,
        winRate: metrics.winRate,
        wins: metrics.wins,
        losses: metrics.losses,
        totalBets: metrics.totalBets,
        currentBankroll: metrics.currentBankroll,
      };

      const img = generateShareCard(data);
      setPreview(img);
      setGenerating(false);
      setSaved(false);
      setShareUrl(null);
    });
  }, [score, metrics]);

  const handleDownload = useCallback(() => {
    if (preview) downloadShareCard(preview);
  }, [preview]);

  const handleSaveSnapshot = useCallback(async () => {
    if (!preview || !user || !score || !metrics) return;
    setSaved(true);

    try {
      // Upload image to Supabase Storage
      const blob = dataUrlToBlob(preview);
      const filename = `${user.id}/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('share-cards')
        .upload(filename, blob, { contentType: 'image/png', upsert: true });

      if (uploadError) {
        // Storage bucket may not exist — save metadata only
        console.warn('Storage upload skipped:', uploadError.message);
      }

      // Save snapshot metadata to database
      const { data, error } = await supabase
        .from('share_snapshots')
        .insert({
          user_id: user.id,
          score: score.total,
          roi: metrics.roi,
          profit: metrics.totalProfit,
          win_rate: metrics.winRate,
          wins: metrics.wins,
          losses: metrics.losses,
          total_bets: metrics.totalBets,
          image_path: filename,
        })
        .select('id')
        .single();

      if (!error && data) {
        const url = `${window.location.origin}/share/${data.id}`;
        setShareUrl(url);
      }
    } catch {
      console.error('Failed to save snapshot');
    }
  }, [preview, user, score, metrics]);

  // Not enough data for score
  if (!score) return null;

  return (
    <section className="glass-panel" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 16,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          margin: 0,
        }}>
          Share Performance
        </h2>
        <button
          className="btn-save"
          onClick={handleGenerate}
          disabled={generating}
          style={{ fontSize: 13, padding: '8px 16px' }}
        >
          <i className="fa-solid fa-image" style={{ marginRight: 6 }}></i>
          {generating ? 'Generating...' : preview ? 'Regenerate' : 'Generate Card'}
        </button>
      </div>

      {!preview && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
          Generate a shareable performance card with your FightEdge Score and key metrics.
        </p>
      )}

      {preview && (
        <div>
          {/* Preview */}
          <div style={{
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 16,
          }}>
            <img
              src={preview}
              alt="FightEdge Performance Card"
              style={{ width: '100%', display: 'block' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-save" onClick={handleDownload} style={{ fontSize: 13, padding: '8px 16px' }}>
              <i className="fa-solid fa-download" style={{ marginRight: 6 }}></i>
              Download PNG
            </button>

            <button
              className="btn-sync"
              onClick={handleSaveSnapshot}
              disabled={saved}
              style={{ fontSize: 13, padding: '8px 16px' }}
            >
              <i className={`fa-solid ${saved ? 'fa-check' : 'fa-cloud-arrow-up'}`} style={{ marginRight: 6 }}></i>
              {saved ? 'Saved!' : 'Save Snapshot'}
            </button>

            {shareUrl && (
              <button
                className="btn-sync"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                }}
                style={{ fontSize: 13, padding: '8px 16px' }}
              >
                <i className="fa-solid fa-link" style={{ marginRight: 6 }}></i>
                Copy Link
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
