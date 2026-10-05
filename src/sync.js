import { mergeData, sameData, normalize } from "./merge.js";

const STORE_KEY  = "cons-v11";       // local cache: { data, base, dirty }
const OLD_KEY    = "cons-v10";       // pre-sync-layer cache, migrated once
const USER_KEY   = "cons-uid";
const CODE_KEY   = "cons-code";

const ls = {
  get(k)    { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

// ── identity ──────────────────────────────────────────────────────────────────
function randomId() {
  const bytes = new Uint8Array(18);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(36).padStart(2, "0")).join("").slice(0, 28);
}
export function getUserId() {
  let id = ls.get(USER_KEY);
  if (!id) { id = randomId(); ls.set(USER_KEY, id); }
  return id;
}
export function setUserId(id) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return false;
  ls.set(USER_KEY, id);
  try { localStorage.removeItem(STORE_KEY); } catch {}
  return true;
}
export const getAccessCode = () => ls.get(CODE_KEY) || "";
export const setAccessCode = c => ls.set(CODE_KEY, c);

// ── authenticated fetch ───────────────────────────────────────────────────────
export const LOCKED_EVENT = "cons-locked";
export async function apiFetch(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": getUserId(),
      "x-access-code": getAccessCode(),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) window.dispatchEvent(new Event(LOCKED_EVENT));
  return res;
}

// ── local cache ───────────────────────────────────────────────────────────────
function readCache() {
  try {
    const c = JSON.parse(ls.get(STORE_KEY) || "null");
    if (c?.data) return c;
  } catch {}
  try {                                   // migrate the old cache shape
    const old = JSON.parse(ls.get(OLD_KEY) || "null");
    if (old && Array.isArray(old.items)) return { data: normalize(old), base: null, dirty: true };
  } catch {}
  return null;
}
function writeCache(c) { ls.set(STORE_KEY, JSON.stringify(c)); }

// ── sync controller ───────────────────────────────────────────────────────────
// status: "loading" | "synced" | "saving" | "offline" | "error" | "locked"
export function createSync({ onRemote, onStatus }) {
  let base = null;          // server updatedAt we last saw
  let latest = null;        // newest local data (what we want in the cloud)
  let dirty = false;
  let timer = null;
  let inflight = false;
  let backoff = 0;

  const status = s => onStatus?.(s);

  async function pull() {
    const res = await apiFetch("/api/inventory");
    if (res.status === 401) { status("locked"); return null; }
    if (!res.ok) throw new Error("pull " + res.status);
    return res.json();
  }

  async function init() {
    status("loading");
    const cache = readCache();
    if (cache) { base = cache.base; latest = cache.data; dirty = !!cache.dirty; onRemote(cache.data); }
    try {
      const remote = await pull();
      if (!remote) return;
      adopt(remote);
      status(dirty ? "saving" : "synced");
      if (dirty) flush();
    } catch {
      status(navigator.onLine === false ? "offline" : cache ? "offline" : "error");
    }
  }

  // merge a server copy into whatever we have locally
  function adopt(remote) {
    const merged = latest ? mergeData(latest, remote) : normalize(remote);
    const changedVsRemote = !sameData(merged, remote);
    base = remote.updatedAt || null;
    latest = merged;
    if (changedVsRemote) dirty = true;
    writeCache({ data: latest, base, dirty });
    onRemote(latest);
  }

  function save(data) {
    latest = data; dirty = true;
    writeCache({ data: latest, base, dirty });
    status("saving");
    clearTimeout(timer);
    timer = setTimeout(flush, 600);
  }

  async function flush() {
    if (inflight || !dirty || !latest) return;
    if (navigator.onLine === false) return status("offline");
    inflight = true;
    try {
      const snapshot = latest;
      const res = await apiFetch("/api/inventory", { method: "POST", body: JSON.stringify({ ...snapshot, base }) });
      if (res.status === 401) { status("locked"); return; }
      if (res.status === 409) {
        const { data } = await res.json();
        adopt(data);                         // merge, then retry right away
        inflight = false;
        return flush();
      }
      if (!res.ok) throw new Error("save " + res.status);
      const { updatedAt } = await res.json();
      base = updatedAt;
      dirty = latest !== snapshot;           // edited again while saving?
      writeCache({ data: latest, base, dirty });
      backoff = 0;
      status(dirty ? "saving" : "synced");
      if (dirty) { inflight = false; return flush(); }
    } catch {
      status(navigator.onLine === false ? "offline" : "error");
      backoff = Math.min(60000, (backoff || 2000) * 2);
      clearTimeout(timer);
      timer = setTimeout(flush, backoff);   // keep trying; local copy is safe
    } finally { inflight = false; }
  }

  // Pull fresh data when the app comes back to the foreground / network returns.
  async function refresh() {
    if (dirty) return flush();
    try {
      const remote = await pull();
      if (remote) { adopt(remote); status(dirty ? "saving" : "synced"); if (dirty) flush(); }
    } catch { status(navigator.onLine === false ? "offline" : "error"); }
  }

  const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
  const onOnline  = () => refresh();
  const onOffline = () => status("offline");
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  return {
    init, save, refresh,
    destroy() {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    },
  };
}
