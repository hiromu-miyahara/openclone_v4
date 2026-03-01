import type { Express } from "express";
import { HttpError } from "./http.js";

function getVoxtralConfig() {
  return {
    apiKey: process.env.MISTRAL_API_KEY ?? "",
    baseUrl: (process.env.MISTRAL_API_BASE_URL ?? "https://api.mistral.ai").replace(/\/$/, ""),
    model: process.env.VOXTRAL_MODEL ?? "voxtral-mini-latest",
    language: process.env.VOXTRAL_LANGUAGE ?? "",
    timeoutMs: Number.parseInt(process.env.VOXTRAL_TIMEOUT_MS ?? "15000", 10),
  };
}

export async function transcribeWithVoxtral(file: Express.Multer.File): Promise<string> {
  const cfg = getVoxtralConfig();
  if (!cfg.apiKey) {
    throw new HttpError(422, "stt_failed", "MISTRAL_API_KEY が未設定です");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || "application/octet-stream" });
    form.append("file", blob, file.originalname || "audio.webm");
    form.append("model", cfg.model);
    if (cfg.language) {
      form.append("language", cfg.language);
    }

    const res = await fetch(`${cfg.baseUrl}/v1/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: form,
      signal: controller.signal,
    });

    if (res.status === 429) {
      throw new HttpError(429, "rate_limited", "STTのレート制限に達しました");
    }
    if (!res.ok) {
      throw new HttpError(422, "stt_failed", `STTに失敗しました: ${res.status}`);
    }

    const json = (await res.json()) as { text?: string };
    const transcript = String(json.text ?? "").trim();
    if (!transcript) {
      throw new HttpError(422, "stt_failed", "STT結果が空です");
    }
    return transcript;
  } catch (err) {
    if (err instanceof HttpError) {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new HttpError(422, "stt_failed", "STTがタイムアウトしました");
    }
    throw new HttpError(422, "stt_failed", "STTに失敗しました");
  } finally {
    clearTimeout(timer);
  }
}
