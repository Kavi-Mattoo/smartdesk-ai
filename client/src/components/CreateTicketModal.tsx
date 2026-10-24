import { useState } from "react";
import type { FormEvent } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import { ApiError, createTicket, errorMessage } from "../api";
import { CATEGORIES, PRIORITIES } from "../types";
import type { Category, NewTicket, Priority, Ticket } from "../types";
import { validateTicketForm } from "../validation";
import type { FormErrors } from "../validation";
import { Dialog } from "./Dialog";

const EMPTY: NewTicket = { subject: "", customer: "", email: "", category: "Technical", priority: "Medium", description: "" };
const FIELD_ORDER: (keyof NewTicket)[] = ["subject", "customer", "email", "category", "priority", "description"];

export function CreateTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: (ticket: Ticket) => void }) {
  const [values, setValues] = useState<NewTicket>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof NewTicket>(key: K, value: NewTicket[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function focusFirst(found: FormErrors) {
    const first = FIELD_ORDER.find((key) => found[key]);
    if (first) document.getElementById(`ticket-${first}`)?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const found = validateTicketForm(values);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) {
      focusFirst(found);
      return;
    }
    setSubmitting(true);
    try {
      const ticket = await createTicket(values);
      onCreated(ticket);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && Object.keys(error.details).length) {
        const serverErrors = error.details as FormErrors;
        setErrors(serverErrors);
        if (!FIELD_ORDER.some((key) => serverErrors[key])) setFormError(error.message);
        focusFirst(serverErrors);
      } else {
        setFormError(errorMessage(error, "Could not create the ticket."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const describedBy = (key: keyof NewTicket) => (errors[key] ? `ticket-${key}-error` : undefined);
  const fieldError = (key: keyof NewTicket) =>
    errors[key] ? (
      <p id={`ticket-${key}-error`} className="field-error">
        {errors[key]}
      </p>
    ) : null;

  return (
    <Dialog labelId="create-title" onClose={() => !submitting && onClose()}>
      <form onSubmit={handleSubmit} noValidate className="form">
        <div className="dialog-header">
          <div>
            <h2 id="create-title" className="dialog-title">
              Create support ticket
            </h2>
            <p className="muted">Capture the customer&rsquo;s issue so your team can follow up. Fields marked * are required.</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose} disabled={submitting}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}

        <div className="field">
          <label htmlFor="ticket-subject">Subject *</label>
          <input id="ticket-subject" data-autofocus value={values.subject} maxLength={120} autoComplete="off" placeholder="e.g. Unable to sign in"
            aria-required="true" aria-invalid={Boolean(errors.subject)} aria-describedby={describedBy("subject")}
            onChange={(e) => set("subject", e.target.value)} />
          {fieldError("subject")}
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="ticket-customer">Customer name *</label>
            <input id="ticket-customer" value={values.customer} maxLength={80} autoComplete="off" placeholder="Full name"
              aria-required="true" aria-invalid={Boolean(errors.customer)} aria-describedby={describedBy("customer")}
              onChange={(e) => set("customer", e.target.value)} />
            {fieldError("customer")}
          </div>
          <div className="field">
            <label htmlFor="ticket-email">Customer email *</label>
            <input id="ticket-email" type="email" value={values.email} maxLength={120} autoComplete="off" placeholder="name@example.com"
              aria-required="true" aria-invalid={Boolean(errors.email)} aria-describedby={describedBy("email")}
              onChange={(e) => set("email", e.target.value)} />
            {fieldError("email")}
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="ticket-category">Category</label>
            <select id="ticket-category" value={values.category} onChange={(e) => set("category", e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ticket-priority">Priority</label>
            <select id="ticket-priority" value={values.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="ticket-description">Description *</label>
          <textarea id="ticket-description" rows={5} value={values.description} maxLength={1000} placeholder="Describe the customer's issue in detail..."
            aria-required="true" aria-invalid={Boolean(errors.description)} aria-describedby={describedBy("description")}
            onChange={(e) => set("description", e.target.value)} />
          <p className="field-hint">{values.description.length}/1000 characters</p>
          {fieldError("description")}
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {submitting ? "Creating..." : "Create ticket"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
