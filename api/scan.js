import { kv } from "@vercel/kv";
import { gate, rateLimit, clientIp, callClaude, cleanScan, CATS, UNITS } from "../server/lib.js";

export const config = { api: { bodyParser: { sizeLimit: "3mb" } } };

const B64_RE = /^[A-Za-z0-9+/=]+$/;

export default async function handler(req, res) {
  const uid = gate(req, res, ["POST"]);
  if (!uid) return;

  const image = req.body?.image;
  // Client compresses to ~800px JPEG (well under 1.5 MB base64).
  if (typeof image !== "string" || image.length < 100 || image.length > 2_000_000 || !B64_RE.test(image)) {
    return res.status(400).json({ error: "Invalid image" });
  }

  if (!(await rateLimit(kv, "ai-ip", clientIp(req), 40, 3600)) ||
      !(await rateLimit(kv, "scan", uid, 30, 3600))) {
    return res.status(429).json({ error: "Scan limit reached, try again later" });
  }

  try {
    const data = await callClaude({
      max_tokens: 400,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
          { type: "text", text:
`Identify this household consumable product. Return ONLY raw JSON, no markdown:
{"name":"product name","brand":"brand or empty","category":"${CATS.join("|")}","unit":"${UNITS.join("|")}","emoji":"one emoji","notes":"one short tip or empty"}
If it is not a household product: {"error":"not a product"}` },
        ],
      }],
    });
    const text = data?.content?.[0]?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(200).json({ error: "parse failed" });
    let parsed; try { parsed = JSON.parse(match[0]); } catch { return res.status(200).json({ error: "parse failed" }); }
    const clean = cleanScan(parsed);
    return res.status(200).json(clean || { error: "not a product" });
  } catch (err) {
    console.error("scan error:", err.message);
    return res.status(err.status || 500).json({ error: "Scan failed" });
  }
}
