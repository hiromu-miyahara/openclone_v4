import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY ?? "";
const MISTRAL_MODEL = process.env.MISTRAL_MODEL ?? "ministral-8b-2410";
const MISTRAL_API_BASE_URL = process.env.MISTRAL_API_BASE_URL ?? "https://api.mistral.ai";

function fallbackReply(text) {
  return {
    text: `了解しました。${text} をもとに次のアクションを提案します。`,
    action: "speaking"
  };
}

app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/v1/chat", async (req, res) => {
  const { text } = req.body ?? {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }

  if (!MISTRAL_API_KEY) {
    return res.status(200).json(fallbackReply(text));
  }

  try {
    const upstream = await fetch(`${MISTRAL_API_BASE_URL.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [
          { role: "system", content: "あなたは会話アシスタントです。短く自然な日本語で応答してください。" },
          { role: "user", content: text }
        ],
        temperature: 0.7,
        max_tokens: 200
      })
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("mistral_error", upstream.status, detail);
      return res.status(200).json(fallbackReply(text));
    }

    const data = await upstream.json();
    const message = data?.choices?.[0]?.message?.content;
    if (!message || typeof message !== "string") {
      return res.status(200).json(fallbackReply(text));
    }

    return res.status(200).json({ text: message, action: "speaking" });
  } catch (err) {
    console.error("openclaw_error", err);
    return res.status(200).json(fallbackReply(text));
  }
});

app.listen(PORT, () => {
  console.log(`openclaw service listening on :${PORT}`);
});
