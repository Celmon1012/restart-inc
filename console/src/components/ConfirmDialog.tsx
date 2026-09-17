import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Shared confirmation step for anything high-impact or hard to reverse --
// redeploys, key rotation/revocation, disabling 2FA, signing out other
// sessions. Routine actions (reveal, copy) skip this entirely; this is only
// for the ones the console review flagged as too easy to trigger by
// accident given how close they sit to safe, everyday controls.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={() => !busy && onCancel()}>
      <div className="confirm-dialog-card" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className={`confirm-dialog-icon ${tone}`}>
          <AlertTriangle size={18} />
        </div>
        <h3>{title}</h3>
        <div className="confirm-dialog-body">{description}</div>
        <div className="confirm-dialog-actions">
          <button type="button" className="console-btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? "console-btn-danger" : "console-btn-primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
