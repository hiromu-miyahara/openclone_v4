import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TypewriterText } from "../ui/TypewriterText";
import { useLanguage } from "../../lib/i18n";
import type { TranslationKey } from "../../lib/i18n";

interface GeneratingStoryPagesProps {
  onComplete: () => void;
  onSkip: () => void;
}

/* ════════════════════════════════════════════
   Page 1: サービス概要 — ロゴ + 3要素アイコン
   ════════════════════════════════════════════ */
function Page1Art() {
  const { t } = useLanguage();
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-6">
      {/* ロゴ */}
      <motion.div
        className="text-2xl font-bold tracking-widest text-[#f0c040]"
        style={{ fontFamily: "var(--font-pixel, monospace)" }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        OpenClone
      </motion.div>

      {/* 3要素: 声 + 性格 + 見た目 → AI分身 */}
      <div className="flex items-center gap-3">
        {[
          { icon: "🎤", labelKey: "generating.art.voice" as TranslationKey },
          { icon: "🧠", labelKey: "generating.art.personality" as TranslationKey },
          { icon: "📷", labelKey: "generating.art.appearance" as TranslationKey },
        ].map((item, i) => (
          <motion.div
            key={i}
            className="flex flex-col items-center gap-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.4 }}
          >
            <div className="w-12 h-12 border border-[#6a5c3e] rounded-sm flex items-center justify-center bg-[#0e0e24]">
              <span className="text-lg">{item.icon}</span>
            </div>
            <span className="text-[10px] text-[#9a9080]">{t(item.labelKey)}</span>
          </motion.div>
        ))}

        <motion.div
          className="text-[#f0c040] text-lg mx-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          →
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-1"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 2.3, type: "spring" }}
        >
          <div className="w-12 h-12 border-2 border-[#f0c040] rounded-sm flex items-center justify-center bg-[#0e0e24]">
            <span className="text-lg">🤖</span>
          </div>
          <span className="text-[10px] text-[#f0c040]">{t("generating.art.aiClone")}</span>
        </motion.div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Page 2: プロフィール登録 — フォームUI
   ════════════════════════════════════════════ */
function Page2Art() {
  const { t } = useLanguage();
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <motion.div
        className="w-52 border border-[#6a5c3e] rounded-sm bg-[#0e0e24] p-4 space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* タイトル */}
        <div className="text-xs text-[#f0c040] text-center mb-2">{t("generating.art.profileReg")}</div>

        {/* 名前フィールド */}
        <div className="space-y-1">
          <div className="text-[10px] text-[#9a9080]">{t("generating.art.name")}</div>
          <motion.div
            className="h-6 border border-[#6a5c3e] rounded-sm bg-[#08081a] px-2 flex items-center"
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <motion.span
              className="text-[10px] text-[#e8e0d4]"
              initial={{ width: 0 }}
              animate={{ width: "auto" }}
              transition={{ delay: 1, duration: 0.8 }}
            >
              {t("generating.art.sampleName")}
            </motion.span>
          </motion.div>
        </div>

        {/* 写真エリア */}
        <div className="space-y-1">
          <div className="text-[10px] text-[#9a9080]">{t("generating.art.facePhoto")}</div>
          <motion.div
            className="h-16 border border-dashed border-[#6a5c3e] rounded-sm flex items-center justify-center"
            animate={{ borderColor: ["rgba(106,92,62,0.5)", "rgba(240,192,64,0.6)", "rgba(106,92,62,0.5)"] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="text-center">
              <div className="text-lg text-[#9a9080]">📷</div>
              <div className="text-[8px] text-[#9a9080]">{t("generating.art.uploadPhoto")}</div>
            </div>
          </motion.div>
        </div>

        {/* ボタン */}
        <motion.div
          className="h-6 bg-[#f0c040]/20 border border-[#f0c040] rounded-sm flex items-center justify-center"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-[10px] text-[#f0c040]">{t("generating.art.nextArrow")}</span>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Page 3: 声の収集 — マイク + 波形UI
   ════════════════════════════════════════════ */
function Page3Art() {
  const { t } = useLanguage();
  const bars = useMemo(() =>
    Array.from({ length: 16 }, (_, i) => ({
      height: 4 + Math.sin(i * 0.8) * 10 + Math.random() * 6,
      delay: i * 0.1,
    })),
  []);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-52 border border-[#6a5c3e] rounded-sm bg-[#0e0e24] p-4 space-y-3">
        {/* シーン表示 */}
        <div className="text-xs text-[#f0c040] text-center">{t("generating.art.morningScene")}</div>
        <div className="border border-[#6a5c3e] rounded-sm p-2 bg-[#08081a]">
          <p className="text-[10px] text-[#e8e0d4] text-center leading-relaxed whitespace-pre-line">
            {t("generating.art.morningScript")}
          </p>
        </div>

        {/* 波形 */}
        <div className="flex items-center justify-center gap-[2px] h-8">
          {bars.map((bar, i) => (
            <motion.div
              key={i}
              className="w-[2px] bg-[#f0c040]/70 rounded-full"
              animate={{
                height: [bar.height, bar.height * 0.3, bar.height * 1.2, bar.height],
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: bar.delay, ease: "easeInOut" }}
              style={{ height: bar.height }}
            />
          ))}
        </div>

        {/* マイクボタン */}
        <div className="flex justify-center">
          <motion.div
            className="w-10 h-10 rounded-full border-2 border-[#ff4444] bg-[#ff4444]/20 flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <span className="text-sm">🎙</span>
          </motion.div>
        </div>
        <div className="text-[8px] text-[#ff4444] text-center">{t("generating.art.recordingStatus")}</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Page 4: 性格診断 — Big5テストUI
   ════════════════════════════════════════════ */
function Page4Art() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(-1);

  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      setSelected(idx % 5);
      idx++;
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const optionKeys: TranslationKey[] = [
    "generating.art.opt1",
    "generating.art.opt2",
    "generating.art.opt3",
    "generating.art.opt4",
    "generating.art.opt5",
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-52 border border-[#6a5c3e] rounded-sm bg-[#0e0e24] p-4 space-y-3">
        <div className="text-xs text-[#f0c040] text-center">{t("generating.art.big5Title")}</div>

        {/* 質問 */}
        <div className="border border-[#6a5c3e] rounded-sm p-2 bg-[#08081a]">
          <p className="text-[10px] text-[#e8e0d4] text-center">
            {t("generating.art.big5Question")}
          </p>
        </div>

        {/* 選択肢 */}
        <div className="space-y-1">
          {optionKeys.map((key, i) => (
            <motion.div
              key={i}
              className={`h-5 border rounded-sm flex items-center justify-center text-[9px] transition-colors ${
                selected === i
                  ? "border-[#f0c040] bg-[#f0c040]/20 text-[#f0c040]"
                  : "border-[#6a5c3e]/50 text-[#9a9080]"
              }`}
              animate={selected === i ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              {t(key)}
            </motion.div>
          ))}
        </div>

        {/* プログレス */}
        <div className="h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#f0c040]/60 rounded-full"
            animate={{ width: ["20%", "30%", "40%", "30%"] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Page 5: AI分身の生成 — 統合アニメーション
   ════════════════════════════════════════════ */
function Page5Art() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* 3要素が中央に集まる */}
        <div className="relative w-40 h-28">
          {[
            { icon: "🎤", x: -40, y: -20, delay: 0 },
            { icon: "🧠", x: 40, y: -20, delay: 0.3 },
            { icon: "📷", x: 0, y: 30, delay: 0.6 },
          ].map((item, i) => (
            <motion.div
              key={i}
              className="absolute left-1/2 top-1/2 w-8 h-8 border border-[#6a5c3e] rounded-sm flex items-center justify-center bg-[#0e0e24]"
              initial={{ x: item.x, y: item.y, opacity: 0.5 }}
              animate={{
                x: [item.x, 0],
                y: [item.y, 0],
                opacity: [0.5, 1, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: item.delay,
                ease: "easeInOut",
              }}
              style={{ marginLeft: -16, marginTop: -16 }}
            >
              <span className="text-sm">{item.icon}</span>
            </motion.div>
          ))}

          {/* 中央のアバター */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.5, 0.5, 1, 1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-10 h-10 border-2 border-[#f0c040] rounded-sm flex items-center justify-center bg-[#0e0e24]">
              <span className="text-xl">🤖</span>
            </div>
          </motion.div>
        </div>

        {/* 処理中のドット */}
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-[#f0c040] rounded-full"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Page 6: 会話スタート — チャットUI
   ════════════════════════════════════════════ */
function Page6Art() {
  const { t } = useLanguage();
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-52 border border-[#6a5c3e] rounded-sm bg-[#0e0e24] overflow-hidden">
        {/* ヘッダー */}
        <div className="px-3 py-1.5 border-b border-[#6a5c3e] flex items-center justify-between">
          <span className="text-[8px] text-[#f0c040]">AGENT WORLD</span>
          <span className="text-[8px] text-[#9a9080]">💬</span>
        </div>

        {/* アバター */}
        <div className="flex justify-center py-3">
          <motion.div
            className="relative"
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-8 h-8 border border-[#f0c040]/50 rounded-sm bg-[#08081a] flex items-center justify-center">
              <span className="text-sm">🧑</span>
            </div>
          </motion.div>
        </div>

        {/* 吹き出し */}
        <div className="mx-2 mb-2 border border-[#6a5c3e] rounded-sm p-2 bg-[#08081a]">
          <motion.p
            className="text-[9px] text-[#e8e0d4] leading-relaxed whitespace-pre-line"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {t("generating.art.chatGreeting")}
          </motion.p>
        </div>

        {/* 入力エリア */}
        <div className="px-2 pb-2 flex items-center gap-1">
          <div className="flex-1 h-5 border border-[#6a5c3e] rounded-sm bg-[#08081a] px-1.5 flex items-center">
            <span className="text-[8px] text-[#9a9080]">{t("generating.art.chatPlaceholder")}</span>
          </div>
          <motion.div
            className="w-5 h-5 bg-[#f0c040]/20 border border-[#f0c040] rounded-sm flex items-center justify-center"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-[8px]">▶</span>
          </motion.div>
          <div className="w-5 h-5 border border-[#6a5c3e] rounded-sm flex items-center justify-center">
            <span className="text-[8px]">🎤</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Story Pages Data
   ════════════════════════════════════════════ */
const STORY_PAGES: { line1Key: TranslationKey; line2Key: TranslationKey; Art: React.FC }[] = [
  { line1Key: "generating.page1.line1", line2Key: "generating.page1.line2", Art: Page1Art },
  { line1Key: "generating.page2.line1", line2Key: "generating.page2.line2", Art: Page2Art },
  { line1Key: "generating.page3.line1", line2Key: "generating.page3.line2", Art: Page3Art },
  { line1Key: "generating.page4.line1", line2Key: "generating.page4.line2", Art: Page4Art },
  { line1Key: "generating.page5.line1", line2Key: "generating.page5.line2", Art: Page5Art },
  { line1Key: "generating.page6.line1", line2Key: "generating.page6.line2", Art: Page6Art },
];

/* ════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════ */
export function GeneratingStoryPages({ onComplete, onSkip }: GeneratingStoryPagesProps) {
  const { t, lang } = useLanguage();
  const [pageIndex, setPageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Mock progress (60 seconds to 100%)
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsComplete(true);
          return 100;
        }
        // ~60 seconds: 100 / (60000 / 300) ≈ 0.5 per tick
        return Math.min(prev + 0.5, 100);
      });
    }, 300);
    return () => clearInterval(interval);
  }, []);

  // Page rotation: 10 seconds each
  useEffect(() => {
    if (isComplete) return;
    const interval = setInterval(() => {
      setPageIndex((prev) => (prev + 1) % STORY_PAGES.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [isComplete]);

  // Allow skip after 20 seconds
  useEffect(() => {
    const timer = setTimeout(() => setCanSkip(true), 20000);
    return () => clearTimeout(timer);
  }, []);

  const currentPage = STORY_PAGES[pageIndex];

  return (
    <div className="absolute inset-0 bg-black flex flex-col z-20">
      {/* ─── Pixel Art Scene (takes up main space) ─── */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={pageIndex}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <currentPage.Art />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ─── Bottom Panel: Text + Progress + Buttons ─── */}
      <div className="shrink-0 px-6 pb-8 pt-4 space-y-5">
        {/* Story text with DQ-style frame */}
        <div className="dq-window p-4 min-h-[80px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={pageIndex}
              className="relative z-10 space-y-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-[#f0c040] text-sm tracking-wider font-pixel-accent">
                <TypewriterText key={`l1-${pageIndex}-${lang}`} text={t(currentPage.line1Key)} speed={40} delay={300} />
              </p>
              <p className="text-[#e8e0d4] text-sm">
                <TypewriterText key={`l2-${pageIndex}-${lang}`} text={t(currentPage.line2Key)} speed={35} delay={1200} />
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress bar — HP bar style */}
        <div className="space-y-2">
          <div className="hp-bar">
            <motion.div
              className="hp-bar-fill"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "linear" }}
            />
          </div>
          <div className="flex justify-between text-xs text-[#9a9080]">
            <span>{t("generating.progress")}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* CTA Buttons */}
        {isComplete ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <button
              onClick={onComplete}
              className="rpg-btn-primary w-full py-3 text-sm font-medium"
            >
              {t("generating.go")}
            </button>
          </motion.div>
        ) : canSkip ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <button
              onClick={onSkip}
              className="rpg-btn w-full py-3 text-sm text-[#9a9080] hover:text-[#f0c040]"
            >
              {t("generating.skip")}
            </button>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
