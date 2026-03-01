/**
 * フロントエンドActionType → バックエンドモーション名のマッピング
 *
 * バックエンドMOTION_PLAN:
 * - futon_sleep (4 frames)
 * - futon_out (5 frames)
 * - speaking (6 frames)
 * - joy (4 frames)
 * - anger (4 frames)
 * - melancholy (4 frames)
 * - fun (4 frames)
 * - surprise (4 frames)
 * - study_note (5 frames)
 * - walk_wander (6 frames)
 * - thinking (4 frames)
 */

export type MotionName =
  | "futon_sleep" | "futon_out" | "speaking" | "joy" | "anger"
  | "melancholy" | "fun" | "surprise" | "study_note" | "walk_wander" | "thinking";

// ActionType → MotionName マッピング（複数対1を許容）
const ACTION_TO_MOTION: Record<string, MotionName> = {
  idle: "walk_wander",
  thinking: "thinking",
  speaking: "speaking",
  nod: "speaking",        // 「うなずき」は speaking モーションで代用
  agree: "speaking",
  surprised: "surprise",
  emphasis: "joy",         // 「強調」は joy で代用
  joy: "joy",
  anger: "anger",
  melancholy: "melancholy",
  fun: "fun",
  sad: "melancholy",       // sad → melancholy
  happy: "joy",            // happy → joy
  angry: "anger",          // angry → anger
  confused: "thinking",    // confused → thinking
  greeting: "joy",         // greeting → joy
  wave: "fun",             // wave → fun
  celebrate: "joy",        // celebrate → joy
  shrug: "thinking",       // shrug → thinking
  sleepy: "futon_sleep",   // sleepy → futon_sleep
};

// デフォルトモーション
const DEFAULT_MOTION: MotionName = "walk_wander";

/**
 * ActionType をバックエンドのモーション名に変換
 */
export function actionToMotion(action: string): MotionName {
  return ACTION_TO_MOTION[action] ?? DEFAULT_MOTION;
}

/**
 * アイドル時のランダム選択候補（walk_wander以外）
 * futon_sleep と futon_out は特殊制御なので除外
 */
export const IDLE_RANDOM_MOTIONS: MotionName[] = [
  "joy", "fun", "surprise", "melancholy", "anger", "study_note", "speaking",
];

/**
 * 各モーションのフレーム数（バックエンドpixelGenerator.tsと同期）
 */
export const MOTION_FRAME_COUNTS: Record<MotionName, number> = {
  futon_sleep: 4,
  futon_out: 5,
  speaking: 6,
  joy: 4,
  anger: 4,
  melancholy: 4,
  fun: 4,
  surprise: 4,
  study_note: 5,
  walk_wander: 6,
  thinking: 4,
};
