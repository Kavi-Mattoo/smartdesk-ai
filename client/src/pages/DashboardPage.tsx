import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Inbox, RefreshCw, Ticket } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage, getStats, isAbort } from "../api";
import { PriorityBadge, StatusBadge } from "../components/Badges";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { ticketHref } from "../hooks/useRoute";
import type { Stats } from "../types";
import { timeAgo } from "../utils";

function StatCard({ label, value, note, icon, tone }: { label: string; value: number; note: string; icon: ReactNode; tone: string }) {
  return (
    <div className="stat-card">
      <span className={`stat-icon tone-${tone}`}>{icon}</span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        <div className="stat-note">{note}</div>
      </div>
    </div>
  );
}

export default function DashboardPage({ version, onCreate }: { version: number; onCreate: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getStats(controller.signal)
      .then(setStats)
      .catch((e) => {
        if (!isAbort(e)) setError(errorMessage(e, "Could not load the dashboard."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [version, reload]);

  const retry = useCallback(() => setReload((n) => n + 1), []);

  if (loading && !stats) return <LoadingState label="Loading dashboard..." />;
  if (error && !stats) return <ErrorState message={error} onRetry={retry} />;
  if (!stats) return null;

  const segments = [
    { key: "open", label: "Open", value: stats.open },
    { key: "in-progress", label: "In progress", value: stats.inProgress },
    { key: "resolved", label: "Resolved", value: stats.resolved }
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">A live summary of your support queue.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={retry} disabled={loading}>
          <RefreshCw size={16} className={loading ? "spin" : undefined} aria-hidden="true" /> Refresh
        </button>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <section className="stats-grid" aria-label="Ticket statistics">
        <StatCard label="Total tickets" value={stats.total} note="All tickets" icon={<Ticket size={20} aria-hidden="true" />} tone="indigo" />
        <StatCard label="Open" value={stats.open} note="Waiting for a response" icon={<Inbox size={20} aria-hidden="true" />} tone="blue" />
        <StatCard label="In progress" value={stats.inProgress} note="Being handled" icon={<Clock3 size={20} aria-hidden="true" />} tone="amber" />
        <StatCard label="Resolved" value={stats.resolved} note="Completed" icon={<CheckCircle2 size={20} aria-hidden="true" />} tone="green" />
        <StatCard label="Urgent unresolved" value={stats.urgentUnresolved} note="Urgent and not resolved" icon={<AlertTriangle size={20} aria-hidden="true" />} tone="red" />
      </section>

      <div className="two-col">
        <section className="card" aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="card-title"><Activity size={18} aria-hidden="true" /> Ticket summary</h2>
          {stats.total === 0 ? (
            <p className="muted">No tickets yet.</p>
          ) : (
            <>
              <div className="summary-bar" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}>
                {segments.filter((s) => s.value > 0).map((s) => (
                  <span key={s.key} className={`summary-seg seg-${s.key}`} style={{ flexGrow: s.value }} />
                ))}
              </div>
              <ul className="legend">
                {segments.map((s) => (
                  <li key={s.key}><span className={`legend-dot seg-${s.key}`} /> {s.label} <strong>{s.value}</strong></li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card" aria-labelledby="recent-heading">
          <div className="card-header">
            <h2 id="recent-heading" className="card-title"><Clock3 size={18} aria-hidden="true" /> Recent activity</h2>
            <a href="#/tickets" className="link">View all</a>
          </div>
          {stats.recent.length === 0 ? (
            <EmptyState icon={<Ticket size={28} aria-hidden="true" />} title="No tickets yet">
              <button type="button" className="btn btn-primary" onClick={onCreate}>Create the first ticket</button>
            </EmptyState>
          ) : (
            <ul className="activity-list">
              {stats.recent.map((t) => (
                <li key={t.id}>
                  <a href={ticketHref(t.id)} className="activity-item">
                    <span className="activity-main">
                      <strong>{t.subject}</strong>
                      <span className="muted">{t.id} &middot; {t.customer} &middot; updated {timeAgo(t.updatedAt)}</span>
                    </span>
                    <span className="activity-badges"><PriorityBadge priority={t.priority} /><StatusBadge status={t.status} /></span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
