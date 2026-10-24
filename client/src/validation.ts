import type { NewTicket } from "./types";

// Keep these rules in sync with server/src/validation.js (the server is the source of truth).
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

export type FormErrors = Partial<Record<keyof NewTicket, string>>;

export function validateTicketForm(values: NewTicket): FormErrors {
  const errors: FormErrors = {};
  const subject = values.subject.trim();
  const customer = values.customer.trim();
  const email = values.email.trim();
  const description = values.description.trim();

  if (!subject) errors.subject = "Subject is required.";
  else if (subject.length < 3) errors.subject = "Subject must be at least 3 characters.";
  else if (subject.length > 120) errors.subject = "Subject must be at most 120 characters.";

  if (!customer) errors.customer = "Customer name is required.";
  else if (customer.length < 2) errors.customer = "Customer name must be at least 2 characters.";
  else if (customer.length > 80) errors.customer = "Customer name must be at most 80 characters.";

  if (!email) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(email)) errors.email = "Please enter a valid email address, like name@example.com.";
  else if (email.length > 120) errors.email = "Email must be at most 120 characters.";

  if (!description) errors.description = "Description is required.";
  else if (description.length < 10) errors.description = "Please describe the issue in at least 10 characters.";
  else if (description.length > 1000) errors.description = "Description must be at most 1000 characters.";

  return errors;
}
