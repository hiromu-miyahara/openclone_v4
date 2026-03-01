/**
 * Big5性格診断結果表示 — RPGキャラクタークラス発表
 */
import { motion } from "motion/react";
import type { Answer } from "./Big5Questions";

type PersonalityType = "leader" | "supporter" | "creator" | "analyst" | "communicator" | "balanced";

interface TypeMeta {
  id: PersonalityType;
  title: string;
  description: string;
  tone: string;
}

const TYPE_META: TypeMeta[] = [
  {
    id: "leader",
    title: "リーダー型",
    description: "決断力があり、目標達成に向けて周囲を巻き込む力があるタイプです。",
    tone: "Energy高 / Directness高 / Formality中〜高",
  },
  {
    id: "supporter",
    title: "サポーター型",
    description: "穏やかで信頼感があり、共感力を持って相手を支えるタイプです。",
    tone: "Warmth高 / Energy中 / Directness低",
  },
  {
    id: "creator",
    title: "クリエイター型",
    description: "好奇心が高く、新しいアイデアを積極的に発信するタイプです。",
    tone: "Energy高 / Formality低 / Warmth中",
  },
  {
    id: "analyst",
    title: "アナリスト型",
    description: "論理的かつ緻密に情報を整理し、計画的に物事を進めるタイプです。",
    tone: "Directness高 / Formality高 / Energy中",
  },
  {
    id: "communicator",
    title: "コミュニケーター型",
    description: "社交的で場の空気を読み、対話で人をつなぐタイプです。",
    tone: "Warmth高 / Energy高 / Formality低",
  },
  {
    id: "balanced",
    title: "バランス型",
    description: "状況に応じて柔軟に振る舞える、安定したタイプです。",
    tone: "全パラメータ中程度",
  },
];

interface Scores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

function reverse(raw: number): number { return 8 - raw; }
function normalize(v: number): number { return (v - 1) / 6; }

function calculateNormalizedScores(answers: Answer[]): Scores {
  const byId = new Map<number, number>();
  for (const a of answers) byId.set(a.question_id, a.value);

  const q1 = byId.get(1) ?? 4;
  const q2 = byId.get(2) ?? 4;
  const q3 = byId.get(3) ?? 4;
  const q4 = byId.get(4) ?? 4;
  const q5 = byId.get(5) ?? 4;
  const q6 = byId.get(6) ?? 4;
  const q7 = byId.get(7) ?? 4;
  const q8 = byId.get(8) ?? 4;
  const q9 = byId.get(9) ?? 4;
  const q10 = byId.get(10) ?? 4;

  return {
    extraversion: normalize((q1 + reverse(q6)) / 2),
    agreeableness: normalize((reverse(q2) + q7) / 2),
    conscientiousness: normalize((q3 + reverse(q8)) / 2),
    neuroticism: normalize((q4 + reverse(q9)) / 2),
    openness: normalize((q5 + reverse(q10)) / 2),
  };
}

function classifyType(scores: Scores): PersonalityType {
  const { extraversion: E, agreeableness: A, conscientiousness: C, openness: O, neuroticism: N } = scores;
  if (E >= 0.6 && C >= 0.6) return "leader";
  if (A >= 0.6 && N <= 0.4) return "supporter";
  if (O >= 0.6 && E >= 0.5) return "creator";
  if (C >= 0.6 && O >= 0.5) return "analyst";
  if (E >= 0.6 && A >= 0.5) return "communicator";
  return "balanced";
}

interface Big5ResultProps {
  answers: Answer[];
  onComplete: () => void;
}

export function Big5Result({ answers, onComplete }: Big5ResultProps) {
  const typeId = classifyType(calculateNormalizedScores(answers));
  const typeMeta = TYPE_META.find((v) => v.id === typeId)!;

  return (
    <div className="min-h-screen bg-[#08081a] text-[#e8e0d4] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4">
        <div className="dq-window-sm px-4 py-2">
          <span className="text-[10px] font-pixel-accent text-[#f0c040]">CLASS REVEALED</span>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="w-full max-w-lg mx-auto space-y-6">
          {/* 称号獲得演出 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
          >
            <motion.div
              className="text-4xl mb-4"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              ★
            </motion.div>
            <p className="text-sm text-[#9a9080]">
              あなたの性格タイプが判定されました
            </p>
          </motion.div>

          {/* タイプ表示 — DQステータスウィンドウ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="dq-window p-6 space-y-4">
              <div>
                <p className="text-xs text-[#9a9080] mb-1">─ 称号 ─</p>
                <h3 className="text-2xl font-semibold text-[#f0c040] title-glow">{typeMeta.title}</h3>
              </div>
              <p className="text-sm leading-7 text-[#e8e0d4]">{typeMeta.description}</p>
              <div className="dq-window-sm px-3 py-2 mt-2">
                <p className="text-xs text-[#9a9080]">
                  応答トーン: <span className="text-[#e8e0d4]">{typeMeta.tone}</span>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-8">
        <div className="w-full max-w-lg mx-auto">
          <button
            onClick={onComplete}
            className="rpg-btn-primary w-full py-3 text-sm font-medium"
          >
            ▶ ぼうけんにでる
          </button>
        </div>
      </div>
    </div>
  );
}
