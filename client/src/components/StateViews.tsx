import type { ReactNode } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" size={26} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <AlertTriangle size={26} aria-hidden="true" />
      <strong>Something went wrong</strong>
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="state">
      {icon}
      <strong>{title}</strong>
      {children && <div className="state-body">{children}</div>}
    </div>
  );
}
