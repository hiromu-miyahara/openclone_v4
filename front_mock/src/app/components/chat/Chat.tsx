import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import Mic from "lucide-react/dist/esm/icons/mic";
import Send from "lucide-react/dist/esm/icons/send";
import Square from "lucide-react/dist/esm/icons/square";
import Volume2 from "lucide-react/dist/esm/icons/volume-2";
import X from "lucide-react/dist/esm/icons/x";
import Menu from "lucide-react/dist/esm/icons/menu";
import Settings from "lucide-react/dist/esm/icons/settings";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Search from "lucide-react/dist/esm/icons/search";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { useNavigate } from "react-router";
import { PixelAvatar, loadPixelAssets, preloadPixelAssets } from "./PixelAvatar";
import { TypewriterText } from "../ui/TypewriterText";
import { useChat } from "../../lib/hooks/useChat";
import { useAvatarBehavior } from "../../lib/hooks/useAvatarBehavior";
import { api } from "../../lib/api";
import { useAudioRecorder } from "../../lib/hooks/useAudioRecorder";
import { isApiMock } from "../../lib/utils/env";
import { showError } from "../../lib/utils/toast";
import type { ChatMessage } from "../../lib/api/types";

type ChatState = "idle" | "listening" | "thinking" | "responding" | "playingVoice";

// モック用データ
const MOCK_RESPONSES = [
  { text: "それ、いいね！まずは小さく試してみよう。", actions: ["agree", "speaking"] as const },
  { text: "なるほど、そういう考え方もあるんだね。", actions: ["nod", "speaking"] as const },
  { text: "わかる！僕もそう思う！", actions: ["emphasis", "speaking"] as const },
  { text: "へぇ、それは意外だな。", actions: ["surprised", "speaking"] as const },
  { text: "それは少し寂しいね。無理しすぎないで。", actions: ["melancholy", "speaking"] as const },
  { text: "いい流れ！この調子で進もう。", actions: ["joy", "speaking"] as const },
  { text: "それはちょっと違うかも。もう一度整理しよう。", actions: ["anger", "speaking"] as const },
  { text: "そうだね、一緒に考えてみよう。", actions: ["thinking", "speaking"] as const },
];

// モック用Message型（isNew拡張）
type MockMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  actions: readonly ["speaking"] | readonly [string, "speaking"];
  isNew?: boolean;
};

export function Chat() {
  const navigate = useNavigate();
  const useMock = isApiMock();

  // ピクセルアートアセットをlocalStorageから取得
  const [pixelAssets] = useState(() => loadPixelAssets());

  // プリロード（マウント時）
  useEffect(() => {
    if (pixelAssets) preloadPixelAssets(pixelAssets);
  }, [pixelAssets]);

  // APIフック
  const {
    messages: apiMessages,
    isSending,
    currentAction: apiAction,
    responseActions,
    sendMessage: apiSendMessage,
  } = useChat({
    onError: (error) => {
      showError(error);
    },
  });

  // 音声録音フック
  const { isRecording: isAudioRecording, startRecording, stopRecording, error: recordError } = useAudioRecorder();

  // モック用ステート
  const [mockMessages, setMockMessages] = useState<MockMessage[]>([
    {
      id: "1",
      role: "assistant",
      text: "こんにちは！あなたの分身です。\n何でも話しかけてください。",
      actions: ["speaking"],
      isNew: true,
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [chatState, setChatState] = useState<ChatState>("responding");
  const [currentAction, setCurrentAction] = useState<string>("speaking");
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDialog, setShowDialog] = useState(true);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

  // 履歴用ステート（実APIモードのみ）
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (useMock) return;
    const access = localStorage.getItem("onboarding_chat_access");
    if (access !== "granted") {
      navigate("/onboarding", { replace: true });
    }
  }, [navigate, useMock]);

  // API/モック切替 — useMemoで毎レンダーの配列再生成を防止
  const messages = useMemo(() => {
    if (!useMock) return apiMessages;
    return mockMessages.map(m => ({
      ...m,
      audio_url: null,
      tts_status: "skipped" as const,
      created_at: "",
    }));
  }, [useMock, mockMessages, apiMessages]);

  const currentActionDisplay = useMock ? currentAction : apiAction;

  // ユーザー入力アクティブ判定（futon_sleep中のfuton_out遷移用）
  const isUserInputActive = inputText.length > 0 || isRecording;

  // アバター行動フック（実APIモードのみ）
  const { currentMotion: apiMotion } = useAvatarBehavior({
    isThinking: useMock ? false : isSending,
    responseActions: useMock ? null : responseActions,
    isUserInputActive: useMock ? false : isUserInputActive,
  });

  // 実APIモードでの表示アクション（useAvatarBehaviorの戻り値を使用）
  const finalActionForDisplay = useMock ? currentActionDisplay : apiMotion;

  // Latest assistant message
  const latestAssistant = useMemo(
    () => messages.filter((m) => m.role === "assistant").slice(-1)[0],
    [messages]
  );

  // apiMessagesのrefを保持（handleSearchの依存配列から除外するため）
  const apiMessagesRef = useRef(apiMessages);
  apiMessagesRef.current = apiMessages;

  // メッセージ送信ハンドラ
  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return;
    setShowDialog(true);

    if (useMock) {
      // モックモード
      const userMsg: MockMessage = {
        id: Date.now().toString(),
        role: "user",
        text: inputText,
        actions: ["speaking"],
      };
      setMockMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setChatState("thinking");
      setCurrentAction("thinking");

      const delay = 1500 + Math.random() * 1500;
      setTimeout(() => {
        const resp = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
        const assistantMsg: MockMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: resp.text,
          actions: resp.actions,
          isNew: true,
        };
        setMockMessages((prev) => [...prev, assistantMsg]);
        setChatState("responding");
        setCurrentAction(resp.actions[0]);
      }, delay);
    } else {
      // 実APIモード
      await apiSendMessage(inputText);
      setInputText("");
    }
  }, [inputText, useMock, apiSendMessage]);

  // 音声録音ハンドラ
  const handleRecord = async () => {
    if (isRecording) {
      // 録音停止
      setIsRecording(false);

      if (useMock) {
        // モックモード
        setChatState("thinking");
        setCurrentAction("thinking");

        setTimeout(() => {
          const userMsg: MockMessage = {
            id: Date.now().toString(),
            role: "user",
            text: "これは音声入力のテストです",
            actions: ["speaking"],
          };
          setMockMessages((prev) => [...prev, userMsg]);

          setTimeout(() => {
            const resp = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
            const assistantMsg: MockMessage = {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              text: resp.text,
              actions: resp.actions,
              isNew: true,
            };
            setMockMessages((prev) => [...prev, assistantMsg]);
            setChatState("responding");
            setCurrentAction(resp.actions[0]);
          }, 1500);
        }, 500);
      } else {
        // 実APIモード - 録音停止 → STT → チャット送信
        try {
          setIsTranscribing(true);
          setChatState("thinking");
          setCurrentAction("thinking");

          // 録音停止
          const audioBlob = await stopRecording();

          if (!audioBlob) {
            throw new Error("録音データの取得に失敗しました");
          }

          // BlobをFileに変換
          const audioFile = new File([audioBlob], "audio.webm", { type: audioBlob.type });

          // STT API呼び出し
          const { transcript } = await api.stt.transcribe(audioFile);

          // ユーザーメッセージを追加（UI用）
          setInputText(transcript);

          // チャット送信
          await apiSendMessage(transcript);
          setInputText("");
        } catch (error: any) {
          showError(error);
        } finally {
          setIsTranscribing(false);
        }
      }
    } else {
      // 録音開始
      if (useMock) {
        setIsRecording(true);
        setChatState("listening");
      } else {
        try {
          await startRecording();
          setChatState("listening");
        } catch (error: any) {
          showError(error);
        }
      }
    }
  };

  const handleTypewriterComplete = useCallback((messageId: string) => {
    if (useMock) {
      setMockMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, isNew: false } : m)));
      setChatState("idle");
      setCurrentAction("idle");
    }
  }, [useMock]);

  // 履歴検索ハンドラー（実APIモードのみ）— refで最新値参照
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || useMock) return;

    try {
      setIsSearching(true);
      const sessionId = apiMessagesRef.current.find((m) => m.session_id)?.session_id;
      if (!sessionId) return;

      const { results } = await api.chat.search({
        session_id: sessionId,
        q: query,
        limit: 20,
      });

      // TODO: 検索結果を表示
      console.log("Search results:", results);
    } catch (error: any) {
      showError(error);
    } finally {
      setIsSearching(false);
    }
  }, [useMock]);

  // メッセージ削除ハンドラー（実APIモードのみ）
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (useMock) return;

    try {
      setIsDeleting(true);
      await api.chat.delete(messageId);

      // 削除成功（API側で削除されているので、ローカルでは何もしない）
      // 必要に応じてメッセージ一覧を再取得
      console.log("Message deleted:", messageId);
    } catch (error: any) {
      showError(error);
    } finally {
      setIsDeleting(false);
    }
  }, [useMock]);

  const handlePlayVoice = (messageId: string) => {
    setPlayingMessageId(messageId);
    setChatState("playingVoice");
    setCurrentAction("speaking");
    setTimeout(() => {
      setPlayingMessageId(null);
      setChatState("idle");
      setCurrentAction("idle");
    }, 3000);
  };

  const isInputDisabled = useMock
    ? chatState === "thinking" || chatState === "responding"
    : isSending || isTranscribing;

  return (
    <div className="h-screen bg-black text-[#e8e0d4] flex flex-col relative overflow-hidden">
      {/* ─── Header — RPG HUD ─── */}
      <div className="relative z-20 shrink-0 px-4 py-3">
        <div className="dq-window-sm px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-pixel-accent text-[#f0c040]">
            OpenClone
          </span>
          <button
            onClick={() => setShowMenu((prev) => !prev)}
            className="p-1 text-[#9a9080] hover:text-[#f0c040] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* ─── Hamburger Dropdown (outside header box) ─── */}
        <AnimatePresence>
          {showMenu && (
            <div className="flex justify-end">
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="w-44 dq-window py-1 z-50 mt-1"
              >
                <button
                  onClick={() => { setShowMenu(false); setShowHistory(true); }}
                  className="w-full px-4 py-2.5 flex items-center gap-2.5 text-sm text-[#e8e0d4] hover:bg-[#1a1a3a] transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-[#9a9080]" />
                  <span>チャット履歴</span>
                </button>
                <button
                  onClick={() => { setShowMenu(false); setShowSettings(true); }}
                  className="w-full px-4 py-2.5 flex items-center gap-2.5 text-sm text-[#e8e0d4] hover:bg-[#1a1a3a] transition-colors"
                >
                  <Settings className="w-4 h-4 text-[#9a9080]" />
                  <span>設定</span>
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Menu backdrop (close on outside tap) ─── */}
      {showMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
      )}

      {/* ─── Avatar (centered, takes up main space) ─── */}
      <div className="flex-1 flex items-center justify-center relative z-10">
        <div className="relative">
          <PixelAvatar
            action={finalActionForDisplay || "idle"}
            assetUrls={pixelAssets}
          />
        </div>
      </div>

      {/* ─── DQ-style Dialog Box (latest message only) ─── */}
      {showDialog && (
        <div className="relative z-20 px-4 shrink-0">
          <div className="dq-window p-4 min-h-[100px]">
            {/* ✕ 閉じるボタン */}
            <button
              onClick={() => setShowDialog(false)}
              className="absolute top-2 right-2 z-20 p-1 text-[#9a9080] hover:text-[#f0c040] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative z-10 pr-5">
              {(useMock ? chatState === "thinking" : isSending && !latestAssistant?.text) ? (
                <ThinkingDots />
              ) : latestAssistant ? (
                <div>
                  <p className="leading-relaxed text-[#e8e0d4]">
                    {useMock && (latestAssistant as MockMessage).isNew ? (
                      <TypewriterText
                        key={latestAssistant.id}
                        text={latestAssistant.text}
                        speed={50}
                        delay={200}
                        onComplete={() => handleTypewriterComplete(latestAssistant.id)}
                      />
                    ) : (
                      latestAssistant.text.split("\n").map((line, i, arr) => (
                        <span key={i}>
                          {line}
                          {i < arr.length - 1 && <br />}
                        </span>
                      ))
                    )}
                  </p>

                  {/* TTS button (audio_urlがある場合のみ表示) */}
                  {latestAssistant.audio_url && (
                    <button
                      onClick={() => handlePlayVoice(latestAssistant.id)}
                      disabled={playingMessageId !== null}
                      className={`mt-2 flex items-center gap-1 text-xs transition-colors ${
                        playingMessageId === latestAssistant.id
                          ? "text-[#f0c040]"
                          : "text-[#9a9080] hover:text-[#f0c040]"
                      } disabled:opacity-40`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{playingMessageId === latestAssistant.id ? "再生中..." : "音声再生"}</span>
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            {/* ▼ cursor when idle */}
            {(!useMock || chatState === "idle") && (
              <motion.div
                className="absolute bottom-2 right-3"
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <ChevronDown className="w-4 h-4 text-[#f0c040]/60" />
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* ─── Input Area — RPG Command Window ─── */}
      <div className="relative z-20 shrink-0 px-4 pt-3 pb-4">
        <div className="flex items-center gap-2">
          {isAudioRecording ? (
            <div className="flex-1 flex items-center">
              <motion.p
                className="text-sm text-[#ff4444]"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                録音中...
              </motion.p>
            </div>
          ) : isTranscribing ? (
            <div className="flex-1 flex items-center">
              <Loader2 className="w-4 h-4 text-[#9a9080] animate-spin mr-2" />
              <motion.p
                className="text-sm text-[#9a9080]"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                音声認識中...
              </motion.p>
            </div>
          ) : (
            <>
              {/* テキスト入力 + マイクボタン内蔵 */}
              <div className="flex-1 flex items-center rpg-input h-10 pr-1">
                <input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSend();
                  }}
                  onFocus={() => setShowDialog(false)}
                  placeholder="メッセージを入力..."
                  disabled={isInputDisabled}
                  className="flex-1 h-full px-3 text-sm bg-transparent border-none outline-none text-[#e8e0d4] placeholder-[#9a9080]/60"
                />
                <button
                  onClick={handleRecord}
                  disabled={isInputDisabled || isTranscribing}
                  className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 transition-all ${
                    isAudioRecording
                      ? "text-[#ff4444]"
                      : "text-[#9a9080] hover:text-[#f0c040]"
                  } disabled:opacity-30`}
                >
                  {isTranscribing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isAudioRecording ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
              </div>
              {/* 送信ボタン */}
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || isInputDisabled}
                className="w-10 h-10 rpg-btn-primary flex items-center justify-center shrink-0 disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── History Panel — ぼうけんのしょ ─── */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div
              className="absolute inset-0 bg-black/60 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
            />
            <motion.div
              className="absolute top-0 right-0 bottom-0 w-[85%] max-w-sm bg-[#08081a] border-l-3 border-[#6a5c3e] z-40 flex flex-col"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
            >
              <div className="flex items-center justify-between p-4 border-b-2 border-[#6a5c3e]">
                <h2 className="text-[#f0c040] font-pixel-accent text-xs">チャット履歴</h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1 text-[#9a9080] hover:text-[#f0c040] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 検索ボックス */}
              {!useMock && (
                <div className="p-4 border-b-2 border-[#6a5c3e]/50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a9080]" />
                    <input
                      type="text"
                      placeholder="会話を検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="rpg-input w-full h-10 pl-10 pr-3 text-sm"
                      disabled={isSearching}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSearch(searchQuery);
                        }
                      }}
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a9080] animate-spin" />
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-[#9a9080] text-center py-8">まだ冒険の記録がありません</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`group relative ${
                        msg.role === "user"
                          ? "dq-window-sm p-3 ml-6"
                          : "dq-window p-3 mr-6"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-[#9a9080] mb-1">
                            {msg.role === "user" ? "あなた" : "分身"}
                          </p>
                          <p className="text-sm text-[#e8e0d4] break-words">{msg.text}</p>
                          {/* TTS in history too */}
                          {msg.role === "assistant" && msg.audio_url && (
                            <button
                              onClick={() => {
                                setShowHistory(false);
                                handlePlayVoice(msg.id);
                              }}
                              disabled={playingMessageId !== null}
                              className="mt-1.5 flex items-center gap-1 text-xs text-[#9a9080] hover:text-[#f0c040] transition-colors disabled:opacity-40"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>{playingMessageId === msg.id ? "再生中..." : "再生"}</span>
                            </button>
                          )}
                        </div>

                        {/* 削除ボタン（ホバー時のみ表示） */}
                        <button
                          onClick={() => {
                            if (confirm("このメッセージを削除しますか？")) {
                              handleDeleteMessage(msg.id);
                            }
                          }}
                          disabled={isDeleting}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#9a9080] hover:text-[#ff4444] transition-all disabled:opacity-40 disabled:hover:text-[#9a9080]"
                          title="メッセージを削除"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Settings Panel ─── */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              className="absolute inset-0 bg-black/60 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
            />
            <motion.div
              className="absolute top-0 right-0 bottom-0 w-[85%] max-w-sm bg-black border-l-3 border-[#6a5c3e] z-40 flex flex-col"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
            >
              <div className="flex items-center justify-between p-4 border-b-2 border-[#6a5c3e]">
                <h2 className="text-[#f0c040] font-pixel-accent text-xs">設定</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 text-[#9a9080] hover:text-[#f0c040] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* 音声設定 */}
                <div className="space-y-3">
                  <h3 className="text-xs text-[#f0c040] font-pixel-accent">音声</h3>
                  <div className="dq-window-sm p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#e8e0d4]">音声応答</span>
                      <span className="text-xs text-[#9a9080]">ON</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#e8e0d4]">音量</span>
                      <div className="w-24 h-2 bg-[#1a1a3a] rounded-full overflow-hidden">
                        <div className="w-3/4 h-full bg-[#f0c040] rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 表示設定 */}
                <div className="space-y-3">
                  <h3 className="text-xs text-[#f0c040] font-pixel-accent">表示</h3>
                  <div className="dq-window-sm p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#e8e0d4]">テキスト速度</span>
                      <span className="text-xs text-[#9a9080]">普通</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#e8e0d4]">アバターアニメ</span>
                      <span className="text-xs text-[#9a9080]">ON</span>
                    </div>
                  </div>
                </div>

                {/* アカウント */}
                <div className="space-y-3">
                  <h3 className="text-xs text-[#f0c040] font-pixel-accent">アカウント</h3>
                  <div className="dq-window-sm p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#e8e0d4]">ユーザー</span>
                      <span className="text-xs text-[#9a9080]">{useMock ? "テストユーザー" : "—"}</span>
                    </div>
                  </div>
                </div>

                {/* バージョン */}
                <div className="text-center pt-4">
                  <p className="text-[10px] text-[#9a9080]/50 font-pixel-accent">OpenClone v0.1</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Thinking Dots ─── */
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 text-[#9a9080]">
      <span>考え中</span>
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        ・
      </motion.span>
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      >
        ・
      </motion.span>
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      >
        ・
      </motion.span>
    </div>
  );
}
