import { HttpError } from "./http.js";
import type { ActionType, TtsStatus } from "../types/api.js";

export interface OpenClawReply {
  text: string;
  actions: ActionType[];
  ttsStatus: TtsStatus;
}

function assertTrustedBaseUrl(baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new HttpError(500, "internal_error", "OpenClaw endpoint が不正です");
  }
  if (parsed.protocol !== "http:") {
    throw new HttpError(500, "internal_error", "OpenClaw endpoint の protocol が不正です");
  }
  const parts = parsed.hostname.split(".").map((v) => Number.parseInt(v, 10));
  const isIpv4 = parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
  if (!isIpv4) {
    throw new HttpError(500, "internal_error", "OpenClaw endpoint の host が不正です");
  }
  const [a, b] = parts;
  const isPrivate =
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    a === 0;
  if (isPrivate) {
    throw new HttpError(500, "internal_error", "OpenClaw endpoint の host はグローバルIPv4のみ許可します");
  }
  return parsed.toString().replace(/\/$/, "");
}

export async function generateReplyFromOpenClaw(params: {
  text: string;
  sessionId: string;
  userId: string;
  baseUrlOverride?: string;
  authToken?: string;
}): Promise<OpenClawReply> {
  const baseUrl = params.baseUrlOverride ?? process.env.OPENCLAW_BASE_URL;
  if (!baseUrl) {
    throw new HttpError(500, "internal_error", "OpenClaw endpoint が未設定です");
  }
  const trustedBaseUrl = assertTrustedBaseUrl(baseUrl);

  const timeoutMs = Number.parseInt(process.env.OPENCLAW_TIMEOUT_MS ?? "8000", 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${trustedBaseUrl}/v1/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(params.authToken ? { "x-openclaw-token": params.authToken } : {}),
      },
      body: JSON.stringify({
        text: `[RESPOND WITH JSON containing "text" and "actions" fields.
"actions" must be an array where the LAST element is "speaking".
Before "speaking", you may add 0-2 emotional reactions: nod, agree, surprised, emphasis, thinking, joy, anger, melancholy, fun.

Examples:
- {"text": "Hello!", "actions": ["speaking"]}
- {"text": "That's great!", "actions": ["agree", "joy", "speaking"]}
- {"text": "Let me think...", "actions": ["thinking", "speaking"]}

User message: ${params.text}]`,
        session_id: params.sessionId,
        user_id: params.userId,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new HttpError(502, "internal_error", `OpenClaw error: ${res.status}`);
    }

    const json = (await res.json()) as { text?: string; actions?: unknown };
    if (!json.text || typeof json.text !== "string") {
      throw new HttpError(502, "internal_error", "OpenClaw response text is missing or invalid");
    }

    // actionsのバリデーションと正規化
    const VALID_ACTIONS: ReadonlySet<ActionType> = new Set([
      "idle",
      "thinking",
      "speaking",
      "nod",
      "agree",
      "surprised",
      "emphasis",
      "joy",
      "anger",
      "melancholy",
      "fun",
    ]);

    let actions: ActionType[] = ["speaking"]; // デフォルトフォールバック

    if (json.actions && Array.isArray(json.actions)) {
      const validActions: ActionType[] = [];
      for (const item of json.actions) {
        if (typeof item === "string") {
          const candidate = item.toLowerCase().trim() as ActionType;
          if (VALID_ACTIONS.has(candidate)) {
            validActions.push(candidate);
          }
        }
      }

      // 最後がspeakingで終わっているかチェック
      if (validActions.length > 0) {
        const lastAction = validActions[validActions.length - 1];
        if (lastAction === "speaking") {
          actions = validActions;
        } else {
          // speakingで終わっていない場合はspeakingを追加
          actions = [...validActions, "speaking"];
        }
      }
    }
    // 空配列や無効な値の場合はデフォルトの["speaking"]を使用

    return {
      text: json.text,
      actions,
      ttsStatus: "ready",
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new HttpError(504, "openclaw_timeout", "OpenClaw がタイムアウトしました");
    }
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, "internal_error", "OpenClaw 呼び出しに失敗しました");
  } finally {
    clearTimeout(timer);
  }
}
