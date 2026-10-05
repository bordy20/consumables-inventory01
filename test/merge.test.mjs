import test from "node:test";
import assert from "node:assert/strict";
import { mergeData, sameData } from "../src/merge.js";

const it = (id, name, qty, u) => ({ id, name, qty, u });
const NOW = 1_000_000_000_000;

test("newer edit wins per item", () => {
  const local  = { items: [it(1, "Soap", 2, 200)], shop: [], tomb: [], shopU: 0 };
  const remote = { items: [it(1, "Soap", 5, 100), it(2, "Rice", 1, 50)], shop: [], tomb: [], shopU: 0 };
  const m = mergeData(local, remote, NOW);
  assert.equal(m.items.find(x => x.id === 1).qty, 2);
  assert.ok(m.items.find(x => x.id === 2), "item only on remote is kept");
});

test("items added on two devices are both kept", () => {
  const m = mergeData(
    { items: [it(1, "A", 1, 10)] }, { items: [it(2, "B", 1, 20)] }, NOW);
  assert.deepEqual(m.items.map(x => x.id).sort(), [1, 2]);
});

test("a delete (tombstone) beats an older copy on another device", () => {
  const t = NOW - 1000;                                   // recent delete
  const local  = { items: [], tomb: [{ id: 1, u: t }] };
  const remote = { items: [it(1, "Soap", 2, t - 500)], tomb: [] };
  const m = mergeData(local, remote, NOW);
  assert.equal(m.items.length, 0);
  assert.deepEqual(m.tomb, [{ id: 1, u: t }]);            // marker kept so other devices learn about it
});

test("an edit after a delete resurrects the item", () => {
  const m = mergeData({ items: [], tomb: [{ id: 1, u: 100 }] }, { items: [it(1, "Soap", 3, 200)] }, NOW);
  assert.equal(m.items.length, 1);
});

test("old tombstones are pruned after 30 days", () => {
  const old = NOW - 31 * 864e5;
  const m = mergeData({ tomb: [{ id: 9, u: old }] }, {}, NOW);
  assert.equal(m.tomb.length, 0);
});

test("newest shopping list wins", () => {
  const m = mergeData(
    { shop: [{ name: "a", qty: 1 }], shopU: 5 },
    { shop: [{ name: "b", qty: 1 }], shopU: 9 }, NOW);
  assert.equal(m.shop[0].name, "b");
});

test("handles empty / malformed input", () => {
  const m = mergeData(null, undefined, NOW);
  assert.deepEqual(m, { items: [], shop: [], shopU: 0, tomb: [] });
  assert.ok(sameData(null, {}));
});

test("legacy items without `u` merge without crashing", () => {
  const m = mergeData({ items: [{ id: 1, name: "Old", qty: 1 }] }, { items: [{ id: 1, name: "Old", qty: 4 }] }, NOW);
  assert.equal(m.items.length, 1);
});
