import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { CATEGORIES, PRIORITIES, STATUSES } from "./validation.js";

const text = (value, fallback = "") => (typeof value === "string" ? value : fallback);

/** Makes legacy or hand-edited records safe to use (missing fields never crash the API). */
function normalize(raw) {
  const createdAt = text(raw?.createdAt, new Date(0).toISOString());
  return {
    id: text(raw?.id),
    subject: text(raw?.subject),
    customer: text(raw?.customer),
    email: text(raw?.email),
    category: CATEGORIES.includes(raw?.category) ? raw.category : "Other",
    priority: PRIORITIES.includes(raw?.priority) ? raw.priority : "Medium",
    status: STATUSES.includes(raw?.status) ? raw.status : "Open",
    description: text(raw?.description),
    createdAt,
    updatedAt: text(raw?.updatedAt, createdAt),
  };
}

function nextId(tickets) {
  let max = 1000;
  for (const ticket of tickets) {
    const match = /^SD-(\d+)$/.exec(ticket.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `SD-${max + 1}`;
}

const byNewest = (a, b) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id, undefined, { numeric: true });

/**
 * JSON-file ticket store.
 * - Reads are served from memory; every change is written to disk (temp file + rename)
 *   before the in-memory state is replaced, so a failed write never leaves them out of sync.
 * - All mutations run one at a time, so concurrent requests cannot produce duplicate IDs
 *   or lost updates. This is designed for a single server process.
 */
export function createTicketStore({ filePath, seedPath } = {}) {
  if (!filePath) throw new Error("createTicketStore requires a filePath.");
  let tickets = null;
  let chain = Promise.resolve();

  async function persist(next) {
    const tmp = `${filePath}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
    await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    await rename(tmp, filePath);
  }

  async function readJsonArray(file, label) {
    const raw = await readFile(file, "utf8");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`${label} (${file}) is not valid JSON. Fix it, or delete it to start from the seed data.`);
    }
    if (!Array.isArray(parsed)) throw new Error(`${label} (${file}) must contain a JSON array of tickets.`);
    return parsed.map(normalize);
  }

  async function init() {
    if (tickets) return;
    await mkdir(path.dirname(filePath), { recursive: true });
    try {
      tickets = await readJsonArray(filePath, "Ticket data file");
      return;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    let initial = [];
    if (seedPath) {
      try {
        initial = await readJsonArray(seedPath, "Seed data file");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    await persist(initial);
    tickets = initial;
  }

  function exclusive(task) {
    const run = chain.then(task);
    chain = run.catch(() => {});
    return run;
  }

  return {
    init,

    async list({ q, status, priority, category } = {}) {
      await init();
      const needle = q?.toLowerCase();
      return tickets
        .filter((t) => !status || t.status === status)
        .filter((t) => !priority || t.priority === priority)
        .filter((t) => !category || t.category === category)
        .filter(
          (t) =>
            !needle ||
            [t.id, t.subject, t.customer, t.email, t.description].some((v) => v.toLowerCase().includes(needle)),
        )
        .sort(byNewest)
        .map((t) => ({ ...t }));
    },

    async get(id) {
      await init();
      const found = tickets.find((t) => t.id === id);
      return found ? { ...found } : null;
    },

    create(data) {
      return exclusive(async () => {
        await init();
        const now = new Date().toISOString();
        const ticket = { id: nextId(tickets), ...data, status: "Open", createdAt: now, updatedAt: now };
        await persist([...tickets, ticket]);
        tickets = [...tickets, ticket];
        return { ...ticket };
      });
    },

    update(id, patch) {
      return exclusive(async () => {
        await init();
        const index = tickets.findIndex((t) => t.id === id);
        if (index === -1) return null;
        const current = tickets[index];
        const changed = Object.keys(patch).some((key) => current[key] !== patch[key]);
        if (!changed) return { ...current };
        const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
        const next = tickets.map((t, i) => (i === index ? updated : t));
        await persist(next);
        tickets = next;
        return { ...updated };
      });
    },

    remove(id) {
      return exclusive(async () => {
        await init();
        if (!tickets.some((t) => t.id === id)) return false;
        const next = tickets.filter((t) => t.id !== id);
        await persist(next);
        tickets = next;
        return true;
      });
    },

    async stats() {
      await init();
      const count = (fn) => tickets.filter(fn).length;
      const recent = [...tickets]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id, undefined, { numeric: true }))
        .slice(0, 5)
        .map((t) => ({ ...t }));
      return {
        total: tickets.length,
        open: count((t) => t.status === "Open"),
        inProgress: count((t) => t.status === "In Progress"),
        resolved: count((t) => t.status === "Resolved"),
        urgentUnresolved: count((t) => t.priority === "Urgent" && t.status !== "Resolved"),
        recent,
      };
    },
  };
}
