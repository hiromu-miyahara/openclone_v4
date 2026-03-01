import { useState, useEffect, useRef, useCallback } from "react";
import { IDLE_RANDOM_MOTIONS, MOTION_FRAME_COUNTS, type MotionName } from "../motionMap";
import type { ActionType } from "../api/types";

type BehaviorPhase =
  | "idle_loop"           // walk_wander ループ中
  | "random_action"       // ランダムアクション再生中
  | "futon_sleep"         // 布団で寝ている
  | "futon_out"           // 布団から出る遷移中
  | "thinking"            // バックエンド応答待ち
  | "playing_response";   // SSEレスポンスのactions再生中

interface AvatarBehaviorState {
  currentMotion: MotionName;
  phase: BehaviorPhase;
}

interface UseAvatarBehaviorOptions {
  /** trueの間、thinkingモーションを表示 */
  isThinking: boolean;
  /** SSEレスポンスから受け取ったアクション配列。nullの場合はアイドル */
  responseActions: ActionType[] | null;
  /** ユーザー入力開始を検知（futon_sleep中のfuton_out遷移用） */
  isUserInputActive: boolean;
}

interface UseAvatarBehaviorReturn {
  currentMotion: MotionName;
  phase: BehaviorPhase;
}

/**
 * アバターの行動制御フック
 *
 * 優先度: playing_response > thinking > futon_out > idle_loop/random/futon_sleep
 *
 * - デフォルト: walk_wander が90%の確率でループ
 * - ランダムアクション: ~10%の確率で joy, fun, surprise 等を再生
 * - futon_sleep: 0.1%の確率で布団に入る
 * - futon_out: futon_sleep中にユーザー入力があったら布団から出る
 * - thinking: バックエンド応答待ち中
 * - playing_response: SSEレスポンスのアクション配列を順次再生
 */
export function useAvatarBehavior(opts: UseAvatarBehaviorOptions): UseAvatarBehaviorReturn {
  const { isThinking, responseActions, isUserInputActive } = opts;
  const [state, setState] = useState<AvatarBehaviorState>({
    currentMotion: "walk_wander",
    phase: "idle_loop",
  });

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responseTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── アイドルタイマーの管理 ──
  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const clearResponseTimers = useCallback(() => {
    responseTimerRef.current.forEach(clearTimeout);
    responseTimerRef.current = [];
  }, []);

  /**
   * 次のアイドルアクションをスケジュール
   * walk_wander の1ループ完了後に確率判定
   */
  const scheduleNextIdle = useCallback(() => {
    clearIdleTimer();
    const currentMotion = stateRef.current.currentMotion;
    const frameDuration = (MOTION_FRAME_COUNTS[currentMotion] ?? 4) * 500;

    idleTimerRef.current = setTimeout(() => {
      const phase = stateRef.current.phase;
      // thinking や response再生中は割り込まない
      if (phase === "thinking" || phase === "playing_response" || phase === "futon_out") return;

      const roll = Math.random();

      if (roll < 0.01) {
        // 1% → futon_sleep
        setState({ currentMotion: "futon_sleep", phase: "futon_sleep" });
      } else if (roll < 0.10) {
        // ~9% → ランダムアクション
        const picked = IDLE_RANDOM_MOTIONS[Math.floor(Math.random() * IDLE_RANDOM_MOTIONS.length)]!;
        setState({ currentMotion: picked, phase: "random_action" });
      } else {
        // ~90% → walk_wander 継続
        setState({ currentMotion: "walk_wander", phase: "idle_loop" });
      }

      // 次のスケジュール
      scheduleNextIdle();
    }, frameDuration);
  }, [clearIdleTimer]);

  // ── isThinking の制御 ──
  useEffect(() => {
    if (isThinking) {
      clearIdleTimer();
      clearResponseTimers();
      setState({ currentMotion: "thinking", phase: "thinking" });
    } else if (stateRef.current.phase === "thinking" && !responseActions) {
      // thinking が終わり、かつ responseActions がまだ来ていない場合 → アイドルに戻る
      setState({ currentMotion: "walk_wander", phase: "idle_loop" });
      scheduleNextIdle();
    }
  }, [isThinking, clearIdleTimer, clearResponseTimers, scheduleNextIdle, responseActions]);

  // ── responseActions の順次再生 ──
  useEffect(() => {
    if (!responseActions || responseActions.length === 0) return;

    clearIdleTimer();
    clearResponseTimers();

    // 各アクションをそのモーションのフレーム数 x 500ms 分だけ再生
    let elapsed = 0;
    responseActions.forEach((action) => {
      // ActionTypeをMotionNameに変換
      const motionName = actionToMotion(action);
      const frameDuration = (MOTION_FRAME_COUNTS[motionName] ?? 4) * 500;

      const timer = setTimeout(() => {
        setState({ currentMotion: motionName, phase: "playing_response" });
      }, elapsed);
      responseTimerRef.current.push(timer);

      elapsed += frameDuration;
    });

    // 全アクション完了後にアイドルへ
    const finalTimer = setTimeout(() => {
      setState({ currentMotion: "walk_wander", phase: "idle_loop" });
      scheduleNextIdle();
    }, elapsed);
    responseTimerRef.current.push(finalTimer);

    return () => clearResponseTimers();
  }, [responseActions, clearIdleTimer, clearResponseTimers, scheduleNextIdle]);

  // ── futon_sleep 中にユーザー入力 → futon_out ──
  useEffect(() => {
    if (isUserInputActive && stateRef.current.phase === "futon_sleep") {
      clearIdleTimer();
      setState({ currentMotion: "futon_out", phase: "futon_out" });

      // futon_out アニメーション完了後(5フレームx500ms=2.5秒)にアイドルへ
      const timer = setTimeout(() => {
        setState({ currentMotion: "walk_wander", phase: "idle_loop" });
        scheduleNextIdle();
      }, MOTION_FRAME_COUNTS.futon_out * 500);
      responseTimerRef.current.push(timer);
    }
  }, [isUserInputActive, clearIdleTimer, scheduleNextIdle]);

  // ── 初回マウント時にアイドルスケジュール開始 ──
  useEffect(() => {
    scheduleNextIdle();
    return () => {
      clearIdleTimer();
      clearResponseTimers();
    };
  }, [scheduleNextIdle, clearIdleTimer, clearResponseTimers]);

  return {
    currentMotion: state.currentMotion,
    phase: state.phase,
  };
}

// ActionType → MotionName 変換（motionMap.tsの関数を再インポート）
function actionToMotion(action: string): MotionName {
  const ACTION_TO_MOTION: Record<string, MotionName> = {
    idle: "walk_wander",
    thinking: "thinking",
    speaking: "speaking",
    nod: "speaking",
    agree: "speaking",
    surprised: "surprise",
    emphasis: "joy",
    joy: "joy",
    anger: "anger",
    melancholy: "melancholy",
    fun: "fun",
    sad: "melancholy",
    happy: "joy",
    angry: "anger",
    confused: "thinking",
    greeting: "joy",
    wave: "fun",
    celebrate: "joy",
    shrug: "thinking",
    sleepy: "futon_sleep",
  };
  return ACTION_TO_MOTION[action] ?? "walk_wander";
}
