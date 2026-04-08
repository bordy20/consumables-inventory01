import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { userId } = req.query;
  if (!userId || userId.length < 8) {
    return res.status(400).json({ error: "Invalid userId" });
  }

  const key = `inventory:${userId}`;

  // GET — load inventory
  if (req.method === "GET") {
    try {
      const data = await kv.get(key);
      return res.status(200).json(data || { items: [], shop: [] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST — save inventory
  if (req.method === "POST") {
    try {
      const { items, shop } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ error: "Invalid data" });
      // Store with no expiry — data lives forever
      await kv.set(key, { items, shop: shop || [], updatedAt: new Date().toISOString() });
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
