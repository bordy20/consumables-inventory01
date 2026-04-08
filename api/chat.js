export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages, inventory } = req.body || {};
  if (!messages?.length) return res.status(400).json({ error: "No messages" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const inv = (inventory||[]).length
    ? inventory.map(i=>`${i.emoji} ${i.name}: ${i.qty} ${i.unit} [${i.category}]`).join("\n")
    : "(empty)";
  const low = (inventory||[]).filter(i=>i.qty<=(i.minQty||1)).map(i=>i.name).join(", ")||"none";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: `You are Consumables AI, a friendly household inventory assistant. Be concise, use emojis.\nInventory:\n${inv}\nLow stock: ${low}`,
        messages: messages.slice(-8).map(m=>({ role: m.role==="assistant"?"assistant":"user", content: m.text })),
      }),
    });
    const data = await response.json();
    return res.status(200).json({ reply: data?.content?.[0]?.text || "" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
