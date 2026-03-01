/**
 * チャットSSEフック
 */
import { useState, useCallback, useRef } from "react";
import { api } from "../api";
import { setToken } from "../api/client";
import type { ChatMessage, SSEEvent, ActionType } from "../api/types";

interface UseChatOptions {
  onError?: (error: { code: string; message: string; request_id: string }) => void;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: "1",
  session_id: "",
  role: "assistant",
  text: "こんにちは！あなたの分身です。\n何でも話しかけてください。",
  actions: ["speaking"],
  audio_url: null,
  tts_status: "skipped",
  created_at: new Date().toISOString(),
};

export function useChat(options?: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [currentAction, setCurrentAction] = useState<ActionType>("idle");
  const [currentText, setCurrentText] = useState<string>("");
  const [responseActions, setResponseActions] = useState<ActionType[] | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ref で最新値を保持し、useCallback の依存配列から除外
  const isSendingRef = useRef(isSending);
  isSendingRef.current = isSending;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  /**
   * トークンを保存
   */
  const saveToken = useCallback((token: string) => {
    setToken(token);
  }, []);

  /**
   * メッセージ送信（SSE）
   */
  const sendMessage = useCallback(async (text: string) => {
    if (isSendingRef.current) return;

    setIsSending(true);
    setCurrentAction("thinking");
    setCurrentText("");

    const currentSessionId = sessionIdRef.current;

    // ユーザーメッセージを追加
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      session_id: currentSessionId || "",
      role: "user",
      text,
      actions: ["idle"],
      audio_url: null,
      tts_status: "skipped",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // アシスタントメッセージのプレースホルダー
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        session_id: currentSessionId || "",
        role: "assistant",
        text: "",
        actions: ["thinking"],
        audio_url: null,
        tts_status: "skipped",
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      let fullText = "";
      let sawFinal = false;
      let sawDone = false;

      for await (const event of api.chat.send({ text, session_id: currentSessionId })) {
        if (event.type === "token") {
          const data = event.data as { text_chunk: string };
          fullText += data.text_chunk;
          setCurrentText(fullText);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, text: fullText, actions: ["speaking"] }
                : msg
            )
          );
          setCurrentAction("speaking");
        } else if (event.type === "final") {
          const finalData = event.data as {
            message_id: string;
            session_id: string;
            actions: ActionType[];
            audio_url?: string;
            tts_status: "ready" | "skipped" | "failed";
          };
          sawFinal = true;
          setSessionId(finalData.session_id);

          // actions配列をそのまま公開（useAvatarBehaviorが順次再生を担当）
          const actionsToPlay = finalData.actions && finalData.actions.length > 0 ? finalData.actions : ["speaking"];
          setResponseActions(actionsToPlay);

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    id: finalData.message_id,
                    session_id: finalData.session_id,
                    actions: actionsToPlay,
                    audio_url: finalData.audio_url || null,
                    tts_status: finalData.tts_status,
                  }
                : msg
            )
          );
        } else if (event.type === "error") {
          const errorData = event.data as { code: string; message: string; request_id: string };
          optionsRef.current?.onError?.(errorData);
          // エラーメッセージを表示
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    text: `エラー: ${errorData.message}`,
                    actions: ["idle"],
                  }
                : msg
            )
          );
          setCurrentAction("idle");
        } else if (event.type === "done") {
          sawDone = true;
          break;
        }
      }

      if (sawDone && !sawFinal) {
        throw new Error("SSE finalイベントが欠落しています");
      }
    } catch (error: any) {
      optionsRef.current?.onError?.({
        code: error.code || "internal_error",
        message: error.message || "予期しないエラーが発生しました",
        request_id: error.request_id || "",
      });
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                text: `エラー: ${error.message}`,
                actions: ["idle"],
              }
            : msg
        )
      );
    } finally {
      setIsSending(false);
      setCurrentAction("idle");
    }
  }, []); // 依存配列が空 → 安定したコールバック

  /**
   * セッションクリア
   */
  const clearSession = useCallback(() => {
    setSessionId(null);
    setMessages([INITIAL_MESSAGE]);
    setResponseActions(null);
  }, []);

  /**
   * レスポンスアクションをクリア（完了時などに呼び出し元で使用）
   */
  const clearResponseActions = useCallback(() => {
    setResponseActions(null);
  }, []);

  return {
    messages,
    sessionId,
    isSending,
    currentAction, // 後方互換（モックモード用）
    responseActions, // 新規追加（実APIモードで使用）
    currentText,
    sendMessage,
    saveToken,
    clearSession,
    clearResponseActions,
  };
}
