import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCreate, validateListQuery, validatePatch } from "../src/validation.js";
import { validTicket } from "../testing/helpers.js";

test("validateCreate accepts a valid ticket and normalizes it", () => {
  const { value, details } = validateCreate({
    ...validTicket,
    subject: "  Cannot   download\tinvoice  ",
    email: "  Test.Customer@Example.COM ",
  });
  assert.deepEqual(details, {});
  assert.equal(value.subject, "Cannot download invoice");
  assert.equal(value.email, "test.customer@example.com");
});

test("validateCreate applies defaults for category and priority", () => {
  const { value } = validateCreate({ ...validTicket, category: undefined, priority: undefined });
  assert.equal(value.category, "Other");
  assert.equal(value.priority, "Medium");
});

test("validateCreate reports every missing field", () => {
  const { value, details } = validateCreate({});
  assert.equal(value, null);
  assert.deepEqual(Object.keys(details).sort(), ["customer", "description", "email", "subject"]);
});

test("validateCreate rejects bad email, enum values, short and long text", () => {
  const { details } = validateCreate({
    ...validTicket,
    email: "not-an-email",
    priority: "Critical",
    category: "Sales",
    subject: "ab",
    description: "x".repeat(1001),
  });
  assert.match(details.email, /valid email/i);
  assert.match(details.priority, /one of/i);
  assert.match(details.category, /one of/i);
  assert.match(details.subject, /at least 3/);
  assert.match(details.description, /at most 1000/);
});

test("validateCreate rejects non-object bodies and non-string fields", () => {
  for (const body of [null, undefined, [], "text", 42]) {
    assert.ok(validateCreate(body).details._body, `body ${JSON.stringify(body)} should be rejected`);
  }
  assert.match(validateCreate({ ...validTicket, subject: 123 }).details.subject, /must be text/);
});

test("validateCreate strips control characters", () => {
  const { value } = validateCreate({ ...validTicket, description: "Line one\u0000\u0007 is here\r\n\r\n\r\n\r\nLine two" });
  assert.equal(value.description, "Line one is here\n\nLine two");
});

test("validatePatch accepts status, priority and category", () => {
  const { value, details } = validatePatch({ status: "Resolved", priority: "Low", category: "Technical" });
  assert.deepEqual(details, {});
  assert.deepEqual(value, { status: "Resolved", priority: "Low", category: "Technical" });
});

test("validatePatch rejects invalid values, unknown fields and empty bodies", () => {
  assert.match(validatePatch({ status: "Done" }).details.status, /one of/);
  assert.match(validatePatch({ priority: "Critical" }).details.priority, /one of/);
  assert.ok(validatePatch({ subject: "hack" }).details.subject);
  assert.ok(validatePatch({}).details._body);
  assert.ok(validatePatch(null).details._body);
});

test("validateListQuery treats All/empty as no filter and rejects bad values", () => {
  const ok = validateListQuery({ q: "  refund ", status: "All", priority: "", category: "Billing" });
  assert.deepEqual(ok.value, { q: "refund", category: "Billing" });
  assert.ok(validateListQuery({ status: "Nope" }).details.status);
  assert.ok(validateListQuery({ status: ["Open", "Resolved"] }).details.status);
  assert.ok(validateListQuery({ q: ["a", "b"] }).details.q);
});
