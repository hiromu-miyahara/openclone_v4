/**
 * トースト通知コンテキスト
 * エラー表示用
 */
import { toast } from "sonner";

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_request"
  | "stt_failed"
  | "openclaw_timeout"
  | "tts_failed"
  | "rate_limited"
  | "internal_error";

interface ErrorResponse {
  code: string;
  message: string;
  request_id: string;
}

/**
 * エラーメッセージを表示
 */
export function showError(error: ErrorResponse | Error | string): void {
  let message: string;
  let code = "internal_error";

  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if ("code" in error) {
    message = error.message;
    code = error.code as ErrorCode;
  }

  // エラーコードに応じた表示
  switch (code) {
    case "unauthorized":
      message = "認証エラーです。再度ログインしてください。";
      break;
    case "forbidden":
      message = "アクセス権限がありません。";
      break;
    case "stt_failed":
      message = "音声認識に失敗しました。もう一度お試しください。";
      break;
    case "openclaw_timeout":
      message = "応答生成がタイムアウトしました。";
      break;
    case "tts_failed":
      message = "音声合成に失敗しました。";
      break;
    case "rate_limited":
      message = "リクエストが多すぎます。少し時間を置いてからお試しください。";
      break;
    case "internal_error":
      message = "サーバーエラーが発生しました。";
      break;
  }

  toast.error(message);
}

/**
 * 成功メッセージを表示
 */
export function showSuccess(message: string): void {
  toast.success(message);
}

/**
 * 情報メッセージを表示
 */
export function showInfo(message: string): void {
  toast(message);
}

/**
 * 警告メッセージを表示
 */
export function showWarning(message: string): void {
  toast.warning(message);
}
