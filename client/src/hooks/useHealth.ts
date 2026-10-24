import { useEffect, useState } from "react";
import { getHealth } from "../api";
import type { Health } from "../types";

export type HealthState = { status: "checking" | "online" | "offline"; health: Health | null };

/** Polls GET /api/health so the top bar shows the real API state. */
export function useHealth(intervalMs = 30000): HealthState {
  const [state, setState] = useState<HealthState>({ status: "checking", health: null });
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const health = await getHealth();
        if (alive) setState({ status: "online", health });
      } catch {
        if (alive) setState({ status: "offline", health: null });
      }
    };
    void check();
    const timer = window.setInterval(check, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [intervalMs]);
  return state;
}
