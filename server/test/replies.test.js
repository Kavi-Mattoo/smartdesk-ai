import { test } from "node:test";
import assert from "node:assert/strict";
import { generateReply, ruleBasedReply } from "../src/replies.js";
import { silentLogger } from "../testing/helpers.js";

const ticket = {
  id: "SD-1002",
  subject: "Payment charged twice",
  customer: "Meera Kapoor",
  email: "meera@example.com",
  category: "Billing",
  priority: "Urgent",
  status: "In Progress",
  description: "I see two charges for the same order on my card.",
};
const ai = { apiKey: "test-key-123", model: "test-model", timeoutMs: 500 };
const opts = (fetchImpl) => ({ fetchImpl, logger: silentLogger });
const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("ruleBasedReply addresses the customer and matches the topic", () => {
  const reply = ruleBasedReply(ticket);
  assert.match(reply, /^Hi Meera Kapoor,/);
  assert.match(reply, /billing/i);
  assert.match(ruleBasedReply({ ...ticket, category: "Other", subject: "Hello", description: "Just saying hi to the team" }), /thank you for contacting support/);
});

test("without an API key the fallback is used and clearly labelled", async () => {
  let called = false;
  const result = await generateReply(ticket, { apiKey: "", model: "m" }, opts(() => { called = true; }));
  assert.equal(called, false);
  assert.equal(result.source, "rule-based");
  assert.equal(result.fallbackReason, "no_api_key");
  assert.match(result.label, /not AI/);
});

test("with an API key it calls the provider and labels the result as AI", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse({ content: [{ type: "text", text: "Hi Meera, we are looking into the duplicate charge." }] });
  };
  const result = await generateReply(ticket, ai, opts(fetchImpl));
  assert.equal(result.source, "ai");
  assert.equal(result.model, "test-model");
  assert.equal(result.reply, "Hi Meera, we are looking into the duplicate charge.");
  assert.equal(result.fallbackReason, undefined);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers["x-api-key"], "test-key-123");
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.model, "test-model");
  assert.match(sent.messages[0].content, /Payment charged twice/);
  assert.ok(!JSON.stringify(result).includes("test-key-123"), "API key must never appear in the result");
});

for (const [status, reason] of [[429, "rate_limited"], [401, "auth_error"], [403, "auth_error"], [500, "provider_unavailable"], [529, "provider_unavailable"], [400, "provider_error"]]) {
  test(`provider HTTP ${status} falls back with reason ${reason}`, async () => {
    const result = await generateReply(ticket, ai, opts(async () => jsonResponse({ error: "x" }, status)));
    assert.equal(result.source, "rule-based");
    assert.equal(result.fallbackReason, reason);
    assert.ok(result.fallbackMessage);
    assert.match(result.reply, /^Hi Meera Kapoor,/);
  });
}

test("network failure and empty responses fall back gracefully", async () => {
  const net = await generateReply(ticket, ai, opts(async () => { throw new TypeError("fetch failed"); }));
  assert.equal(net.fallbackReason, "network_error");
  const empty = await generateReply(ticket, ai, opts(async () => jsonResponse({ content: [] })));
  assert.equal(empty.fallbackReason, "empty_response");
  const garbage = await generateReply(ticket, ai, opts(async () => new Response("<html>", { status: 200 })));
  assert.equal(garbage.source, "rule-based");
});

test("a slow provider times out and falls back", async () => {
  const slow = (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
  const result = await generateReply(ticket, { ...ai, timeoutMs: 30 }, opts(slow));
  assert.equal(result.fallbackReason, "timeout");
});
