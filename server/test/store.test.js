import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createTicketStore } from "../src/store.js";
import { makeTempStore, SEED_FILE, validTicket } from "../testing/helpers.js";

test("store seeds from seed.json on first run and writes the data file", async () => {
  const { store, filePath, cleanup } = await makeTempStore();
  try {
    const tickets = await store.list();
    assert.equal(tickets.length, 6);
    const onDisk = JSON.parse(await readFile(filePath, "utf8"));
    assert.equal(onDisk.length, 6);
  } finally {
    await cleanup();
  }
});

test("list is sorted newest first and supports search and filters", async () => {
  const { store, cleanup } = await makeTempStore();
  try {
    const all = await store.list();
    assert.equal(all[0].id, "SD-1004");
    assert.deepEqual((await store.list({ status: "Resolved" })).map((t) => t.id).sort(), ["SD-1003", "SD-1006"]);
    assert.deepEqual((await store.list({ priority: "Urgent" })).map((t) => t.id), ["SD-1002"]);
    assert.deepEqual((await store.list({ category: "Billing" })).map((t) => t.id).sort(), ["SD-1002", "SD-1005"]);
    assert.deepEqual((await store.list({ q: "MEERA" })).map((t) => t.id), ["SD-1002"]);
    assert.deepEqual((await store.list({ q: "sd-1001" })).map((t) => t.id), ["SD-1001"]);
    assert.deepEqual(await store.list({ q: "no-such-text" }), []);
    assert.deepEqual((await store.list({ status: "Open", category: "Account" })).map((t) => t.id), ["SD-1001"]);
  } finally {
    await cleanup();
  }
});

test("create assigns sequential unique IDs, Open status and timestamps", async () => {
  const { store, cleanup } = await makeTempStore();
  try {
    const a = await store.create(validTicket);
    const b = await store.create(validTicket);
    assert.equal(a.id, "SD-1007");
    assert.equal(b.id, "SD-1008");
    assert.equal(a.status, "Open");
    assert.equal(a.createdAt, a.updatedAt);
  } finally {
    await cleanup();
  }
});

test("concurrent creates never produce duplicate IDs", async () => {
  const { store, cleanup } = await makeTempStore();
  try {
    const created = await Promise.all(Array.from({ length: 25 }, () => store.create(validTicket)));
    assert.equal(new Set(created.map((t) => t.id)).size, 25);
    assert.equal((await store.list()).length, 31);
  } finally {
    await cleanup();
  }
});

test("update changes fields, bumps updatedAt, and returns null for unknown IDs", async () => {
  const { store, cleanup } = await makeTempStore();
  try {
    const before = await store.get("SD-1001");
    await new Promise((r) => setTimeout(r, 5));
    const after = await store.update("SD-1001", { status: "Resolved", priority: "Low" });
    assert.equal(after.status, "Resolved");
    assert.equal(after.priority, "Low");
    assert.ok(after.updatedAt > before.updatedAt);
    assert.equal(after.createdAt, before.createdAt);
    const same = await store.update("SD-1001", { status: "Resolved" });
    assert.equal(same.updatedAt, after.updatedAt, "no-op update must not change updatedAt");
    assert.equal(await store.update("SD-9999", { status: "Open" }), null);
  } finally {
    await cleanup();
  }
});

test("remove deletes a ticket and reports unknown IDs", async () => {
  const { store, cleanup } = await makeTempStore();
  try {
    assert.equal(await store.remove("SD-1001"), true);
    assert.equal(await store.get("SD-1001"), null);
    assert.equal(await store.remove("SD-1001"), false);
  } finally {
    await cleanup();
  }
});

test("data persists across store instances (simulated restart)", async () => {
  const { store, filePath, cleanup } = await makeTempStore();
  try {
    const created = await store.create(validTicket);
    await store.update("SD-1001", { status: "In Progress" });
    await store.remove("SD-1003");

    const reopened = createTicketStore({ filePath, seedPath: SEED_FILE });
    await reopened.init();
    assert.equal((await reopened.get(created.id)).subject, validTicket.subject);
    assert.equal((await reopened.get("SD-1001")).status, "In Progress");
    assert.equal(await reopened.get("SD-1003"), null);
  } finally {
    await cleanup();
  }
});

test("known limitation: the highest ID is reused if that ticket is deleted", async () => {
  const { store, cleanup } = await makeTempStore();
  try {
    const a = await store.create(validTicket);
    assert.equal(a.id, "SD-1007");
    await store.remove(a.id);
    const b = await store.create(validTicket);
    assert.equal(b.id, "SD-1007");
  } finally {
    await cleanup();
  }
});

test("stats counts statuses and unresolved urgent tickets", async () => {
  const { store, cleanup } = await makeTempStore();
  try {
    const stats = await store.stats();
    assert.equal(stats.total, 6);
    assert.equal(stats.open, 2);
    assert.equal(stats.inProgress, 2);
    assert.equal(stats.resolved, 2);
    assert.equal(stats.urgentUnresolved, 1);
    assert.equal(stats.recent.length, 5);
    assert.equal(stats.recent[0].id, "SD-1004");
  } finally {
    await cleanup();
  }
});

test("legacy or incomplete records are normalized instead of crashing", async () => {
  const { filePath, cleanup } = await makeTempStore({ seed: false });
  try {
    await writeFile(filePath, JSON.stringify([{ id: "SD-AB12CD34", subject: "Old ticket", status: "Weird" }]));
    const reopened = createTicketStore({ filePath });
    await reopened.init();
    const [ticket] = await reopened.list({ q: "old" });
    assert.equal(ticket.status, "Open");
    assert.equal(ticket.description, "");
    assert.equal(ticket.category, "Other");
    const created = await reopened.create(validTicket);
    assert.equal(created.id, "SD-1001");
  } finally {
    await cleanup();
  }
});

test("init fails with a clear message when the data file is corrupt", async () => {
  const { filePath, cleanup } = await makeTempStore({ seed: false });
  try {
    await writeFile(filePath, "{ not json");
    const broken = createTicketStore({ filePath });
    await assert.rejects(() => broken.init(), /not valid JSON/);
  } finally {
    await cleanup();
  }
});
