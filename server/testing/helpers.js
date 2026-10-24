import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTicketStore } from "../src/store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SEED_FILE = path.resolve(here, "..", "data", "seed.json");

/** Creates a store backed by a throw-away data file seeded from data/seed.json. */
export async function makeTempStore({ seed = true } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "smartdesk-test-"));
  const filePath = path.join(dir, "tickets.json");
  const store = createTicketStore({ filePath, seedPath: seed ? SEED_FILE : undefined });
  await store.init();
  return { store, dir, filePath, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export const validTicket = {
  subject: "Cannot download invoice",
  customer: "Test Customer",
  email: "test.customer@example.com",
  category: "Billing",
  priority: "High",
  description: "The download button for my invoice returns an error page.",
};

export const silentLogger = { warn() {}, error() {}, log() {} };
