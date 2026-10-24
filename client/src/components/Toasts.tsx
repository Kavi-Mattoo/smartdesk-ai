import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

type ToastKind = "success" | "error";
interface ToastInput {
  kind: ToastKind;
  message: string;
  href?: string;
  linkLabel?: string;
}
interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<{ notify: (toast: ToastInput) => void }>({ notify: () => {} });
export const useToast = () => useContext(ToastContext);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), []);
  const notify = useCallback(
    (toast: ToastInput) => {
      const id = nextId++;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      window.setTimeout(() => dismiss(id), toast.kind === "error" ? 8000 : 5000);
    },
    [dismiss]
  );
  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
            {toast.kind === "error" ? <AlertTriangle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
            <span className="toast-message">
              {toast.message}
              {toast.href && (
                <>
                  {" "}
                  <a href={toast.href} onClick={() => dismiss(toast.id)}>
                    {toast.linkLabel ?? "View"}
                  </a>
                </>
              )}
            </span>
            <button type="button" className="icon-button" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
