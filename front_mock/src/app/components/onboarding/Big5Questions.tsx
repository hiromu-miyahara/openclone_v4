/**
 * Big5性格診質問画面コンポーネント — RPGステータス配分風
 */
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import { useLanguage } from "../../lib/i18n";
import type { TranslationKey } from "../../lib/i18n";

export type Big5Factor =
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "neuroticism";

export interface Question {
  id: number;
  factor: Big5Factor;
  textKey: TranslationKey;
  reverse: boolean;
}

export interface Answer {
  question_id: number;
  value: number;
  reverse: boolean;
}

const QUESTIONS: Question[] = [
  { id: 1, factor: "extraversion", textKey: "big5.q1", reverse: false },
  { id: 2, factor: "agreeableness", textKey: "big5.q2", reverse: true },
  { id: 3, factor: "conscientiousness", textKey: "big5.q3", reverse: false },
  { id: 4, factor: "neuroticism", textKey: "big5.q4", reverse: false },
  { id: 5, factor: "openness", textKey: "big5.q5", reverse: false },
  { id: 6, factor: "extraversion", textKey: "big5.q6", reverse: true },
  { id: 7, factor: "agreeableness", textKey: "big5.q7", reverse: false },
  { id: 8, factor: "conscientiousness", textKey: "big5.q8", reverse: true },
  { id: 9, factor: "neuroticism", textKey: "big5.q9", reverse: true },
  { id: 10, factor: "openness", textKey: "big5.q10", reverse: true },
];

const OPTION_KEYS: { value: number; labelKey: TranslationKey }[] = [
  { value: 1, labelKey: "big5.opt1" },
  { value: 2, labelKey: "big5.opt2" },
  { value: 3, labelKey: "big5.opt3" },
  { value: 4, labelKey: "big5.opt4" },
  { value: 5, labelKey: "big5.opt5" },
  { value: 6, labelKey: "big5.opt6" },
  { value: 7, labelKey: "big5.opt7" },
];

interface Big5QuestionsProps {
  onComplete: (answers: Answer[]) => void;
}

export function Big5Questions({ onComplete }: Big5QuestionsProps) {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, number>>(new Map());
  const [selectedValue, setSelectedValue] = useState<number | null>(null);

  // refでコールバック依存を安定化
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const selectedValueRef = useRef(selectedValue);
  selectedValueRef.current = selectedValue;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const currentQuestion = QUESTIONS[currentIndex];
  const isLastQuestion = currentIndex === QUESTIONS.length - 1;
  const canProceed = selectedValue !== null;

  const handleSelect = useCallback((value: number) => {
    setSelectedValue(value);
  }, []);

  const handleNext = useCallback(() => {
    const value = selectedValueRef.current;
    if (value === null) return;

    const currentIdx = currentIndex;
    const question = QUESTIONS[currentIdx];
    const isLast = currentIdx === QUESTIONS.length - 1;

    const newAnswers = new Map(answersRef.current);
    newAnswers.set(question.id, value);
    setAnswers(newAnswers);
    answersRef.current = newAnswers;
    setSelectedValue(null);

    if (isLast) {
      const result: Answer[] = QUESTIONS.map((q) => ({
        question_id: q.id,
        value: newAnswers.get(q.id)!,
        reverse: q.reverse,
      }));
      onCompleteRef.current(result);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex]);

  const handlePrev = useCallback(() => {
    if (currentIndex === 0) return;
    setSelectedValue(null);
    setCurrentIndex((prev) => prev - 1);
  }, [currentIndex]);

  const progress = ((currentIndex + 1) / QUESTIONS.length) * 100;

  return (
    <div className="bg-black text-[#e8e0d4] flex flex-col gap-6">
      {/* Header — RPGステータスバー（テキスト切れ防止のため余白確保） */}
      <div className="px-6 pt-2">
        <div className="dq-window-sm px-4 py-3.5 min-h-[4.5rem] flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-pixel-accent text-[#f0c040] leading-tight">
              STATUS CHECK
            </span>
            <span className="text-xs text-[#9a9080] tabular-nums">
              {currentIndex + 1} / {QUESTIONS.length}
            </span>
          </div>
          {/* HPバー風 */}
          <div className="hp-bar">
            <div className="hp-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Question — DQウィンドウ（上揃え・中央寄せなし） */}
      <div className="px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-lg mx-auto"
          >
            <div className="dq-window px-6 py-5">
              <p className="text-xl font-medium leading-relaxed text-[#e8e0d4]">
                {t(currentQuestion.textKey)}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Options — RPGコマンドリスト */}
      <div className="px-6">
        <div className="w-full max-w-lg mx-auto space-y-2">
          {OPTION_KEYS.map((option) => (
            <motion.button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full text-left px-5 py-3 transition-all flex items-center gap-3 ${
                selectedValue === option.value
                  ? "dq-window border-[#f0c040] text-[#f0c040]"
                  : "dq-window-sm text-[#e8e0d4] hover:border-[#f0c040] hover:text-[#f0c040]"
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <span className={`text-sm ${selectedValue === option.value ? "rpg-cursor" : "text-[#6a5c3e]"}`}>
                {selectedValue === option.value ? "▶" : "　"}
              </span>
              <span className="text-sm">{t(option.labelKey)}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Navigation — RPGメニュー風 */}
      <div className="px-6 pb-6">
        <div className="w-full max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm text-[#9a9080] hover:text-[#f0c040] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{t("big5.back")}</span>
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={`rpg-btn-primary flex items-center gap-2 px-6 py-3 text-sm font-medium ${
              !canProceed ? "opacity-30 cursor-not-allowed" : ""
            }`}
          >
            <span>{isLastQuestion ? t("big5.done") : t("big5.next")}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
