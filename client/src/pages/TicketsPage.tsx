import { useEffect, useState } from "react";
import { RefreshCw, Search, Ticket as TicketIcon, X } from "lucide-react";
import { errorMessage, isAbort, listTickets } from "../api";
import { PriorityBadge, StatusBadge } from "../components/Badges";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { navigate, ticketHref } from "../hooks/useRoute";
import { CATEGORIES, PRIORITIES, STATUSES } from "../types";
import type { Category, Priority, Status, Ticket, TicketFilters } from "../types";
import { formatDate } from "../utils";

const NO_FILTERS: TicketFilters = { q: "", status: "All", priority: "All", category: "All" };

function filtersFromSearch(search: string): TicketFilters {
  const params = new URLSearchParams(search);
  const pick = <T extends string>(key: string, allowed: readonly T[]): T | "All" => {
    const value = params.get(key);
    return allowed.includes(value as T) ? (value as T) : "All";
  };
  return {
    q: params.get("q") ?? "",
    status: pick<Status>("status", STATUSES),
    priority: pick<Priority>("priority", PRIORITIES),
    category: pick<Category>("category", CATEGORIES)
  };
}

export default function TicketsPage({ version, search, onCreate }: { version: number; search: string; onCreate: () => void }) {
  const [filters, setFilters] = useState<TicketFilters>(() => filtersFromSearch(search));
  const [debouncedQ, setDebouncedQ] = useState(filters.q);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  // Sidebar quick views change the hash; keep the filters in sync with it.
  useEffect(() => {
    const next = filtersFromSearch(search);
    setFilters(next);
    setDebouncedQ(next.q);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(filters.q), 250);
    return () => window.clearTimeout(timer);
  }, [filters.q]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    listTickets({ ...filters, q: debouncedQ }, controller.signal)
      .then((data) => {
        setTickets(data);
        setLoaded(true);
      })
      .catch((e) => {
        if (!isAbort(e)) setError(errorMessage(e, "Could not load tickets."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedQ, filters.status, filters.priority, filters.category, version, reload]);

  const hasFilters = filters.q.trim() !== "" || filters.status !== "All" || filters.priority !== "All" || filters.category !== "All";
  const update = <K extends keyof TicketFilters>(key: K, value: TicketFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const clear = () => {
    setFilters(NO_FILTERS);
    setDebouncedQ("");
    if (search) navigate("#/tickets");
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Tickets</h1>
          <p className="muted">Search, filter and manage customer requests.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setReload((n) => n + 1)} disabled={loading}>
          <RefreshCw size={16} className={loading ? "spin" : undefined} aria-hidden="true" /> Refresh
        </button>
      </div>

      <section className="card filters" aria-label="Search and filters">
        <div className="field search-field">
          <label htmlFor="ticket-search" className="sr-only">Search tickets</label>
          <Search size={16} className="search-icon" aria-hidden="true" />
          <input id="ticket-search" type="search" value={filters.q} onChange={(e) => update("q", e.target.value)} placeholder="Search subject, customer, email or ID" maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="filter-status">Status</label>
          <select id="filter-status" value={filters.status} onChange={(e) => update("status", e.target.value as Status | "All")}>
            <option value="All">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-priority">Priority</label>
          <select id="filter-priority" value={filters.priority} onChange={(e) => update("priority", e.target.value as Priority | "All")}>
            <option value="All">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-category">Category</label>
          <select id="filter-category" value={filters.category} onChange={(e) => update("category", e.target.value as Category | "All")}>
            <option value="All">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {hasFilters && (
          <button type="button" className="btn btn-ghost clear-btn" onClick={clear}><X size={16} aria-hidden="true" /> Clear</button>
        )}
      </section>

      {error && loaded && <div className="alert alert-error" role="alert">{error}</div>}

      <section className="card table-card" aria-busy={loading}>
        {!loaded && loading ? (
          <LoadingState label="Loading tickets..." />
        ) : !loaded && error ? (
          <ErrorState message={error} onRetry={() => setReload((n) => n + 1)} />
        ) : tickets.length === 0 ? (
          hasFilters ? (
            <EmptyState icon={<Search size={28} aria-hidden="true" />} title="No tickets match your filters">
              <p>Try a different search or <button type="button" className="link-button" onClick={clear}>clear the filters</button>.</p>
            </EmptyState>
          ) : (
            <EmptyState icon={<TicketIcon size={28} aria-hidden="true" />} title="No tickets yet">
              <button type="button" className="btn btn-primary" onClick={onCreate}>Create the first ticket</button>
            </EmptyState>
          )
        ) : (
          <>
            <p className="result-count" aria-live="polite">{tickets.length} ticket{tickets.length === 1 ? "" : "s"}{hasFilters ? " found" : ""}</p>
            <div className="table-wrap">
              <table className="tickets-table">
                <thead>
                  <tr><th scope="col">Ticket</th><th scope="col">Customer</th><th scope="col">Category</th><th scope="col">Priority</th><th scope="col">Status</th><th scope="col">Created</th></tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} onClick={() => navigate(ticketHref(t.id))}>
                      <td data-label="Ticket">
                        <a href={ticketHref(t.id)} className="ticket-link" onClick={(e) => e.stopPropagation()}>{t.subject}</a>
                        <span className="cell-sub">{t.id}</span>
                      </td>
                      <td data-label="Customer">{t.customer}<span className="cell-sub">{t.email}</span></td>
                      <td data-label="Category">{t.category}</td>
                      <td data-label="Priority"><PriorityBadge priority={t.priority} /></td>
                      <td data-label="Status"><StatusBadge status={t.status} /></td>
                      <td data-label="Created">{formatDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}
