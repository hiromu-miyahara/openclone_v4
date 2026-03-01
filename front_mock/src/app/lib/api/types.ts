// OpenAPI v1.3.0 に基づく型定義
// docs/contracts/openapi_v1.yaml を参照

export type UserRole = "user" | "assistant";
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
  | "fun"
  // UIモック互換
  | "sad"
  | "happy"
  | "angry"
  | "confused"
  | "greeting"
  | "wave"
  | "celebrate"
  | "shrug"
  | "sleepy";
export type TtsStatus = "ready" | "skipped" | "failed";
export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type RuntimeStatus = "provisioning" | "running" | "failed" | "stopped";
export type VoiceCloneStatus = "queued" | "processing" | "ready" | "failed";

// ========== Auth ==========
export interface User {
  id: string;
  auth_provider: "google";
  created_at: string; // ISO 8601
}

export interface ProvisioningState {
  status: "pending" | "provisioning" | "ready" | "failed";
  instance_name: string | null;
  endpoint?: string | null;
  updated_at?: string;
}

export interface AuthLoginResponse {
  user: User;
  token: string;
  expires_in?: number;
  openclaw?: ProvisioningState;
}

// ========== Onboarding ==========
export interface OnboardingStartResponse {
  onboarding_session_id: string;
}

export interface OnboardingAnswerRequest {
  onboarding_session_id: string;
  question_id: number; // 1-8
  answer_text?: string;
  answer_audio_url: string;
}

export interface Big5AnswerRequest {
  onboarding_session_id: string;
  question_id: number; // 1-10
  choice_value: number; // 1-7
}

export interface Big5Scores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface ToneParameters {
  formality: number;
  energy: number;
  directness: number;
  warmth: number;
}

export interface Big5ResultResponse {
  onboarding_session_id: string;
  scores_raw: Big5Scores;
  scores: Big5Scores;
  tone: ToneParameters;
  type_code: "leader" | "supporter" | "creator" | "analyst" | "communicator" | "balanced";
  type_label: string;
}

export interface PhotoUploadResponse {
  job_id: string;
  status: JobStatus;
  pipeline_version: string;
}

export interface PixelartAssetUrls {
  base_fullbody_png?: string;
  motion_frame_urls?: Record<string, string[]>;
  motion_gif_urls?: Record<string, string>;
}

export interface PixelartJobStatusResponse {
  status: JobStatus;
  progress: number; // 0-100
  pipeline_version: string;
  asset_urls?: PixelartAssetUrls | null;
  error_message?: string | null;
}

export interface VoiceCloneStartRequest {
  onboarding_session_id: string;
}

export interface VoiceCloneStartResponse {
  job_id: string;
  status: VoiceCloneStatus;
}

export interface VoiceCloneStatusResponse {
  job_id: string;
  status: VoiceCloneStatus;
  voice_profile_ref?: string | null;
  error_message?: string | null;
}

export interface OnboardingCompleteResponse {
  persona_profile_id: string;
}

export interface OnboardingCompleteRequest {
  onboarding_session_id: string;
  big5_answers: Array<{
    question_id: number;
    choice_value: number;
  }>;
}

// ========== Runtime ==========
export interface RuntimeStatusResponse {
  status: RuntimeStatus;
  model_id: string;
  instance_name?: string | null;
  zone?: string | null;
  last_error?: string | null;
}

// ========== Chat SSE ==========
export interface ChatSendRequest {
  session_id?: string | null;
  text: string;
  client_request_id?: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: UserRole;
  text: string;
  actions: ActionType[];
  audio_url?: string | null;
  tts_status: TtsStatus;
  created_at: string; // ISO 8601
}

// SSEイベントデータ
export interface SSETokenData {
  text_chunk: string;
}

export interface SSEFinalData {
  message_id: string;
  session_id: string;
  actions: ActionType[];
  audio_url?: string;
  tts_status: TtsStatus;
}

export interface SSEErrorData {
  code: string;
  message: string;
  request_id: string;
}

export type SSEEventType = "token" | "final" | "error" | "done";

export interface SSEEvent {
  type: SSEEventType;
  data: SSETokenData | SSEFinalData | SSEErrorData | Record<string, never>;
}

// ========== History ==========
export interface ChatHistoryRequest {
  session_id: string;
  limit?: number;
  offset?: number;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  total: number;
}

export interface ChatSearchRequest {
  session_id: string;
  q: string;
  limit?: number;
  offset?: number;
}

export interface ChatSearchResponse {
  results: ChatMessage[];
  total: number;
}

// ========== STT ==========
export interface SttTranscribeResponse {
  transcript: string;
}

// ========== Error ==========
export interface ErrorResponse {
  code: string;
  message: string;
  request_id: string;
}

// エラーコード定義
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
