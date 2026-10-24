// HTTP-level tests. These start the real Express app on a random port, so they require
// `npm install` (express, cors) to have been run in server/.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { makeTempStore, silentLogger, validTicket } from "../testing/helpers.js";

async function startServer({ ai = {}, fetchImpl } = {}) {
  const { store, filePath, cleanup } = await makeTempStore();
  const config = { ...loadConfig({}), clientDist: null, ai: { apiKey: "", model: "test-model", timeoutMs: 500, ...ai } };
  const app = createApp({ store, config, fetchImpl, logger: silentLogger });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(method, path, body, { raw = false } = {}) {
    const init = { method, headers: {} };
    if (body !== undefined) {
      init.headers["content-type"] = "application/json";
      init.body = raw ? body : JSON.stringify(body);
    }
    const res = await fetch(base + path, init);
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }
  async function close() {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    await cleanup();
  }
  return { call, close, filePath };
}

describe("SmartDesk API", () => {
  let api;
  before(async () => { api = await startServer(); });
  after(async () => { await api.close(); });

  test("GET /api/health reports status and AI availability without secrets", async () => {
    const { status, body } = await api.call("GET", "/api/health");
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.aiEnabled, false);
    assert.ok(!JSON.stringify(body).toLowerCase().includes("key"));
  });

  test("GET /api/tickets lists tickets and supports filters", async () => {
    const all = await api.call("GET", "/api/tickets");
    assert.equal(all.status, 200);
    assert.ok(all.body.length >= 6);
    const urgent = await api.call("GET", "/api/tickets?priority=Urgent");
    assert.ok(urgent.body.every((t) => t.priority === "Urgent"));
    const search = await api.call("GET", "/api/tickets?q=password&status=Open&category=Account");
    assert.deepEqual(search.body.map((t) => t.id), ["SD-1001"]);
    const bad = await api.call("GET", "/api/tickets?status=Nope");
    assert.equal(bad.status, 400);
  });

  test("GET /api/stats returns dashboard counts", async () => {
    const { status, body } = await api.call("GET", "/api/stats");
    assert.equal(status, 200);
    assert.equal(body.total, body.open + body.inProgress + body.resolved);
  });

  test("POST /api/tickets creates a ticket, persists it, and it appears in the list", async () => {
    const created = await api.call("POST", "/api/tickets", validTicket);
    assert.equal(created.status, 201);
    assert.match(created.body.id, /^SD-\d+$/);
    assert.equal(created.body.status, "Open");
    const fetched = await api.call("GET", `/api/tickets/${created.body.id}`);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.subject, validTicket.subject);
    const list = await api.call("GET", "/api/tickets");
    assert.ok(list.body.some((t) => t.id === created.body.id));
    const onDisk = JSON.parse(await readFile(api.filePath, "utf8"));
    assert.ok(onDisk.some((t) => t.id === created.body.id));
  });

  test("POST /api/tickets rejects invalid input with 400 and field details", async () => {
    const missing = await api.call("POST", "/api/tickets", {});
    assert.equal(missing.status, 400);
    assert.ok(missing.body.details.subject && missing.body.details.email);
    const badEmail = await api.call("POST", "/api/tickets", { ...validTicket, email: "nope" });
    assert.equal(badEmail.status, 400);
    assert.match(badEmail.body.error, /valid email/i);
    const badPriority = await api.call("POST", "/api/tickets", { ...validTicket, priority: "Critical" });
    assert.equal(badPriority.status, 400);
    const notObject = await api.call("POST", "/api/tickets", [1, 2, 3]);
    assert.equal(notObject.status, 400);
  });

  test("malformed JSON returns 400 and the server keeps working", async () => {
    const bad = await api.call("POST", "/api/tickets", '{"subject": ', { raw: true });
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /valid JSON/);
    assert.equal((await api.call("GET", "/api/health")).status, 200);
  });

  test("PATCH /api/tickets/:id updates status and priority", async () => {
    const res = await api.call("PATCH", "/api/tickets/SD-1001", { status: "Resolved", priority: "Low" });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "Resolved");
    assert.equal(res.body.priority, "Low");
    assert.equal((await api.call("GET", "/api/tickets/SD-1001")).body.status, "Resolved");
  });

  test("PATCH rejects invalid values and empty bodies", async () => {
    assert.equal((await api.call("PATCH", "/api/tickets/SD-1001", { status: "Done" })).status, 400);
    assert.equal((await api.call("PATCH", "/api/tickets/SD-1001", { priority: "Critical" })).status, 400);
    assert.equal((await api.call("PATCH", "/api/tickets/SD-1001", {})).status, 400);
  });

  test("missing tickets return 404 for get, patch, delete and suggest-reply", async () => {
    assert.equal((await api.call("GET", "/api/tickets/SD-9999")).status, 404);
    assert.equal((await api.call("PATCH", "/api/tickets/SD-9999", { status: "Open" })).status, 404);
    assert.equal((await api.call("DELETE", "/api/tickets/SD-9999")).status, 404);
    assert.equal((await api.call("POST", "/api/tickets/SD-9999/suggest-reply")).status, 404);
  });

  test("unknown API routes return a JSON 404", async () => {
    const res = await api.call("GET", "/api/nope");
    assert.equal(res.status, 404);
    assert.ok(res.body.error);
  });

  test("DELETE /api/tickets/:id removes the ticket", async () => {
    const created = await api.call("POST", "/api/tickets", validTicket);
    const del = await api.call("DELETE", `/api/tickets/${created.body.id}`);
    assert.equal(del.status, 204);
    assert.equal((await api.call("GET", `/api/tickets/${created.body.id}`)).status, 404);
  });

  test("POST suggest-reply uses the labelled rule-based fallback when no AI key is set", async () => {
    const { status, body } = await api.call("POST", "/api/tickets/SD-1002/suggest-reply");
    assert.equal(status, 200);
    assert.equal(body.ticketId, "SD-1002");
    assert.equal(body.source, "rule-based");
    assert.equal(body.fallbackReason, "no_api_key");
    assert.match(body.reply, /Meera/);
  });
});

describe("SmartDesk API with a (mocked) AI provider", () => {
  test("returns an AI-labelled reply when the provider succeeds", async () => {
    const api = await startServer({
      ai: { apiKey: "sk-test" },
      fetchImpl: async () => new Response(JSON.stringify({ content: [{ type: "text", text: "Hello from the mock provider." }] }), { status: 200 }),
    });
    try {
      assert.equal((await api.call("GET", "/api/health")).body.aiEnabled, true);
      const { body } = await api.call("POST", "/api/tickets/SD-1001/suggest-reply");
      assert.equal(body.source, "ai");
      assert.equal(body.reply, "Hello from the mock provider.");
      assert.ok(!JSON.stringify(body).includes("sk-test"));
    } finally { await api.close(); }
  });

  test("falls back to the rule-based reply when the provider is rate limited", async () => {
    const api = await startServer({ ai: { apiKey: "sk-test" }, fetchImpl: async () => new Response("{}", { status: 429 }) });
    try {
      const { status, body } = await api.call("POST", "/api/tickets/SD-1001/suggest-reply");
      assert.equal(status, 200);
      assert.equal(body.source, "rule-based");
      assert.equal(body.fallbackReason, "rate_limited");
    } finally { await api.close(); }
  });
});
