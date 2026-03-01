/**
 * チャットAPIクライアント
 * SSE、履歴、検索、削除
 */
import { fetchApi } from "./client";
import type {
  ChatSendRequest,
  ChatHistoryRequest,
  ChatHistoryResponse,
  ChatSearchRequest,
  ChatSearchResponse,
  SSEEvent,
  SSETokenData,
  SSEFinalData,
  SSEErrorData,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

/**
 * SSEイベントストリームの型ガード
 */
function isTokenData(data: unknown): data is SSETokenData {
  return (
    typeof data === "object" &&
    data !== null &&
    "text_chunk" in data &&
    typeof (data as SSETokenData).text_chunk === "string"
  );
}

function isFinalData(data: unknown): data is SSEFinalData {
  return (
    typeof data === "object" &&
    data !== null &&
    "message_id" in data &&
    "session_id" in data &&
    "action" in data
  );
}

function isErrorData(data: unknown): data is SSEErrorData {
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    "message" in data &&
    "request_id" in data
  );
}

/**
 * SSEイベントパーサー
 */
function parseSSELine(line: string): { type?: string; data?: string } | null {
  if (!line.trim()) return null;

  if (line.startsWith("event: ")) {
    return { type: line.slice(7).trim() };
  }

  if (line.startsWith("data: ")) {
    return { data: line.slice(6).trim() };
  }

  return null;
}

/**
 * SSEストリームを読み取り、イベントをyieldする
 */
async function* readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<SSEEvent> {
  const decoder = new TextDecoder();
  let buffer = "";
  let currentType: string | undefined;
  let currentData: string | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const parsed = parseSSELine(line);
        if (!parsed) continue;

        if (parsed.type !== undefined) {
          currentType = parsed.type;
        }

        if (parsed.data !== undefined) {
          currentData = parsed.data;

          // typeとdataが揃ったらイベントを発火
          if (currentType && currentData !== undefined) {
            let data: unknown;
            try {
              data = JSON.parse(currentData);
            } catch {
              data = {};
            }

            if (currentType === "token" && isTokenData(data)) {
              yield { type: "token", data };
            } else if (currentType === "final" && isFinalData(data)) {
              yield { type: "final", data };
            } else if (currentType === "error" && isErrorData(data)) {
              yield { type: "error", data };
            } else if (currentType === "done") {
              yield { type: "done", data: {} };
            }

            currentType = undefined;
            currentData = undefined;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * チャット送信（SSE）
 */
export async function* sendChat(
  request: ChatSendRequest
): AsyncGenerator<SSEEvent> {
  const token = localStorage.getItem("auth_token");
  const url = `${API_BASE}/api/chat/send`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw {
      code: errorData.code,
      message: errorData.message,
      request_id: errorData.request_id,
    };
  }

  if (!response.body) {
    throw new Error("レスポンスボディが空です");
  }

  yield* readSSEStream(response.body.getReader());
}

/**
 * 履歴取得
 */
export async function getHistory(
  params: ChatHistoryRequest
): Promise<ChatHistoryResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("session_id", params.session_id);
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());

  return fetchApi<ChatHistoryResponse>(
    `/api/chat/history?${searchParams.toString()}`
  );
}

/**
 * 履歴検索
 */
export async function searchHistory(
  params: ChatSearchRequest
): Promise<ChatSearchResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("session_id", params.session_id);
  searchParams.set("q", params.q);
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());

  return fetchApi<ChatSearchResponse>(
    `/api/chat/history/search?${searchParams.toString()}`
  );
}

/**
 * メッセージ削除
 */
export async function deleteMessage(messageId: string): Promise<void> {
  return fetchApi(`/api/data/chat-logs/${messageId}`, {
    method: "DELETE",
  });
}
