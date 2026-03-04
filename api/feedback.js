// Vercel serverless function — receives feedback and forwards to Discord

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1478891737958056039/UiYMSyzoVB9Xp-dI0F2FxDBIuwpuagPDPwG0GmmO3CZd7zADTEMR1puBzu_6Proystrh";

export default async function handler(req, res) {
  // only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, type, lang } = req.body;

  // basic validation
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Message is required" });
  }
  if (message.trim().length > 1000) {
    return res.status(400).json({ error: "Message too long" });
  }

  // emoji based on feedback type
  const typeEmoji = {
    bug: "🐛",
    suggestion: "💡",
    other: "💬",
  }[type] || "💬";

  const typeLabel = {
    bug: "Bug Report",
    suggestion: "Suggestion",
    other: "Feedback",
  }[type] || "Feedback";

  // build Discord embed
  const payload = {
    embeds: [
      {
        title: `${typeEmoji} ${typeLabel}`,
        description: message.trim(),
        color: type === "bug" ? 0xe74c3c : type === "suggestion" ? 0xf1c40f : 0x3498db,
        footer: {
          text: `kbones.xyz • lang: ${lang || "unknown"} • ${new Date().toUTCString()}`,
        },
      },
    ],
  };

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Discord webhook error:", response.status);
      return res.status(500).json({ error: "Failed to send" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Feedback error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}