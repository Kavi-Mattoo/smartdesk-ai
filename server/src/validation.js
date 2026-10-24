export const STATUSES = ["Open", "In Progress", "Resolved"];
export const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
export const CATEGORIES = ["Account", "Billing", "Technical", "Feature Request", "Other"];

export const LIMITS = {
  subject: { min: 3, max: 120 },
  customer: { min: 2, max: 80 },
  email: { max: 120 },
  description: { min: 10, max: 1000 },
  query: { max: 100 },
};

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
// Control characters except tab (09), line feed (0A) and carriage return (0D).
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function cleanSingleLine(value) {
  return typeof value === "string"
    ? value.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim()
    : "";
}

export function cleanMultiLine(value) {
  return typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, "").replace(/\n{3,}/g, "\n\n").trim()
    : "";
}

export const firstError = (details) => Object.values(details)[0] ?? "Invalid request.";

function readText(details, field, label, raw, { min = 1, max }, clean) {
  if (raw === undefined || raw === null) {
    details[field] = `${label} is required.`;
    return "";
  }
  if (typeof raw !== "string") {
    details[field] = `${label} must be text.`;
    return "";
  }
  const value = clean(raw);
  if (!value) details[field] = `${label} is required.`;
  else if (value.length < min) details[field] = `${label} must be at least ${min} characters.`;
  else if (value.length > max) details[field] = `${label} must be at most ${max} characters.`;
  return value;
}

function readEnum(details, field, label, raw, allowed, fallback) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (!allowed.includes(raw)) {
    details[field] = `${label} must be one of: ${allowed.join(", ")}.`;
    return fallback;
  }
  return raw;
}

/** Validates and sanitizes the body of POST /api/tickets. */
export function validateCreate(body) {
  const details = {};
  if (!isPlainObject(body)) {
    details._body = "Request body must be a JSON object.";
    return { value: null, details };
  }
  const subject = readText(details, "subject", "Subject", body.subject, LIMITS.subject, cleanSingleLine);
  const customer = readText(details, "customer", "Customer name", body.customer, LIMITS.customer, cleanSingleLine);
  const description = readText(details, "description", "Description", body.description, LIMITS.description, cleanMultiLine);
  let email = readText(details, "email", "Email", body.email, LIMITS.email, cleanSingleLine);
  if (email && !details.email) {
    if (!EMAIL_RE.test(email)) details.email = "Please enter a valid email address.";
    else email = email.toLowerCase();
  }
  const category = readEnum(details, "category", "Category", body.category, CATEGORIES, "Other");
  const priority = readEnum(details, "priority", "Priority", body.priority, PRIORITIES, "Medium");
  return {
    value: Object.keys(details).length ? null : { subject, customer, email, description, category, priority },
    details,
  };
}

const PATCHABLE = {
  status: ["Status", STATUSES],
  priority: ["Priority", PRIORITIES],
  category: ["Category", CATEGORIES],
};

/** Validates the body of PATCH /api/tickets/:id (status, priority, category only). */
export function validatePatch(body) {
  const details = {};
  if (!isPlainObject(body)) {
    details._body = "Request body must be a JSON object.";
    return { value: null, details };
  }
  const value = {};
  for (const key of Object.keys(body)) {
    if (!(key in PATCHABLE)) {
      details[key] = `"${key}" cannot be updated. Allowed fields: ${Object.keys(PATCHABLE).join(", ")}.`;
      continue;
    }
    const [label, allowed] = PATCHABLE[key];
    if (!allowed.includes(body[key])) {
      details[key] = `${label} must be one of: ${allowed.join(", ")}.`;
      continue;
    }
    value[key] = body[key];
  }
  if (!Object.keys(details).length && !Object.keys(value).length) {
    details._body = `Provide at least one of: ${Object.keys(PATCHABLE).join(", ")}.`;
  }
  return { value: Object.keys(details).length ? null : value, details };
}

/** Validates the query string of GET /api/tickets. "All" or empty means "no filter". */
export function validateListQuery(query) {
  const details = {};
  const source = isPlainObject(query) ? query : {};
  const value = {};

  const q = source.q;
  if (q !== undefined) {
    if (typeof q !== "string") details.q = "Search text must be a single value.";
    else if (q.trim().length > LIMITS.query.max) details.q = `Search text must be at most ${LIMITS.query.max} characters.`;
    else value.q = q.trim();
  }
  for (const [field, label, allowed] of [
    ["status", "Status", STATUSES],
    ["priority", "Priority", PRIORITIES],
    ["category", "Category", CATEGORIES],
  ]) {
    const raw = source[field];
    if (raw === undefined || raw === "" || raw === "All") continue;
    if (typeof raw !== "string" || !allowed.includes(raw)) {
      details[field] = `${label} filter must be one of: All, ${allowed.join(", ")}.`;
    } else value[field] = raw;
  }
  return { value: Object.keys(details).length ? null : value, details };
}
