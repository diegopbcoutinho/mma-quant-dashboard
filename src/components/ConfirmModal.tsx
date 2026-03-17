'use client';

/**
 * ConfirmModal — Sprint 1.5 Data Safety
 *
 * Generic confirmation modal for destructive actions.
 * Used for bet deletion to prevent accidental data loss.
 */

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 400 }}
      >
        <div className="modal-title">
          <span>
            <i
              className={`fa-solid ${danger ? 'fa-triangle-exclamation' : 'fa-circle-question'}`}
              style={{ marginRight: 8, color: danger ? 'var(--accent-red)' : 'var(--accent-gold)' }}
            ></i>
            {title}
          </span>
          <button className="modal-close" onClick={onCancel}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, margin: '16px 0 24px' }}>
          {message}
        </p>

        <div className="modal-actions">
          <button type="button" className="btn-sync" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn-save"
            onClick={onConfirm}
            style={
              danger
                ? { background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }
                : undefined
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
