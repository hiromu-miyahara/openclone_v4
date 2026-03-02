/**
 * Big5性格診断結果表示 — RPGキャラクタークラス発表
 */
import { motion } from "motion/react";
import type { Answer } from "./Big5Questions";
import { useLanguage } from "../../lib/i18n";
import type { TranslationKey } from "../../lib/i18n";

type PersonalityType = "leader" | "supporter" | "creator" | "analyst" | "communicator" | "balanced";

interface TypeMeta {
  id: PersonalityType;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  tone: string;
}

const TYPE_META: TypeMeta[] = [
  {
    id: "leader",
    titleKey: "big5result.leader.title",
    descKey: "big5result.leader.desc",
    tone: "Energy高 / Directness高 / Formality中〜高",
  },
  {
    id: "supporter",
    titleKey: "big5result.supporter.title",
    descKey: "big5result.supporter.desc",
    tone: "Warmth高 / Energy中 / Directness低",
  },
  {
    id: "creator",
    titleKey: "big5result.creator.title",
    descKey: "big5result.creator.desc",
    tone: "Energy高 / Formality低 / Warmth中",
  },
  {
    id: "analyst",
    titleKey: "big5result.analyst.title",
    descKey: "big5result.analyst.desc",
    tone: "Directness高 / Formality高 / Energy中",
  },
  {
    id: "communicator",
    titleKey: "big5result.communicator.title",
    descKey: "big5result.communicator.desc",
    tone: "Warmth高 / Energy高 / Formality低",
  },
  {
    id: "balanced",
    titleKey: "big5result.balanced.title",
    descKey: "big5result.balanced.desc",
    tone: "All parameters moderate",
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
  const { t } = useLanguage();
  const typeId = classifyType(calculateNormalizedScores(answers));
  const typeMeta = TYPE_META.find((v) => v.id === typeId)!;

  return (
    <div className="min-h-screen bg-black text-[#e8e0d4] flex flex-col">
      {/* Header（親の RESULT バーとの重なり防止・テキスト切れ防止） */}
      <div className="px-6 pt-2 pb-4">
        <div className="dq-window-sm px-4 py-2.5 min-h-[2.75rem] flex items-center">
          <span className="text-[10px] font-pixel-accent text-[#f0c040] leading-normal">CLASS REVEALED</span>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-8 pb-2">
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
              {t("big5result.determined")}
            </p>
          </motion.div>

          {/* タイプ表示 — DQステータスウィンドウ（説明文の切れ防止） */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="min-w-0"
          >
            <div className="dq-window p-6 space-y-4 overflow-visible">
              <div>
                <p className="text-xs text-[#9a9080] mb-1">{t("big5result.classLabel")}</p>
                <h3 className="text-2xl font-semibold text-[#f0c040] title-glow">{t(typeMeta.titleKey)}</h3>
              </div>
              <p className="text-sm leading-relaxed text-[#e8e0d4] break-words">
                {t(typeMeta.descKey)}
              </p>
              <div className="dq-window-sm px-3 py-2.5 mt-2 min-h-[2.5rem] flex items-center">
                <p className="text-xs text-[#9a9080] leading-normal">
                  {t("big5result.toneLabel")} <span className="text-[#e8e0d4]">{typeMeta.tone}</span>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer（ボタンをコンテンツに近づけてバランス調整） */}
      <div className="px-6 pt-4 pb-8">
        <div className="w-full max-w-lg mx-auto">
          <button
            onClick={onComplete}
            className="rpg-btn-primary w-full py-3 text-sm font-medium"
          >
            {t("big5result.go")}
          </button>
        </div>
      </div>
    </div>
  );
}
