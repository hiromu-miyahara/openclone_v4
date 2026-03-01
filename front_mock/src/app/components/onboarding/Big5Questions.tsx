/**
 * Big5性格診質問画面コンポーネント — RPGステータス配分風
 */
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";

export type Big5Factor =
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "neuroticism";

export interface Question {
  id: number;
  factor: Big5Factor;
  text: string;
  reverse: boolean;
}

export interface Answer {
  question_id: number;
  value: number;
  reverse: boolean;
}

const QUESTIONS: Question[] = [
  { id: 1, factor: "extraversion", text: "活発で、外向的だと思う", reverse: false },
  { id: 2, factor: "agreeableness", text: "他人に不満をもち、もめごとを起こしやすいと思う", reverse: true },
  { id: 3, factor: "conscientiousness", text: "しっかりしていて、自分に厳しいと思う", reverse: false },
  { id: 4, factor: "neuroticism", text: "心配性で、うろたえやすいと思う", reverse: false },
  { id: 5, factor: "openness", text: "新しいことが好きで、変わった考えをもつと思う", reverse: false },
  { id: 6, factor: "extraversion", text: "ひかえめで、おとなしいと思う", reverse: true },
  { id: 7, factor: "agreeableness", text: "人に気をつかう、やさしい人間だと思う", reverse: false },
  { id: 8, factor: "conscientiousness", text: "だらしなく、うっかりしていると思う", reverse: true },
  { id: 9, factor: "neuroticism", text: "冷静で、気分が安定していると思う", reverse: true },
  { id: 10, factor: "openness", text: "発想力に欠けた、平凡な人間だと思う", reverse: true },
];

const OPTIONS = [
  { value: 1, label: "全く違うと思う" },
  { value: 2, label: "おおかた違うと思う" },
  { value: 3, label: "少し違うと思う" },
  { value: 4, label: "どちらでもない" },
  { value: 5, label: "少しそう思う" },
  { value: 6, label: "おおかたそう思う" },
  { value: 7, label: "強くそう思う" },
];

interface Big5QuestionsProps {
  onComplete: (answers: Answer[]) => void;
}

export function Big5Questions({ onComplete }: Big5QuestionsProps) {
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
    <div className="min-h-screen bg-[#08081a] text-[#e8e0d4] flex flex-col">
      {/* Header — RPGステータスバー */}
      <div className="px-6 py-4">
        <div className="dq-window-sm px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-pixel-accent text-[#f0c040]">
              STATUS CHECK
            </span>
            <span className="text-xs text-[#9a9080]">
              {currentIndex + 1} / {QUESTIONS.length}
            </span>
          </div>
          {/* HPバー風 */}
          <div className="hp-bar">
            <div className="hp-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Question — DQウィンドウ */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-lg"
          >
            <div className="dq-window px-6 py-5">
              <p className="text-xl font-medium leading-relaxed text-[#e8e0d4]">
                {currentQuestion.text}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Options — RPGコマンドリスト */}
      <div className="px-6 pb-4">
        <div className="w-full max-w-lg mx-auto space-y-2">
          {OPTIONS.map((option) => (
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
              <span className="text-sm">{option.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Navigation — RPGメニュー風 */}
      <div className="px-6 pb-8">
        <div className="w-full max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm text-[#9a9080] hover:text-[#f0c040] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>もどる</span>
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={`rpg-btn-primary flex items-center gap-2 px-6 py-3 text-sm font-medium ${
              !canProceed ? "opacity-30 cursor-not-allowed" : ""
            }`}
          >
            <span>{isLastQuestion ? "かんりょう" : "つぎへ"}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
