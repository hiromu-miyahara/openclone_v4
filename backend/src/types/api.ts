export type ActionType =
  | "idle"
  | "thinking"
  | "speaking"
  | "nod"
  | "agree"
  | "surprised"
  | "emphasis"
  | "joy"
  | "anger"
  | "melancholy"
  | "fun";

export type TtsStatus = "ready" | "failed" | "skipped";

export type ErrorCode =
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "stt_failed"
  | "openclaw_timeout"
  | "tts_failed"
  | "rate_limited"
  | "internal_error"
  | "resource_not_found";

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  request_id: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  text: string;
  actions: ActionType[];
  audio_url: string | null;
  tts_status: TtsStatus;
  created_at: string;
}
