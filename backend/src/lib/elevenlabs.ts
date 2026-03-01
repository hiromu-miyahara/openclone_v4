import { HttpError } from "./http.js";

export interface ElevenLabsResult {
  audioUrl: string | null;
  ttsStatus: "ready" | "failed" | "skipped";
}

function getConfig() {
  return {
    enabled: (process.env.ELEVENLABS_TTS_ENABLED ?? "true").toLowerCase() === "true",
    apiKey: process.env.ELEVENLABS_API_KEY ?? "",
    baseUrl: (process.env.ELEVENLABS_BASE_URL ?? "https://api.elevenlabs.io").replace(/\/$/, ""),
    voiceId: process.env.ELEVENLABS_VOICE_ID ?? "",
    modelId: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
    timeoutMs: Number.parseInt(process.env.ELEVENLABS_TIMEOUT_MS ?? "12000", 10),
  };
}

// ── Voice Clone ──

export interface VoiceCloneResult {
  voiceId: string | null;
  status: "ready" | "failed";
  errorMessage?: string;
}

export async function cloneVoiceWithElevenLabs(
  audioFiles: Array<{ buffer: Buffer; mimeType: string; filename: string }>,
  voiceName: string,
): Promise<VoiceCloneResult> {
  const cfg = getConfig();
  if (!cfg.apiKey) {
    return { voiceId: null, status: "failed", errorMessage: "ELEVENLABS_API_KEY が未設定です" };
  }

  const cloneTimeoutMs = Number.parseInt(process.env.ELEVENLABS_VOICE_CLONE_TIMEOUT_MS ?? "30000", 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cloneTimeoutMs);

  try {
    const formData = new FormData();
    formData.append("name", voiceName);
    for (const file of audioFiles) {
      const bytes = new Uint8Array(file.buffer.length);
      bytes.set(file.buffer);
      formData.append("files", new Blob([bytes.buffer], { type: file.mimeType }), file.filename);
    }

    const res = await fetch(`${cfg.baseUrl}/v1/voices/add`, {
      method: "POST",
      headers: { "xi-api-key": cfg.apiKey },
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { voiceId: null, status: "failed", errorMessage: `ElevenLabs ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = (await res.json()) as { voice_id?: string };
    if (!data.voice_id) {
      return { voiceId: null, status: "failed", errorMessage: "voice_id が返却されませんでした" };
    }

    return { voiceId: data.voice_id, status: "ready" };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { voiceId: null, status: "failed", errorMessage: "Voice Clone タイムアウト" };
    }
    return { voiceId: null, status: "failed", errorMessage: err instanceof Error ? err.message : "unknown error" };
  } finally {
    clearTimeout(timer);
  }
}

// ── TTS ──

export async function synthesizeWithElevenLabs(text: string, voiceIdOverride?: string): Promise<ElevenLabsResult> {
  const cfg = getConfig();
  if (!cfg.enabled) {
    return { audioUrl: null, ttsStatus: "skipped" };
  }
  const voiceId = voiceIdOverride ?? cfg.voiceId;
  if (!cfg.apiKey || !voiceId) {
    return { audioUrl: null, ttsStatus: "failed" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const res = await fetch(`${cfg.baseUrl}/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "xi-api-key": cfg.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: cfg.modelId,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { audioUrl: null, ttsStatus: "failed" };
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    if (audioBuffer.length === 0) {
      return { audioUrl: null, ttsStatus: "failed" };
    }

    const dataUrl = `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;
    return { audioUrl: dataUrl, ttsStatus: "ready" };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { audioUrl: null, ttsStatus: "failed" };
    }
    if (err instanceof HttpError) {
      throw err;
    }
    return { audioUrl: null, ttsStatus: "failed" };
  } finally {
    clearTimeout(timer);
  }
}
