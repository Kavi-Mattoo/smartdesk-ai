import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, Mail, Tag, Trash2, User } from "lucide-react";
import { ApiError, deleteTicket, errorMessage, getTicket, isAbort, updateTicket } from "../api";
import { PriorityBadge, StatusBadge } from "../components/Badges";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ReplyAssistant } from "../components/ReplyAssistant";
import { ErrorState, LoadingState } from "../components/StateViews";
import { useToast } from "../components/Toasts";
import { navigate } from "../hooks/useRoute";
import { CATEGORIES, PRIORITIES, STATUSES } from "../types";
import type { Category, Priority, Status, Ticket, TicketPatch } from "../types";
import { formatDate, initials } from "../utils";

export default function TicketDetailPage({ id, aiEnabled, onChanged }: { id: string; aiEnabled: boolean | null; onChanged: () => void }) {
  const { notify } = useToast();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setTicket(null);
    getTicket(id, controller.signal)
      .then((data) => {
        setTicket(data);
        setState("ready");
      })
      .catch((e) => {
        if (isAbort(e)) return;
        if (e instanceof ApiError && e.status === 404) setState("notfound");
        else {
          setError(errorMessage(e, "Could not load this ticket."));
          setState("error");
        }
      });
    return () => controller.abort();
  }, [id, reload]);

  async function applyPatch(patch: TicketPatch, successMessage: string) {
    if (!ticket || saving) return;
    setSaving(true);
    try {
      const updated = await updateTicket(ticket.id, patch);
      setTicket(updated);
      onChanged();
      notify({ kind: "success", message: successMessage });
    } catch (e) {
      notify({ kind: "error", message: errorMessage(e, "Could not update the ticket.") });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!ticket) return;
    setDeleting(true);
    try {
      await deleteTicket(ticket.id);
      notify({ kind: "success", message: `Ticket ${ticket.id} deleted.` });
      onChanged();
      navigate("#/tickets");
    } catch (e) {
      setDeleting(false);
      setConfirmDelete(false);
      notify({ kind: "error", message: errorMessage(e, "Could not delete the ticket.") });
    }
  }

  const back = (
    <a href="#/tickets" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> Back to tickets</a>
  );

  if (state === "loading") return <LoadingState label="Loading ticket..." />;
  if (state === "notfound")
    return (
      <>
        {back}
        <div className="state">
          <strong>Ticket not found</strong>
          <span>{id} does not exist. It may have been deleted.</span>
        </div>
      </>
    );
  if (state === "error" || !ticket)
    return (
      <>
        {back}
        <ErrorState message={error} onRetry={() => setReload((n) => n + 1)} />
      </>
    );

  return (
    <>
      {back}
      <div className="page-header">
        <div>
          <p className="eyebrow">{ticket.id}</p>
          <h1>{ticket.subject}</h1>
          <div className="badge-row"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /><span className="badge badge-neutral">{ticket.category}</span></div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="card" aria-labelledby="desc-heading">
            <h2 id="desc-heading" className="card-title">Issue description</h2>
            <p className="description">{ticket.description || "No description provided."}</p>
          </section>
          <ReplyAssistant key={ticket.id} ticket={ticket} aiEnabled={aiEnabled} />
        </div>

        <aside className="detail-side">
          <section className="card" aria-labelledby="customer-heading">
            <h2 id="customer-heading" className="card-title"><User size={18} aria-hidden="true" /> Customer</h2>
            <div className="customer">
              <span className="avatar" aria-hidden="true">{initials(ticket.customer)}</span>
              <div>
                <strong>{ticket.customer}</strong>
                <a className="link email-link" href={`mailto:${ticket.email}`}><Mail size={14} aria-hidden="true" /> {ticket.email}</a>
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="manage-heading">
            <h2 id="manage-heading" className="card-title"><Tag size={18} aria-hidden="true" /> Manage ticket</h2>
            <div className="field">
              <label htmlFor="detail-status">Status</label>
              <select id="detail-status" value={ticket.status} disabled={saving}
                onChange={(e) => void applyPatch({ status: e.target.value as Status }, `Status changed to ${e.target.value}.`)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="detail-priority">Priority</label>
              <select id="detail-priority" value={ticket.priority} disabled={saving}
                onChange={(e) => void applyPatch({ priority: e.target.value as Priority }, `Priority changed to ${e.target.value}.`)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="detail-category">Category</label>
              <select id="detail-category" value={ticket.category} disabled={saving}
                onChange={(e) => void applyPatch({ category: e.target.value as Category }, `Category changed to ${e.target.value}.`)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </section>

          <section className="card" aria-labelledby="time-heading">
            <h2 id="time-heading" className="card-title"><Calendar size={18} aria-hidden="true" /> Timeline</h2>
            <dl className="meta-list">
              <div><dt>Created</dt><dd>{formatDate(ticket.createdAt)}</dd></div>
              <div><dt>Last updated</dt><dd>{formatDate(ticket.updatedAt)}</dd></div>
            </dl>
          </section>

          <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} aria-hidden="true" /> Delete ticket
          </button>
        </aside>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${ticket.id}?`}
          message={`"${ticket.subject}" will be permanently removed. This cannot be undone.`}
          confirmLabel="Delete ticket"
          busy={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
