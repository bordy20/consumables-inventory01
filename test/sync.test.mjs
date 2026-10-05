import test from "node:test";
import assert from "node:assert/strict";

// ── browser stubs ─────────────────────────────────────────────────────────────
// Node 22 ships a read-only global `navigator`, so install stubs with defineProperty.
function install(env) {
  for (const [k, v] of Object.entries(env)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
}
function makeDevice(uid, server) {
  const store = new Map([["cons-uid", uid]]);
  const listeners = {};
  const env = {
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    navigator: { onLine: true },
    document: { visibilityState: "visible", addEventListener() {}, removeEventListener() {} },
    window: { dispatchEvent() {}, addEventListener: (e, f) => (listeners[e] = f), removeEventListener() {} },
    fetch: (url, opts = {}) => server.handle(url, opts, env),
  };
  return env;
}

// Mimics api/inventory.js: optimistic concurrency via `base`, returns 409 + current copy.
function makeServer() {
  let doc = null, n = 0;
  return {
    get doc() { return doc; },
    handle(url, opts, env) {
      if (env.navigator.onLine === false) return Promise.reject(new TypeError("offline"));
      const json = (status, body) => Promise.resolve({ status, ok: status < 400, json: async () => body });
      if (!opts.method || opts.method === "GET") return json(200, doc || { items: [], shop: [], tomb: [], shopU: 0, updatedAt: null });
      const body = JSON.parse(opts.body);
      if (doc && doc.updatedAt && doc.updatedAt !== (body.base ?? null)) return json(409, { error: "Conflict", data: doc });
      const { base, ...rest } = body;
      doc = { ...rest, updatedAt: "v" + ++n };
      return json(200, { ok: true, updatedAt: doc.updatedAt });
    },
  };
}

async function boot(server, uid = "device-uid-1234") {
  const env = makeDevice(uid, server);
  install(env);
  // fresh copy of the module per device so its closure state is isolated
  const mod = await import("../src/sync.js?" + Math.random());
  let data = null, status = "loading";
  const sync = mod.createSync({ onRemote: d => (data = d), onStatus: s => (status = s) });
  return { env, sync, get data() { return data; }, get status() { return status; }, use() { install(env); } };
}
const settle = () => new Promise(r => setTimeout(r, 900));   // debounce is 600ms
const item = (id, name, qty, u) => ({ id, name, qty, u });

test("first run on a new device starts empty and syncs", async () => {
  const server = makeServer();
  const A = await boot(server);
  await A.sync.init();
  assert.deepEqual(A.data.items, []);
  assert.equal(A.status, "synced");
  A.sync.destroy();
});

test("saves reach the server and survive a fresh load", async () => {
  const server = makeServer();
  const A = await boot(server);
  await A.sync.init();
  A.sync.save({ items: [item(1, "Soap", 2, 100)], shop: [], tomb: [], shopU: 0 });
  await settle();
  assert.equal(A.status, "synced");
  assert.equal(server.doc.items[0].name, "Soap");
  A.sync.destroy();

  const B = await boot(server, "device-uid-1234");
  await B.sync.init();
  assert.equal(B.data.items[0].name, "Soap");
  B.sync.destroy();
});

test("a stale device does not overwrite newer cloud data — it merges", async () => {
  const server = makeServer();
  const A = await boot(server, "same-household-key");
  await A.sync.init();
  A.sync.save({ items: [item(1, "Soap", 2, 100)], shop: [], tomb: [], shopU: 0 });
  await settle();

  const B = await boot(server, "same-household-key");
  await B.sync.init();                                          // B sees Soap
  assert.equal(B.data.items.length, 1);

  A.use();                                                      // A adds Rice and saves first
  A.sync.save({ items: [item(1, "Soap", 2, 100), item(2, "Rice", 1, 200)], shop: [], tomb: [], shopU: 0 });
  await settle();

  B.use();                                                      // B (stale) edits Soap qty and saves
  B.sync.save({ items: [item(1, "Soap", 9, 300)], shop: [], tomb: [], shopU: 0 });
  await settle();

  const names = server.doc.items.map(i => i.name).sort();
  assert.deepEqual(names, ["Rice", "Soap"], "Rice from A must not be lost");
  assert.equal(server.doc.items.find(i => i.name === "Soap").qty, 9, "B's newer edit wins");
  A.sync.destroy(); B.sync.destroy();
});

test("offline edits are kept locally and pushed when back online", async () => {
  const server = makeServer();
  const A = await boot(server, "offline-key-1234");
  await A.sync.init();
  A.env.navigator.onLine = false;
  A.sync.save({ items: [item(1, "Tissue", 3, 100)], shop: [], tomb: [], shopU: 0 });
  await settle();
  assert.equal(A.status, "offline");
  assert.equal(server.doc, null);

  // app is killed and reopened while still offline: edits must still be there
  A.sync.destroy();
  const A2 = await boot(server, "offline-key-1234");
  A2.env.localStorage = A.env.localStorage;                      // same phone storage
  install({ localStorage: A.env.localStorage, navigator: A.env.navigator });
  await A2.sync.init();
  assert.equal(A2.data.items[0].name, "Tissue");

  A.env.navigator.onLine = true;                                 // network returns
  await A2.sync.refresh();
  await settle();
  assert.equal(server.doc.items[0].name, "Tissue");
  A2.sync.destroy();
});

test("deleting on one device is not undone by a stale device", async () => {
  const server = makeServer();
  const A = await boot(server, "delete-key-12345");
  await A.sync.init();
  A.sync.save({ items: [item(1, "Soap", 2, 100)], shop: [], tomb: [], shopU: 0 });
  await settle();
  const B = await boot(server, "delete-key-12345");
  await B.sync.init();

  A.use();
  A.sync.save({ items: [], shop: [], tomb: [{ id: 1, u: Date.now() }], shopU: 0 });
  await settle();

  B.use();                                                       // B still has Soap, edits something unrelated
  B.sync.save({ items: [item(1, "Soap", 2, 100), item(2, "Rice", 1, 150)], shop: [], tomb: [], shopU: 0 });
  await settle();
  assert.deepEqual(server.doc.items.map(i => i.name), ["Rice"]);
  A.sync.destroy(); B.sync.destroy();
});
