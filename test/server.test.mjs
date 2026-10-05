import test from "node:test";
import assert from "node:assert/strict";
import { cleanChat, cleanInventory, cleanScan, cleanStr, gate, USER_ID_RE } from "../server/lib.js";

function mockRes() {
  return { code: 200, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
}

test("chat: leading assistant greeting is dropped so the API accepts it", () => {
  const out = cleanChat([
    { role: "assistant", text: "Hi!" },
    { role: "user", text: "what's low?" },
  ]);
  assert.deepEqual(out, [{ role: "user", content: "what's low?" }]);
});

test("chat: consecutive same-role messages are merged and roles alternate", () => {
  const out = cleanChat([
    { role: "user", text: "a" }, { role: "user", text: "b" },
    { role: "assistant", text: "c" }, { role: "user", text: "d" },
  ]);
  assert.deepEqual(out.map(m => m.role), ["user", "assistant", "user"]);
  assert.equal(out[0].content, "a\nb");
});

test("chat: junk input yields no messages", () => {
  assert.deepEqual(cleanChat(null), []);
  assert.deepEqual(cleanChat([{ role: "assistant", text: "x" }]), []);
});

test("cleanStr strips control characters and caps length", () => {
  assert.equal(cleanStr("a\nb\u0000c", 10), "a b c");
  assert.equal(cleanStr("x".repeat(500), 20).length, 20);
});

test("inventory: invalid fields are normalised, bad rows dropped", () => {
  const c = cleanInventory({ items: [
    { id: 1, name: "  Soap ", category: "Nope", unit: "zzz", qty: -4, minQty: "x", expiry: "tomorrow" },
    { id: 2, name: "" },
    null,
  ] });
  assert.equal(c.items.length, 1);
  assert.deepEqual([c.items[0].category, c.items[0].unit, c.items[0].qty, c.items[0].expiry], ["Other", "piece", 0, ""]);
});

test("inventory: rejects non-array and oversize payloads", () => {
  assert.equal(cleanInventory({ items: "x" }), null);
  assert.equal(cleanInventory({ items: new Array(2001).fill({ name: "a" }) }), null);
});

test("scan: normalises model output; 'not a product' becomes null", () => {
  assert.equal(cleanScan({ error: "not a product" }), null);
  const s = cleanScan({ name: "Colgate", category: "Oral Care", unit: "tube", emoji: "🦷" });
  assert.equal(s.category, "Oral Care");
  assert.equal(cleanScan({ name: "X", category: "Weapons" }).category, "Other");
});

test("legacy and new user ids are accepted, junk is not", () => {
  assert.ok(USER_ID_RE.test("lx3k2j9aq1w2e3"));          // old format
  assert.ok(USER_ID_RE.test("a".repeat(28)));
  assert.ok(!USER_ID_RE.test("short"));
  assert.ok(!USER_ID_RE.test("has space in it!"));
});

test("gate: rejects wrong method, bad id, and wrong access code", () => {
  delete process.env.APP_ACCESS_CODE;
  let r = mockRes();
  assert.equal(gate({ method: "DELETE", headers: {} }, r, ["GET"]), null);
  assert.equal(r.code, 405);

  r = mockRes();
  assert.equal(gate({ method: "GET", headers: { "x-user-id": "bad" } }, r, ["GET"]), null);
  assert.equal(r.code, 400);

  r = mockRes();
  assert.equal(gate({ method: "GET", headers: { "x-user-id": "abcdefgh1234" } }, r, ["GET"]), "abcdefgh1234");

  process.env.APP_ACCESS_CODE = "s3cret";
  r = mockRes();
  assert.equal(gate({ method: "GET", headers: { "x-user-id": "abcdefgh1234", "x-access-code": "nope" } }, r, ["GET"]), null);
  assert.equal(r.code, 401);
  r = mockRes();
  assert.equal(gate({ method: "GET", headers: { "x-user-id": "abcdefgh1234", "x-access-code": "s3cret" } }, r, ["GET"]), "abcdefgh1234");
  delete process.env.APP_ACCESS_CODE;
});
