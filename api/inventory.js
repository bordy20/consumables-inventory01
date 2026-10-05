import { kv } from "@vercel/kv";
import { gate, rateLimit, clientIp, cleanInventory } from "../server/lib.js";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

export default async function handler(req, res) {
  const uid = gate(req, res, ["GET", "POST"]);
  if (!uid) return;

  if (!(await rateLimit(kv, "inv-ip", clientIp(req), 300, 60)) ||
      !(await rateLimit(kv, "inv", uid, 120, 60))) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const key = `inventory:${uid}`;

  try {
    if (req.method === "GET") {
      const data = await kv.get(key);
      return res.status(200).json(data || { items: [], shop: [], tomb: [], shopU: 0, updatedAt: null });
    }

    // POST — optimistic concurrency: the client says which version it last saw.
    const clean = cleanInventory(req.body);
    if (!clean) return res.status(400).json({ error: "Invalid data" });

    const base = typeof req.body.base === "string" ? req.body.base : null;
    const stored = await kv.get(key);
    if (stored && stored.updatedAt && stored.updatedAt !== base) {
      // Someone (another device) saved since this client last synced; hand back
      // the current copy so the client can merge instead of overwriting it.
      return res.status(409).json({ error: "Conflict", data: stored });
    }

    const updatedAt = new Date().toISOString();
    await kv.set(key, { ...clean, updatedAt });
    return res.status(200).json({ ok: true, updatedAt });
  } catch (err) {
    console.error("inventory error:", err);
    return res.status(500).json({ error: "Storage error" });
  }
}
