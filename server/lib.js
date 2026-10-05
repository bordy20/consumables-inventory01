import { timingSafeEqual } from "node:crypto";

export const CATS  = ["Oral Care","Toilet Paper","Personal Care","Cleaning","Food & Beverage","Medicine","Other"];
export const UNITS = ["piece","pack","bottle","tube","roll","bar","box","can","bag","sachet","set","pair"];

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

// Legacy ids (8+ chars) are still accepted so existing inventories keep working.
export const USER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** Constant-time string compare. */
function safeEqual(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

export function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  return (Array.isArray(xf) ? xf[0] : xf || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

/**
 * Common gate for every API route.
 *  - same-origin only (no CORS headers are sent; browsers block cross-site reads)
 *  - optional shared access code (set APP_ACCESS_CODE in Vercel to enable)
 *  - valid user id from the x-user-id header
 * Returns the user id, or null after having already sent an error response.
 */
export function gate(req, res, methods) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (!methods.includes(req.method)) {
    res.setHeader("Allow", methods.join(", "));
    res.status(405).json({ error: "Method not allowed" });
    return null;
  }

  const code = process.env.APP_ACCESS_CODE;
  if (code) {
    const given = req.headers["x-access-code"];
    if (typeof given !== "string" || !safeEqual(given, code)) {
      res.status(401).json({ error: "Access code required", code: "LOCKED" });
      return null;
    }
  }

  const uid = req.headers["x-user-id"];
  if (typeof uid !== "string" || !USER_ID_RE.test(uid)) {
    res.status(400).json({ error: "Invalid user id" });
    return null;
  }
  return uid;
}

/**
 * Fixed-window rate limit backed by KV. Fails open if KV is unreachable so a
 * storage hiccup never locks you out of your own inventory.
 * Returns true when the request is allowed.
 */
export async function rateLimit(kv, bucket, id, limit, windowSec) {
  try {
    const key = `rl:${bucket}:${id}:${Math.floor(Date.now() / (windowSec * 1000))}`;
    const n = await kv.incr(key);
    if (n === 1) await kv.expire(key, windowSec + 5);
    return n <= limit;
  } catch {
    return true;
  }
}

/** Trim, drop control chars/newlines, cap length. */
export function cleanStr(v, max = 60) {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
}

const num = (v, lo, hi, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
};

export function cleanItem(x) {
  if (!x || typeof x !== "object") return null;
  const name = cleanStr(x.name, 80);
  if (!name) return null;
  return {
    id:       x.id ?? Date.now(),
    name,
    brand:    cleanStr(x.brand, 60),
    category: CATS.includes(x.category) ? x.category : "Other",
    unit:     UNITS.includes(x.unit) ? x.unit : "piece",
    emoji:    cleanStr(x.emoji, 8) || "📦",
    qty:      num(x.qty, 0, 99999, 0),
    minQty:   num(x.minQty, 0, 99999, 1),
    expiry:   /^\d{4}-\d{2}-\d{2}$/.test(x.expiry || "") ? x.expiry : "",
    notes:    cleanStr(x.notes, 200),
    added:    cleanStr(x.added, 30),
    u:        num(x.u, 0, 9e15, 0),
  };
}

export function cleanInventory(body) {
  if (!body || !Array.isArray(body.items) || body.items.length > 2000) return null;
  const items = body.items.map(cleanItem).filter(Boolean);
  const shop = (Array.isArray(body.shop) ? body.shop : []).slice(0, 500).map(s => ({
    name: cleanStr(s?.name, 80), qty: num(s?.qty, 1, 9999, 1), checked: !!s?.checked,
  })).filter(s => s.name);
  const tomb = (Array.isArray(body.tomb) ? body.tomb : []).slice(0, 2000)
    .map(t => ({ id: t?.id, u: num(t?.u, 0, 9e15, 0) })).filter(t => t.id != null);
  return { items, shop, tomb, shopU: num(body.shopU, 0, 9e15, 0) };
}

/** Normalise what the model returns for a product scan. */
export function cleanScan(o) {
  if (!o || typeof o !== "object" || o.error) return null;
  const name = cleanStr(o.name, 80);
  if (!name) return null;
  return {
    name,
    brand:    cleanStr(o.brand, 60),
    category: CATS.includes(o.category) ? o.category : "Other",
    unit:     UNITS.includes(o.unit) ? o.unit : "piece",
    emoji:    cleanStr(o.emoji, 8) || "📦",
    notes:    cleanStr(o.notes, 200),
  };
}

/**
 * Anthropic requires the first message to be from the user and roles to
 * alternate. The UI's greeting is an assistant message, so it must be dropped.
 */
export function cleanChat(messages) {
  const out = [];
  for (const m of (Array.isArray(messages) ? messages : []).slice(-10)) {
    const role = m?.role === "assistant" ? "assistant" : "user";
    const text = cleanStr(m?.text, 1000);
    if (!text) continue;
    if (!out.length && role !== "user") continue;
    if (out.length && out[out.length - 1].role === role) { out[out.length - 1].content += "\n" + text; continue; }
    out.push({ role, content: text });
  }
  return out;
}

export async function callClaude(body, ms = 25000) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw Object.assign(new Error("API key not configured"), { status: 500 });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctl.signal,
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, ...body }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data?.error?.message || `Upstream ${r.status}`), { status: 502 });
    return data;
  } finally { clearTimeout(t); }
}
