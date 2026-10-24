import { LoaderCircle } from "lucide-react";
import { Dialog } from "./Dialog";

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel
}: {
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog labelId="confirm-title" onClose={() => !busy && onCancel()}>
      <h2 id="confirm-title" className="dialog-title">
        {title}
      </h2>
      <p className="dialog-text">{message}</p>
      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy} data-autofocus>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {busy && <LoaderCircle className="spin" size={16} aria-hidden="true" />} {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
